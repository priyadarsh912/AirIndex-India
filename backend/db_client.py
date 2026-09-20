"""
AirIndex India - Supabase Database Client & Persistence Layer
Provides high-performance insertion, retrieval, and caching of flight observations in Supabase (PostgreSQL).
"""

import os
import sys
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY", "")

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[Supabase] Notice: SUPABASE_URL or SUPABASE_KEY missing. Database integration in offline mode.")
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _supabase_client
    except Exception as e:
        print(f"[Supabase] Warning: Failed to initialize Supabase client: {e}")
        return None


SUPABASE_FLIGHT_COLUMNS = {
    'id', 'composite_key', 'timestamp', 'route', 'airline', 'flight_number',
    'departure_time', 'arrival_time', 'source', 'booking_window', 'cabin_class',
    'fare_class', 'base_fare', 'taxes', 'fees', 'total_fare', 'currency',
    'seat_availability', 'status', 'simulated_outlier', 'missing_field',
    'is_live_scraped', 'registry_validation', 'registry_confidence',
    'is_price_anomaly', 'quality_score', 'is_usable', 'created_at'
}

def sanitize_record(obs: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitizes an observation dictionary to match the database table schema exactly."""
    def to_float_or_none(v):
        if v is None:
            return None
        try:
            return round(float(v), 2)
        except (ValueError, TypeError):
            return None

    raw_avail = str(obs.get("availability_status") or obs.get("status") or "AVAILABLE").upper()
    total_fare = to_float_or_none(obs.get("total_fare") if obs.get("total_fare") is not None else obs.get("price"))
    if total_fare is None or raw_avail in ["SOLD_OUT", "CANCELLED"]:
        total_fare = 0.0

    base_fare = to_float_or_none(obs.get("base_fare")) or 0.0
    taxes = to_float_or_none(obs.get("taxes")) or 0.0
    fees = to_float_or_none(obs.get("fees") or obs.get("convenience_fee") or obs.get("other_fee")) or 0.0


    # Ensure timestamp is ISO formatted
    ts = obs.get("timestamp") or obs.get("created_at")
    if not ts:
        c_date = obs.get("capture_date") or obs.get("travel_date") or datetime.utcnow().strftime("%Y-%m-%d")
        ts = f"{c_date}T12:00:00+00:00"

    route = str(obs.get("route") or (f"{obs.get('origin')}-{obs.get('destination')}" if obs.get("origin") and obs.get("destination") else "DEL-BOM"))
    airline = str(obs.get("airline") or "Air India")
    flight_num = str(obs.get("flight_number") or "AI-101")
    window = str(obs.get("booking_window") or obs.get("window") or "T+7")

    record_id = str(obs.get("id") or obs.get("observation_id") or f"obs_{route}_{window}_{flight_num}_{ts[:10]}")
    comp_key = str(obs.get("composite_key") or f"{route}_{ts[:10]}_{airline}_{flight_num}_{window}")

    payload = {
        "id": record_id,
        "composite_key": comp_key,
        "timestamp": str(ts),
        "route": route,
        "airline": airline,
        "flight_number": flight_num,
        "departure_time": str(obs.get("departure_time") or "08:00"),
        "arrival_time": str(obs.get("arrival_time") or "10:15"),
        "source": str(obs.get("source") or "Live Scraper"),
        "booking_window": window,
        "cabin_class": str(obs.get("cabin_class") or "Economy"),
        "fare_class": str(obs.get("fare_class") or obs.get("fare_family") or "Standard"),
        "base_fare": base_fare,
        "taxes": taxes,
        "fees": fees,
        "total_fare": total_fare,
        "currency": str(obs.get("currency") or "INR"),
        "seat_availability": int(obs.get("seat_availability") or 9) if raw_avail == "AVAILABLE" else 0,
        "status": raw_avail,
        "simulated_outlier": bool(obs.get("simulated_outlier", False)),
        "missing_field": bool(obs.get("missing_field", False)),
        "is_live_scraped": bool(obs.get("is_live_scraped", True)),
        "registry_validation": str(obs.get("registry_validation") or "VERIFIED"),
        "registry_confidence": int(obs.get("registry_confidence") or 100),
        "is_price_anomaly": bool(obs.get("is_price_anomaly", False)),
        "quality_score": int(obs.get("quality_score") or 100),
        "is_usable": bool(obs.get("is_usable", True)),
    }

    return {k: v for k, v in payload.items() if k in SUPABASE_FLIGHT_COLUMNS}



def save_observations_to_supabase(observations: List[Dict[str, Any]], table_name: str = "flight_observations") -> bool:
    """Bulk upserts flight observations into Supabase without discarding sold-out/cancelled records."""
    client = get_supabase_client()
    if not client or not observations:
        return False

    sanitized_raw = [sanitize_record(o) for o in observations if o.get("id") or o.get("flight_number")]
    if not sanitized_raw:
        return False

    # Deduplicate within the payload by 'id' to prevent PostgreSQL ON CONFLICT 21000 errors
    dedup_dict = {}
    for item in sanitized_raw:
        dedup_dict[item["id"]] = item
    sanitized = list(dedup_dict.values())

    chunk_size = 200
    success_count = 0
    total = len(sanitized)

    print(f"[Supabase] Starting upsert of {total} unique records into '{table_name}'...")
    for i in range(0, total, chunk_size):
        chunk = sanitized[i:i + chunk_size]
        try:
            res = client.table(table_name).upsert(chunk, on_conflict="id").execute()
            if hasattr(res, 'data') and res.data:
                success_count += len(res.data)
            else:
                success_count += len(chunk)
        except Exception as e:
            print(f"[Supabase] Error uploading chunk {i}-{i+chunk_size}: {e}")

    print(f"[Supabase] Successfully persisted {success_count}/{total} observations to Supabase!")
    return success_count > 0


def fetch_observations_from_supabase(limit: int = 10000, table_name: str = "flight_observations") -> List[Dict[str, Any]]:
    """Fetches historical flight observations from Supabase."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        res = client.table(table_name).select("*").order("timestamp", desc=True).limit(limit).execute()
        if hasattr(res, 'data') and res.data:
            print(f"[Supabase] Retrieved {len(res.data)} records from database.")
            return res.data
        return []
    except Exception as e:
        print(f"[Supabase] Failed to fetch observations from Supabase: {e}")
        return []
