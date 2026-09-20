import os
import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import func
try:
    from backend.models.database import SessionLocal, FareObservation, CollectionRun, upsert_fare_observations
    from backend.providers.serpapi_provider import SerpApiGoogleFlightsProvider
    from backend.providers.fixture_provider import FixtureProvider
    from backend.providers.base import FareProvider
    from backend.fee_deriver import flag_outliers_iqr
except ImportError:
    from models.database import SessionLocal, FareObservation, CollectionRun, upsert_fare_observations
    from providers.serpapi_provider import SerpApiGoogleFlightsProvider
    from providers.fixture_provider import FixtureProvider
    from providers.base import FareProvider
    from fee_deriver import flag_outliers_iqr

logger = logging.getLogger("airscope.collector")

MONTHLY_SEARCH_BUDGET = int(os.getenv("MONTHLY_SEARCH_BUDGET", "250"))
MAX_SEARCHES_PER_RUN = int(os.getenv("MAX_SEARCHES_PER_RUN", "20"))
WEIGHTS_PATH = Path(__file__).resolve().parent / "config" / "route_weights.json"

# In-memory 1-hour response cache
# key: (provider_name, origin, destination, departure_date, cabin) -> (cached_at_datetime, quotes_list)
_RESPONSE_CACHE: Dict[Tuple[str, str, str, str, str], Tuple[datetime, List[Dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 3600


def get_cached_response(
    provider: str, origin: str, destination: str, departure_date: str, cabin: str
) -> Optional[List[Dict[str, Any]]]:
    key = (provider, origin.upper(), destination.upper(), departure_date, cabin.upper())
    cached = _RESPONSE_CACHE.get(key)
    if not cached:
        return None
    cached_at, quotes = cached
    if (datetime.now(timezone.utc) - cached_at).total_seconds() < CACHE_TTL_SECONDS:
        return quotes
    # Expired
    del _RESPONSE_CACHE[key]
    return None


def set_cached_response(
    provider: str, origin: str, destination: str, departure_date: str, cabin: str, quotes: List[Dict[str, Any]]
):
    key = (provider, origin.upper(), destination.upper(), departure_date, cabin.upper())
    _RESPONSE_CACHE[key] = (datetime.now(timezone.utc), quotes)


def clear_cache():
    _RESPONSE_CACHE.clear()


def load_route_weights() -> List[Dict[str, Any]]:
    """Loads route weights config or provides sensible default weights."""
    if WEIGHTS_PATH.exists():
        try:
            with open(WEIGHTS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("routes", [])
        except Exception as e:
            logger.warning(f"Failed loading route_weights.json: {e}")

    # Default assumed weights for top domestic trunk routes
    return [
        {"origin": "DEL", "destination": "BOM", "weight": 0.18, "status": "assumed"},
        {"origin": "BOM", "destination": "DEL", "weight": 0.18, "status": "assumed"},
        {"origin": "DEL", "destination": "BLR", "weight": 0.14, "status": "assumed"},
        {"origin": "BLR", "destination": "DEL", "weight": 0.14, "status": "assumed"},
        {"origin": "BOM", "destination": "BLR", "weight": 0.10, "status": "assumed"},
        {"origin": "BLR", "destination": "BOM", "weight": 0.10, "status": "assumed"},
        {"origin": "DEL", "destination": "HYD", "weight": 0.08, "status": "assumed"},
        {"origin": "HYD", "destination": "DEL", "weight": 0.08, "status": "assumed"},
    ]


def get_monthly_search_usage(session) -> int:
    """Computes total searches used in the current calendar month UTC."""
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    total = session.query(func.sum(CollectionRun.searches_used)).filter(
        CollectionRun.started_at >= start_of_month
    ).scalar()
    return int(total or 0)


def plan_search_batch(
    max_searches: int,
    rotational_seed: int = 0
) -> List[Dict[str, Any]]:
    """
    Plans search pairs (route x lead_days) prioritizing windows [7, 30]
    and rotating [1, 15, 45], ordered by route weight descending.
    """
    routes = load_route_weights()
    routes_sorted = sorted(routes, key=lambda r: r.get("weight", 0), reverse=True)

    primary_windows = [7, 30]
    secondary_windows = [1, 15, 45]

    # Rotate secondary windows based on seed/run
    rotated_secondary = secondary_windows[rotational_seed % len(secondary_windows):] + \
                        secondary_windows[:rotational_seed % len(secondary_windows)]

    plan = []
    # 1. Primary windows for top routes
    for r in routes_sorted:
        for w in primary_windows:
            plan.append({
                "origin": r["origin"],
                "destination": r["destination"],
                "lead_days": w,
                "weight": r.get("weight", 0.0),
                "is_primary": True
            })
            if len(plan) >= max_searches:
                return plan

    # 2. Secondary windows if budget remains
    for r in routes_sorted:
        for w in rotated_secondary:
            plan.append({
                "origin": r["origin"],
                "destination": r["destination"],
                "lead_days": w,
                "weight": r.get("weight", 0.0) * 0.5,
                "is_primary": False
            })
            if len(plan) >= max_searches:
                return plan

    return plan


class CollectorRunner:
    """Orchestrates search execution, budget limits, caching, and database persistence."""

    def __init__(self, provider: Optional[FareProvider] = None):
        if provider:
            self.provider = provider
        else:
            serp_provider = SerpApiGoogleFlightsProvider()
            if serp_provider.is_configured():
                self.provider = serp_provider
            else:
                self.provider = FixtureProvider()

    def run_collection(
        self,
        max_searches: Optional[int] = None,
        cabin: str = "ECONOMY",
        base_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Executes a budget-capped collection cycle.
        Returns execution summary dictionary.
        """
        session = SessionLocal()
        now_utc = base_date or datetime.now(timezone.utc)
        start_time = datetime.now(timezone.utc)

        # 1. Check budget
        used_this_month = get_monthly_search_usage(session)
        remaining_budget = max(0, MONTHLY_SEARCH_BUDGET - used_this_month)
        configured_max = max_searches or MAX_SEARCHES_PER_RUN
        allowable_searches = min(configured_max, remaining_budget)

        run_record = CollectionRun(
            started_at=start_time,
            provider=self.provider.name,
            searches_used=0,
            rows_written=0,
            status="IN_PROGRESS"
        )
        session.add(run_record)
        session.commit()
        session.refresh(run_record)

        if allowable_searches <= 0:
            run_record.ended_at = datetime.now(timezone.utc)
            run_record.status = "BUDGET_EXHAUSTED"
            run_record.errors = f"Monthly search budget exhausted ({used_this_month}/{MONTHLY_SEARCH_BUDGET} used)."
            session.commit()
            session.close()
            return {
                "run_id": run_record.id,
                "status": "BUDGET_EXHAUSTED",
                "searches_used": 0,
                "rows_written": 0,
                "remaining_budget": remaining_budget,
                "provider": self.provider.name,
                "message": run_record.errors
            }

        # 2. Plan targets
        total_runs_count = session.query(func.count(CollectionRun.id)).scalar() or 0
        planned_targets = plan_search_batch(allowable_searches, rotational_seed=total_runs_count)

        all_quotes: List[Dict[str, Any]] = []
        actual_searches_used = 0
        errors: List[str] = []

        for target in planned_targets:
            if actual_searches_used >= allowable_searches:
                break

            orig = target["origin"]
            dest = target["destination"]
            lead_days = target["lead_days"]
            dep_date = (now_utc + timedelta(days=lead_days)).strftime("%Y-%m-%d")

            # Check 1h cache
            cached = get_cached_response(self.provider.name, orig, dest, dep_date, cabin)
            if cached is not None:
                all_quotes.extend(cached)
                continue

            try:
                quotes = self.provider.fetch(
                    origin=orig,
                    destination=dest,
                    departure_date=dep_date,
                    lead_days=lead_days,
                    cabin=cabin
                )
                actual_searches_used += 1
                set_cached_response(self.provider.name, orig, dest, dep_date, cabin, quotes)
                all_quotes.extend(quotes)
            except Exception as e:
                err_msg = f"Error fetching {orig}->{dest} on {dep_date} via {self.provider.name}: {str(e)}"
                logger.error(err_msg)
                errors.append(err_msg)
                # If provider is SerpApi and fails, fallback to fixture for remaining batch
                if isinstance(self.provider, SerpApiGoogleFlightsProvider):
                    logger.warning("SerpApi encountered error, falling back to FixtureProvider")
                    self.provider = FixtureProvider()
                    try:
                        fallback_quotes = self.provider.fetch(orig, dest, dep_date, lead_days, cabin)
                        all_quotes.extend(fallback_quotes)
                    except Exception as fe:
                        errors.append(f"Fallback error: {fe}")

        # 3. Clean and flag IQR outliers
        cleaned_quotes = flag_outliers_iqr(all_quotes)

        # 4. Upsert into database
        rows_written = 0
        if cleaned_quotes:
            rows_written = upsert_fare_observations(session, cleaned_quotes)

        # 5. Finalize run record
        run_record.ended_at = datetime.now(timezone.utc)
        run_record.searches_used = actual_searches_used
        run_record.rows_written = rows_written
        run_record.errors = "; ".join(errors) if errors else None
        run_record.status = "SUCCESS" if not errors else "PARTIAL"
        session.commit()

        summary = {
            "run_id": run_record.id,
            "status": run_record.status,
            "provider": self.provider.name,
            "searches_used": actual_searches_used,
            "rows_written": rows_written,
            "remaining_budget": max(0, MONTHLY_SEARCH_BUDGET - (used_this_month + actual_searches_used)),
            "errors": errors,
        }
        session.close()
        return summary
