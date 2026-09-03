"""
AirIndex India - Scraper Orchestrator CLI
Runs Playwright connectors for MakeMyTrip and Ixigo across routes and booking windows.
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

from connectors.mmt_connector import MMTConnector
from connectors.ixigo_connector import IxigoConnector
from data_generator import ROUTES_CONFIG

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

    # Selected routes objects: expand 'all' to all 52 configured corridors
    if not routes or "all" in routes:
        route_objs = ROUTES_CONFIG
    else:
        route_objs = [r for r in ROUTES_CONFIG if r["code"] in routes]

    # Optional filter by cluster
    cluster_filter = kwargs.get("cluster")
    if cluster_filter:
        route_objs = [r for r in route_objs if r.get("cluster") == cluster_filter]

    logger.info(f"Target corridors count: {len(route_objs)} of {len(ROUTES_CONFIG)} total.")

    connectors = {}
    if "mmt" in sources or "all" in sources:
        connectors["MakeMyTrip"] = MMTConnector()
    if "ixigo" in sources or "all" in sources:
        connectors["Ixigo"] = IxigoConnector()

    for name, conn in connectors.items():
        try:
            logger.info(f"Initializing browser for {name}...")
            await conn.init_browser()

            for route in route_objs:
                origin, dest = route["code"].split("-")

                for window in windows:
                    days_offset = WINDOW_DAYS.get(window, 7)
                    travel_date = (today + timedelta(days=days_offset)).strftime("%Y-%m-%d")

                    logger.info(f"[{name}] Fetching {route['code']} for date {travel_date} ({window})")
                    try:
                        obs = await conn.fetch_observations(origin, dest, travel_date)
                        all_observations.extend(obs)
                        logger.info(f"[{name}] Collected {len(obs)} records for {route['code']} ({window})")
                    except Exception as e:
                        err_msg = f"Failed {name} {route['code']} ({window}): {str(e)}"
                        logger.error(err_msg)
                        job_stats["errors"].append(err_msg)

        finally:
            logger.info(f"Closing browser for {name}...")
            await conn.close_browser()

    # Save collected observations to JSON file
    job_stats["end_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    job_stats["total_records"] = len(all_observations)

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
    else:
        logger.warning("No observations were scraped.")

    return job_stats


def main():
    parser = argparse.ArgumentParser(description="AirIndex India Scraper Orchestrator")
    parser.add_argument(
        "--source",
        nargs="+",
        default=["all"],
        choices=["mmt", "ixigo", "all"],
        help="Data sources to scrape (mmt, ixigo, or all)",
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
        help="Dry run without initiating live Playwright scraping",
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
