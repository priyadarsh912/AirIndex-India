"""
AirIndex India - Scraper Orchestrator CLI
Runs Google Flights scraper via fast-flights v3.0 across routes and booking windows.
Saves normalized fare observations to backend/scraped_data/ directory.
"""

import os
import sys
import json
import argparse
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_generator import ROUTES_CONFIG, AIRLINES_CONFIG
from flight_registry import get_valid_flight_for_route
from models.flight_envelope import FlightIdentityKey, FlightPricing, IngestionEnvelope

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ScraperOrchestrator")

# Booking Windows offset map in days
WINDOW_DAYS = {
    "T+1": 1,
    "T+7": 7,
    "T+15": 15,
    "T+30": 30,
    "T+45": 45,
}

SCRAPED_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraped_data")


def harvest_live_google_flights_observations(route_objs: List[Dict[str, Any]], windows: List[str]) -> List[Dict[str, Any]]:
    """
    Harvests authentic real-time live observations from Google Flights via fast-flights v3.0.
    100% genuine live scraping with zero mock or synthetic simulation.
    """
    try:
        from scraper.google_flights import scrape_and_normalize_route
    except ImportError:
        from backend.scraper.google_flights import scrape_and_normalize_route

    now = datetime.now()
    all_obs = []

    for route in route_objs:
        route_code = route.get("code") or f"{route.get('origin')}-{route.get('destination')}"
        if "-" not in route_code:
            continue
        origin, dest = route_code.split("-")

        for window in windows:
            days_offset = WINDOW_DAYS.get(window, 7)
            travel_date = (now + timedelta(days=days_offset)).strftime("%Y-%m-%d")

            try:
                quotes = scrape_and_normalize_route(
                    origin=origin.upper(),
                    destination=dest.upper(),
                    travel_date=travel_date,
                    lead_days=days_offset,
                )
                if quotes:
                    all_obs.extend(quotes)
                    logger.info(f"[Google Flights Live] Harvested {len(quotes)} real quotes for {origin}->{dest} ({window})")
            except Exception as e:
                logger.warning(f"[Google Flights Live] Error fetching {origin}->{dest} on {travel_date}: {e}")

    return all_obs


async def run_scraping_job(
    sources: List[str],
    routes: List[str],
    windows: List[str],
    dry_run: bool = False,
    **kwargs,
) -> Dict[str, Any]:
    """Orchestrate scraping across selected sources, routes, and booking windows."""
    os.makedirs(SCRAPED_DATA_DIR, exist_ok=True)
    today = datetime.now()

    all_observations: List[Dict[str, Any]] = []
    job_stats = {
        "start_time": today.strftime("%Y-%m-%d %H:%M:%S"),
        "sources_scraped": sources,
        "routes_scraped": routes,
        "windows_scraped": windows,
        "total_records": 0,
        "errors": [],
        "file_saved": None,
    }

    if dry_run:
        logger.info("[DRY RUN] Initializing scrapers without making network requests.")
        return job_stats

    # Selected routes objects: cover all 52 corridors when 'all' or default
    if not routes or "all" in routes or routes == ["all"]:
        route_objs = list(ROUTES_CONFIG)
    else:
        route_objs = [r for r in ROUTES_CONFIG if r["code"] in routes]

    # Windows: default to all 5 standard booking windows if not specified
    if not windows:
        windows = ["T+1", "T+7", "T+15", "T+30", "T+45"]

    # Optional filter by cluster
    cluster_filter = kwargs.get("cluster")
    if cluster_filter:
        route_objs = [r for r in route_objs if r.get("cluster") == cluster_filter]

    logger.info(f"Target corridors count: {len(route_objs)} corridors across {len(windows)} booking tiers.")

    logger.info(f"[Google Flights Live Harvest] Scraping real quotes for {len(route_objs)} corridors via fast-flights v3.0.")
    real_quotes = harvest_live_google_flights_observations(route_objs, windows)
    all_observations.extend(real_quotes)
    job_stats["harvest_method"] = "LIVE_GOOGLE_FLIGHTS_HTTP"

    # Save collected observations to JSON file
    job_stats["end_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    job_stats["total_records"] = len(all_observations)
    job_stats["corridors_scraped"] = sorted(list(set(o.get("route") for o in all_observations if o.get("route"))))

    if all_observations:
        timestamp_str = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        filename = f"scrape_{timestamp_str}.json"
        filepath = os.path.join(SCRAPED_DATA_DIR, filename)

        output_payload = {
            "metadata": job_stats,
            "observations": all_observations,
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, indent=2)

        job_stats["file_saved"] = filepath
        logger.info(f"Saved {len(all_observations)} scraped observations to {filepath}")

        # 1. Persist to Supabase Cloud PostgreSQL Database
        supabase_persisted = False
        try:
            from db_client import save_observations_to_supabase
            supabase_persisted = save_observations_to_supabase(all_observations)
            job_stats["supabase_persisted"] = supabase_persisted
            logger.info(f"[Supabase] Batch upsert completed: status={supabase_persisted}")
        except Exception as db_err:
            logger.warning(f"Could not persist scraped data to Supabase: {db_err}")
            job_stats["supabase_persisted"] = False
            job_stats["supabase_error"] = str(db_err)

        # 2. Sync directly to frontend/src/data/scrapedObservations.json
        try:
            frontend_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "frontend",
                "src",
                "data",
                "scrapedObservations.json",
            )
            if os.path.exists(os.path.dirname(frontend_path)):
                # Merge with existing frontend observations so historical depth is preserved
                existing_obs = []
                if os.path.exists(frontend_path):
                    try:
                        with open(frontend_path, "r", encoding="utf-8") as exf:
                            existing_obs = json.load(exf)
                    except Exception:
                        existing_obs = []

                obs_map = {o.get("id"): o for o in existing_obs if o.get("id")}
                for o in all_observations:
                    obs_map[o["id"]] = o

                merged_frontend = list(obs_map.values())
                with open(frontend_path, "w", encoding="utf-8") as ff:
                    json.dump(merged_frontend, ff, indent=2)
                logger.info(f"[Frontend Sync] Updated {frontend_path} with {len(merged_frontend)} observations.")
        except Exception as sync_err:
            logger.warning(f"Failed to sync to frontend scrapedObservations.json: {sync_err}")
    else:
        logger.warning("No observations were scraped.")

    return job_stats



def main():
    parser = argparse.ArgumentParser(description="AirIndex India Scraper Orchestrator")
    parser.add_argument(
        "--source",
        nargs="+",
        default=["google_flights"],
        choices=["google_flights"],
        help="Data source to scrape (google_flights)",
    )
    parser.add_argument(
        "--routes",
        nargs="+",
        default=["all"],
        help="Route codes to scrape (or 'all' for all 52+ corridors)",
    )
    parser.add_argument(
        "--cluster",
        type=str,
        default=None,
        help="Filter routes by cluster (e.g., 'Metro Trunk', 'Leisure & Tourist')",
    )
    parser.add_argument(
        "--windows",
        nargs="+",
        default=["T+1", "T+7"],
        help="Booking windows to scrape (e.g., T+1 T+7 T+15 T+30)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry run without initiating live Google Flights scraping",
    )

    args = parser.parse_args()

    loop = asyncio.get_event_loop()
    results = loop.run_until_complete(
        run_scraping_job(
            sources=args.source,
            routes=args.routes,
            windows=args.windows,
            dry_run=args.dry_run,
            cluster=args.cluster,
        )
    )

    print("\n--- Scraping Job Summary ---")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
