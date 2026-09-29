"""
AirIndex India - Google Flights Scraper Scheduler & Orchestrator
Coordinates regular observations collection across monitored routes,
enforces rate control, writes to Supabase/PostgreSQL/SQLite, and tracks telemetry.
"""

import os
import time
import logging
import asyncio
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional

try:
    from backend.scraper.google_flights import (
        scrape_and_normalize_route,
        DEFAULT_MONITORED_ROUTES,
        DEFAULT_BOOKING_WINDOWS,
    )
    from backend.models.database import SessionLocal, upsert_fare_observations
    from backend.db_client import get_supabase_client, save_observations_to_supabase
except ImportError:
    from scraper.google_flights import (
        scrape_and_normalize_route,
        DEFAULT_MONITORED_ROUTES,
        DEFAULT_BOOKING_WINDOWS,
    )
    from models.database import SessionLocal, upsert_fare_observations
    from db_client import get_supabase_client, save_observations_to_supabase

logger = logging.getLogger("airscope.scraper.scheduler")


class FastFlightsScheduler:
    """Manages periodic and on-demand Google Flights collection cycles."""

    def __init__(self):
        self.is_running = False
        self.last_run_timestamp: Optional[str] = None
        self.last_run_stats: Dict[str, Any] = {}
        self.total_collected_today: int = 0
        self.last_run_date: Optional[str] = None
        self.error_log: List[str] = []

    def get_status(self) -> Dict[str, Any]:
        return {
            "source": "Google Flights (fast-flights v3.0)",
            "is_running": self.is_running,
            "last_run": self.last_run_timestamp,
            "last_stats": self.last_run_stats,
            "total_collected_today": self.total_collected_today,
            "monitored_routes_count": len(DEFAULT_MONITORED_ROUTES),
            "recent_errors": self.error_log[-5:],
        }

    def run_collection_cycle(
        self,
        routes: Optional[List[Dict[str, str]]] = None,
        windows: Optional[List[int]] = None,
        max_searches: int = 15,
        persist_to_db: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes a controlled collection cycle across routes and windows.
        Persists observations idempotently to Supabase and SQLite ledger.
        """
        self.is_running = True
        start_time = datetime.now(timezone.utc)
        today_str = start_time.strftime("%Y-%m-%d")

        if self.last_run_date != today_str:
            self.total_collected_today = 0
            self.last_run_date = today_str

        target_routes = routes or DEFAULT_MONITORED_ROUTES
        target_windows = windows or [7, 30]  # Focus on key anchor windows for regular runs

        collected_observations: List[Dict[str, Any]] = []
        searches_conducted = 0
        cycle_errors: List[str] = []

        try:
            for r in target_routes:
                orig = r["origin"].upper()
                dest = r["destination"].upper()

                for lead_days in target_windows:
                    if searches_conducted >= max_searches:
                        break

                    target_date = (start_time.date() + timedelta(days=lead_days)).strftime("%Y-%m-%d")
                    try:
                        quotes = scrape_and_normalize_route(
                            origin=orig,
                            destination=dest,
                            travel_date=target_date,
                            lead_days=lead_days,
                        )
                        collected_observations.extend(quotes)
                        searches_conducted += 1
                        time.sleep(1.8)  # Polite pacing between searches
                    except Exception as e:
                        err_str = f"Error {orig}->{dest} ({target_date}): {e}"
                        logger.warning(err_str)
                        cycle_errors.append(err_str)
                        self.error_log.append(err_str)

                if searches_conducted >= max_searches:
                    break

            rows_written = 0
            supabase_written = 0

            # Persistence layer
            if persist_to_db and collected_observations:
                # 1. Local SQLite / PostgreSQL SQLAlchemy ledger
                session = SessionLocal()
                try:
                    rows_written = upsert_fare_observations(session, collected_observations)
                except Exception as e:
                    logger.error(f"Failed writing to local database ledger: {e}")
                finally:
                    session.close()

                # 2. Supabase Cloud PostgreSQL
                try:
                    success = save_observations_to_supabase(collected_observations)
                    if success:
                        supabase_written = len(collected_observations)
                except Exception as e:
                    logger.warning(f"Notice: Supabase cloud write skipped or offline: {e}")

            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            self.total_collected_today += len(collected_observations)
            self.last_run_timestamp = start_time.isoformat()
            self.last_run_stats = {
                "searches_conducted": searches_conducted,
                "observations_found": len(collected_observations),
                "db_rows_upserted": rows_written,
                "supabase_rows_written": supabase_written,
                "duration_seconds": round(duration, 2),
                "errors_count": len(cycle_errors),
                "status": "COMPLETED" if not cycle_errors else "PARTIAL",
            }

            return {
                "success": True,
                "timestamp": self.last_run_timestamp,
                "stats": self.last_run_stats,
                "sample_quotes": collected_observations[:5],
            }

        finally:
            self.is_running = False


# Global singleton instance
fast_flights_scheduler = FastFlightsScheduler()
