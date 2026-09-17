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
    """Sanitizes an observation dictionary to match the database table schema."""
    return {
        "id": str(obs.get("id") or f"obs_{obs.get('composite_key', '')[:12]}_{obs.get('timestamp', '')}"),
        "composite_key": str(obs.get("composite_key") or ""),
        "timestamp": obs.get("timestamp") or obs.get("capture_date"),
        "route": str(obs.get("route") or "UNKNOWN"),
        "airline": str(obs.get("airline") or "UNKNOWN"),
        "flight_number": str(obs.get("flight_number") or ""),
        "departure_time": str(obs.get("departure_time") or ""),
        "arrival_time": str(obs.get("arrival_time") or ""),
        "source": str(obs.get("source") or "Scraper"),
        "booking_window": str(obs.get("booking_window") or "T+1"),
        "cabin_class": str(obs.get("cabin_class") or "Economy"),
        "fare_class": str(obs.get("fare_class") or "Standard"),
        "base_fare": float(obs.get("base_fare") or 0.0),
        "taxes": float(obs.get("taxes") or 0.0),
        "fees": float(obs.get("fees") or 0.0),
        "total_fare": float(obs.get("total_fare") or obs.get("price") or 0.0),
        "currency": str(obs.get("currency") or "INR"),
        "seat_availability": int(obs.get("seat_availability") or 0),
        "status": str(obs.get("status") or "AVAILABLE"),
        "simulated_outlier": bool(obs.get("simulated_outlier", False)),
        "missing_field": bool(obs.get("missing_field", False)),
        "is_live_scraped": bool(obs.get("is_live_scraped", True)),
        "registry_validation": str(obs.get("registry_validation") or "VERIFIED"),
        "registry_confidence": int(obs.get("registry_confidence") or 100),
        "is_price_anomaly": bool(obs.get("is_price_anomaly", False)),
        "quality_score": int(obs.get("quality_score") or 100),
        "is_usable": bool(obs.get("is_usable", True)),
    }


def save_observations_to_supabase(observations: List[Dict[str, Any]], table_name: str = "flight_observations") -> bool:
    """Bulk upserts flight observations into Supabase."""
    client = get_supabase_client()
    if not client or not observations:
        return False

    sanitized_raw = [sanitize_record(o) for o in observations if o.get("total_fare") or o.get("price")]
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
