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


def sanitize_record(obs: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitizes an observation dictionary to match the database table schema and target data model."""
    def to_float_or_none(v):
        if v is None:
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    raw_avail = str(obs.get("availability_status") or obs.get("status") or "AVAILABLE").upper()
    total_fare = to_float_or_none(obs.get("total_fare") if obs.get("total_fare") is not None else obs.get("price"))
    if raw_avail in ["SOLD_OUT", "CANCELLED"]:
        total_fare = None

    return {
        "id": str(obs.get("id") or obs.get("observation_id") or f"obs_{obs.get('composite_key', '')[:12]}_{obs.get('timestamp', '')}"),
        "observation_id": str(obs.get("observation_id") or obs.get("id") or ""),
        "composite_key": str(obs.get("composite_key") or ""),
        "timestamp": obs.get("timestamp") or obs.get("observation_timestamp") or obs.get("capture_date"),
        "observation_timestamp": obs.get("observation_timestamp") or obs.get("timestamp") or "",
        "capture_date": str(obs.get("capture_date") or "")[:10],
        "travel_date": str(obs.get("travel_date") or "")[:10],
        "advance_purchase_days": int(obs.get("advance_purchase_days") or 7),
        "route": str(obs.get("route") or "UNKNOWN"),
        "origin": str(obs.get("origin") or (obs.get("route", "").split("-")[0] if "-" in obs.get("route", "") else "DEL")),
        "destination": str(obs.get("destination") or (obs.get("route", "").split("-")[1] if "-" in obs.get("route", "") else "BOM")),
        "airline": str(obs.get("airline") or "UNKNOWN"),
        "airline_code": str(obs.get("airline_code") or ""),
        "flight_number": str(obs.get("flight_number") or ""),
        "source": str(obs.get("source") or "Scraper"),
        "source_type": str(obs.get("source_type") or "OTA"),
        "booking_window": str(obs.get("booking_window") or "T+1"),

        # Fare Class Taxonomy
        "cabin_class": str(obs.get("cabin_class") or "ECONOMY").upper(),
        "fare_family": str(obs.get("fare_family") or "UNKNOWN").upper(),
        "fare_brand": str(obs.get("fare_brand") or obs.get("raw_fare_class") or "Economy"),
        "fare_basis": obs.get("fare_basis"),
        "raw_fare_class": obs.get("raw_fare_class") or obs.get("fare_class"),

        # Price Breakdown
        "displayed_fare": to_float_or_none(obs.get("displayed_fare")),
        "base_fare": to_float_or_none(obs.get("base_fare")),
        "taxes": to_float_or_none(obs.get("taxes")),
        "airline_surcharge": to_float_or_none(obs.get("airline_surcharge")),
        "convenience_fee": to_float_or_none(obs.get("convenience_fee")),
        "payment_fee": to_float_or_none(obs.get("payment_fee")),
        "other_fee": to_float_or_none(obs.get("other_fee") or obs.get("fees")),
        "fees": to_float_or_none(obs.get("fees")),
        "total_fare": total_fare,
        "price": total_fare,
        "final_fare": to_float_or_none(obs.get("final_fare")) or total_fare,
        "calculated_component_total": to_float_or_none(obs.get("calculated_component_total")),
        "fare_difference": to_float_or_none(obs.get("fare_difference")),
        "currency": str(obs.get("currency") or "INR"),

        # Availability
        "availability_status": raw_avail,
        "status": raw_avail,
        "seat_availability": int(obs.get("seat_availability") or 0) if raw_avail == "AVAILABLE" else 0,

        # Quality & Audit
        "data_quality_status": str(obs.get("data_quality_status") or "VALID"),
        "quality_flags": obs.get("quality_flags") or [],
        "quality_score": int(obs.get("quality_score") or 100),
        "is_usable": bool(obs.get("is_usable", True)),
        "raw_source_reference": obs.get("raw_source_reference"),
        "simulated_outlier": bool(obs.get("simulated_outlier", False)),
        "missing_field": bool(obs.get("missing_field", False)),
        "is_live_scraped": bool(obs.get("is_live_scraped", True)),
        "registry_validation": str(obs.get("registry_validation") or "VERIFIED"),
        "registry_confidence": int(obs.get("registry_confidence") or 100),
        "is_price_anomaly": bool(obs.get("is_price_anomaly", False)),
    }


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
