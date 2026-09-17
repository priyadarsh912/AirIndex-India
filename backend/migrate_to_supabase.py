"""
AirIndex India - Migration Script: Local Scraped JSON -> Supabase Database
Reads all local JSON files in backend/scraped_data/ and uploads records to Supabase.
"""

import os
import glob
import json
from db_client import save_observations_to_supabase, get_supabase_client

SCRAPED_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraped_data")

def run_migration():
    client = get_supabase_client()
    if not client:
        print("[Migration] Error: Could not connect to Supabase. Check SUPABASE_URL & SUPABASE_KEY.")
        return

    json_files = glob.glob(os.path.join(SCRAPED_DATA_DIR, "scrape_*.json"))
    print(f"[Migration] Found {len(json_files)} local JSON scrape files in {SCRAPED_DATA_DIR}.")

    all_obs = []
    for filepath in json_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = json.load(f)
                records = content.get("observations") or content.get("data") if isinstance(content, dict) else content
                if isinstance(records, list):
                    all_obs.extend(records)
        except Exception as e:
            print(f"[Migration] Error reading {filepath}: {e}")

    print(f"[Migration] Extracted total {len(all_obs)} flight fare observations.")
    if all_obs:
        success = save_observations_to_supabase(all_obs)
        if success:
            print("[Migration] COMPLETE! All local JSON observations successfully migrated to Supabase.")
        else:
            print("[Migration] Failed to insert some or all records into Supabase.")
    else:
        print("[Migration] No observation records found to migrate.")

if __name__ == "__main__":
    run_migration()
