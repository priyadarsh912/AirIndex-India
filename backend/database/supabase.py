"""
AirIndex India - Supabase PostgreSQL & Database Gateway
Provides unified persistence and retrieval for flight_observations and route_weights.
Connects to Supabase Cloud PostgreSQL with seamless fallback to SQLite ledger.
"""

import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("airscope.database.supabase")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")

_supabase_client = None


def get_client():
    """Returns initialized Supabase Client or None if credentials are not configured."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.info("[DatabaseGateway] Supabase credentials not found. Operating in local database mode.")
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _supabase_client
    except Exception as e:
        logger.warning(f"[DatabaseGateway] Failed to connect to Supabase: {e}")
        return None


def insert_flight_observations(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Inserts or updates flight observations into the flight_observations table.
    Writes to Supabase when online, and persists to local SQLite/PostgreSQL ledger.
    """
    if not records:
        return {"success": True, "count": 0}

    # 1. Always ensure persistence in local SQLAlchemy ledger for reliability
    local_count = 0
    try:
        try:
            from backend.models.database import SessionLocal, upsert_fare_observations
        except ImportError:
            from models.database import SessionLocal, upsert_fare_observations
        session = SessionLocal()
        try:
            local_count = upsert_fare_observations(session, records)
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"[DatabaseGateway] Local ledger write warning: {e}")

    # 2. Persist to Supabase Cloud PostgreSQL if available
    sb = get_client()
    sb_count = 0
    if sb:
        try:
            try:
                from backend.db_client import sanitize_record
            except ImportError:
                from db_client import sanitize_record
            sanitized_raw = [sanitize_record(r) for r in records]
            dedup_dict = {}
            for item in sanitized_raw:
                dedup_dict[item["id"]] = item
            cleaned_payload = list(dedup_dict.values())
            # Batch upsert in chunks of 200
            chunk_size = 200
            for i in range(0, len(cleaned_payload), chunk_size):
                chunk = cleaned_payload[i : i + chunk_size]
                res = sb.table("flight_observations").upsert(chunk, on_conflict="id").execute()
                sb_count += len(res.data) if hasattr(res, "data") and res.data else len(chunk)
            logger.info(f"[DatabaseGateway] Successfully persisted {sb_count} records to Supabase.")
        except Exception as e:
            logger.warning(f"[DatabaseGateway] Supabase write encountered error: {e}")

    return {
        "success": True,
        "local_ledger_count": local_count,
        "supabase_count": sb_count,
        "total_records": len(records),
    }


def fetch_flight_observations(
    route: Optional[str] = None,
    travel_date: Optional[str] = None,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    """Fetches observations from Supabase with fallback to local ledger."""
    sb = get_client()
    if sb:
        try:
            query = sb.table("flight_observations").select("*").order("timestamp", desc=True).limit(limit)
            if route:
                query = query.eq("route", route)
            if travel_date:
                query = query.gte("timestamp", f"{travel_date}T00:00:00")
            res = query.execute()
            if res.data:
                return res.data
        except Exception as e:
            logger.warning(f"[DatabaseGateway] Supabase query failed, falling back to local DB: {e}")

    # Fallback to local DB
    try:
        from backend.models.database import SessionLocal, FareObservation
    except ImportError:
        from models.database import SessionLocal, FareObservation
    session = SessionLocal()
    try:
        q = session.query(FareObservation).order_by(FareObservation.collected_at.desc())
        if route:
            orig, dest = route.split("-") if "-" in route else (route, "")
            if orig and dest:
                q = q.filter(FareObservation.origin == orig, FareObservation.destination == dest)
        if travel_date:
            q = q.filter(FareObservation.departure_date == travel_date)
        rows = q.limit(limit).all()
        return [r.to_dict() for r in rows]
    finally:
        session.close()


def load_route_weights() -> List[Dict[str, Any]]:
    """Loads route weights from Supabase or default route weights configuration."""
    sb = get_client()
    if sb:
        try:
            res = sb.table("route_weights").select("*").execute()
            if res.data and len(res.data) > 0:
                return res.data
        except Exception:
            pass

    try:
        try:
            from backend.collector_planner import load_route_weights as fallback_weights
        except ImportError:
            from collector_planner import load_route_weights as fallback_weights
        return fallback_weights()
    except Exception:
        return []


def save_route_weights(weights: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Persists route weights table to Supabase."""
    sb = get_client()
    if not sb:
        return {"success": False, "message": "Supabase not configured"}

    try:
        res = sb.table("route_weights").upsert(weights).execute()
        return {"success": True, "count": len(res.data) if hasattr(res, "data") else len(weights)}
    except Exception as e:
        return {"success": False, "error": str(e)}
