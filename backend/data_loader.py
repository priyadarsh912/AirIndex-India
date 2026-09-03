"""
AirIndex India - Scraped Data Loader Module
Reads and merges real-time scraped JSON observations from backend/scraped_data/
with base fixture data for index calculation and UI consumption.
"""

import os
import glob
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

SCRAPED_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraped_data")


def load_scraped_observations() -> List[Dict[str, Any]]:
    """Loads all JSON scraped observations from backend/scraped_data/ directory."""
    if not os.path.exists(SCRAPED_DATA_DIR):
        return []

    json_files = glob.glob(os.path.join(SCRAPED_DATA_DIR, "scrape_*.json"))
    if not json_files:
        return []

    all_observations = []
    seen_ids = set()

    # Sort files by creation time (newest first)
    json_files.sort(key=os.path.getmtime, reverse=True)

    for filepath in json_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                payload = json.load(f)
                observations = payload.get("observations", [])

                for obs in observations:
                    obs_id = obs.get("id")
                    if obs_id and obs_id not in seen_ids:
                        seen_ids.add(obs_id)
                        all_observations.append(obs)

        except Exception as e:
            logger.error(f"Error reading scraped data file {filepath}: {str(e)}")

    logger.info(f"Loaded {len(all_observations)} unique scraped observations from {len(json_files)} files.")
    return all_observations


def get_latest_scrape_metadata() -> Dict[str, Any]:
    """Retrieves metadata of the most recent scrape run."""
    if not os.path.exists(SCRAPED_DATA_DIR):
        return {"status": "NO_SCRAPES", "total_files": 0}

    json_files = glob.glob(os.path.join(SCRAPED_DATA_DIR, "scrape_*.json"))
    if not json_files:
        return {"status": "NO_SCRAPES", "total_files": 0}

    json_files.sort(key=os.path.getmtime, reverse=True)
    latest_file = json_files[0]

    try:
        with open(latest_file, "r", encoding="utf-8") as f:
            payload = json.load(f)
            meta = payload.get("metadata", {})
            meta["latest_file"] = os.path.basename(latest_file)
            meta["total_saved_files"] = len(json_files)
            meta["status"] = "AVAILABLE"
            return meta
    except Exception:
        return {"status": "ERROR_READING", "latest_file": os.path.basename(latest_file)}


def merge_scraped_with_fixture(
    fixture_observations: List[Dict[str, Any]],
    scraped_observations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Combines scraped real observations with fixture dataset.
    Prioritizes real scraped observations for the current date.
    """
    if not scraped_observations:
        return fixture_observations

    # Combine scraped + fixture
    combined = scraped_observations + fixture_observations
    return combined


if __name__ == "__main__":
    scraped = load_scraped_observations()
    print(f"Loaded {len(scraped)} scraped records.")
    print("Latest metadata:", get_latest_scrape_metadata())
