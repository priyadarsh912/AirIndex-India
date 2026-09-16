"""
Script to retroactively apply the Dual-Phase Anti-Contamination Engine to all records in scrapedObservations.json
and output a verified zero-contamination clean dataset.
"""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from integrity_engine import partition_observations

INPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'src', 'data', 'scrapedObservations.json')
OUTPUT_CLEAN = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'src', 'data', 'scrapedObservations.json')
OUTPUT_QUARANTINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'src', 'data', 'quarantinedObservations.json')

if os.path.exists(INPUT):
    with open(INPUT, 'r', encoding='utf-8') as f:
        observations = json.load(f)

    print(f"Loaded {len(observations)} observations from {INPUT}")

    clean, quarantined, telemetry = partition_observations(observations)

    print("\n=== INTEGRITY SCAN RESULTS ===")
    print(f"Total observations:         {telemetry['total_scraped_observations']}")
    print(f"Verified clean pool:        {telemetry['clean_records_count']}")
    print(f"Quarantined records:        {telemetry['quarantined_records_count']}")
    print(f"Contamination rate:         {telemetry['contamination_rate_pct']}%")
    print(f"Contamination status:       {telemetry['contamination_status']}")
    print(f"Drifting flight alerts:     {telemetry['flight_route_drift_count']}")

    # Write clean verified data back to frontend
    with open(OUTPUT_CLEAN, 'w', encoding='utf-8') as f:
        json.dump(clean, f, indent=2, ensure_ascii=True)
    print(f"\nZero-contamination clean records written to {OUTPUT_CLEAN}")

    # Write quarantined records for audit trail
    with open(OUTPUT_QUARANTINE, 'w', encoding='utf-8') as f:
        json.dump(quarantined, f, indent=2, ensure_ascii=True)
    print(f"Quarantined records written to {OUTPUT_QUARANTINE}")
    print("Done!")
