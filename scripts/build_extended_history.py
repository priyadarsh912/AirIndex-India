#!/usr/bin/env python3
"""
AirIndex India — Extended History Pre-generation & Cache Script
Generates a long-horizon synthetic dataset (default: 365 days / 52 weeks / 12 months)
using the project's consistent statistical econometric methodology in backend/data_generator.py,
and caches the result to a JSON file (default: backend/data/extended_history.json).

This ensures multi-week and 12-month views on the dashboard are honestly derived
from the uniform statistical generation process rather than hardcoded narrative arrays.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime

# Add backend to path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from data_generator import generate_fixture_dataset, get_server_today
from index_engine import compute_airfare_indexes


def build_extended_history(
    days_back: int = 365,
    output_path: str = None,
    end_date: str = None,
    compute_indexes: bool = True
) -> dict:
    """
    Generates and optionally caches extended synthetic flight observations.

    Parameters:
        days_back: Number of historical days to generate (default: 365).
        output_path: Target JSON file path (default: backend/data/extended_history.json).
        end_date: Optional explicit end date string YYYY-MM-DD.
        compute_indexes: If True, also pre-computes aggregate indexes.

    Returns:
        Dictionary containing metadata and generated fixture dataset.
    """
    if output_path is None:
        output_path = str(BACKEND_DIR / "data" / "extended_history.json")

    print(f"[AirIndex India] Generating {days_back}-day extended synthetic history...")
    t0 = time.time()
    fixture = generate_fixture_dataset(days_back=days_back, end_date=end_date)
    gen_time = time.time() - t0

    obs_count = len(fixture.get("raw_observations", []))
    benchmarks = fixture.get("dgca_benchmark", [])
    start_d = benchmarks[0]["date"] if benchmarks else "N/A"
    end_d = benchmarks[-1]["date"] if benchmarks else "N/A"

    print(f"[AirIndex India] Generated {obs_count:,} observations ({start_d} to {end_d}) in {gen_time:.2f}s")

    metadata = {
        "generated_at": datetime.now().isoformat(),
        "days_back": days_back,
        "start_date": start_d,
        "end_date": end_d,
        "total_observations": obs_count,
        "total_routes": len(fixture.get("routes", [])),
        "total_airlines": len(fixture.get("airlines", [])),
    }

    if compute_indexes and obs_count > 0:
        print("[AirIndex India] Pre-computing aggregate index trends (Weekly & Monthly)...")
        t1 = time.time()
        weekly_idx = compute_airfare_indexes(fixture["raw_observations"], frequency="Weekly")
        monthly_idx = compute_airfare_indexes(fixture["raw_observations"], frequency="Monthly")
        idx_time = time.time() - t1

        metadata["weekly_periods_count"] = len(weekly_idx.get("daily_trend", []))
        metadata["monthly_periods_count"] = len(monthly_idx.get("daily_trend", []))
        metadata["sample_weekly_labels"] = [p.get("date") for p in weekly_idx.get("daily_trend", [])[:4]]
        metadata["sample_monthly_labels"] = [p.get("date") for p in monthly_idx.get("daily_trend", [])]
        print(f"[AirIndex India] Index aggregation completed in {idx_time:.2f}s: "
              f"{metadata['weekly_periods_count']} weeks, {metadata['monthly_periods_count']} months")

    payload = {
        "metadata": metadata,
        "raw_observations": fixture["raw_observations"],
        "dgca_benchmark": fixture.get("dgca_benchmark", []),
        "routes": fixture.get("routes", []),
        "airlines": fixture.get("airlines", []),
        "windows": fixture.get("windows", []),
    }

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"[AirIndex India] Saving cached history to {output_path}...")
    t2 = time.time()
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    save_time = time.time() - t2

    file_size_mb = out_file.stat().st_size / (1024 * 1024)
    print(f"[AirIndex India] Saved successfully ({file_size_mb:.2f} MB in {save_time:.2f}s).")

    return payload


def main():
    parser = argparse.ArgumentParser(description="Pre-generate extended historical dataset for AirIndex India.")
    parser.add_argument("--days-back", type=int, default=365, help="Number of historical days to generate (default: 365)")
    parser.add_argument("--output", type=str, default=None, help="Output JSON path (default: backend/data/extended_history.json)")
    parser.add_argument("--end-date", type=str, default=None, help="Optional end date (YYYY-MM-DD)")
    parser.add_argument("--no-compute", action="store_true", help="Skip pre-computing aggregate index stats")

    args = parser.parse_args()
    build_extended_history(
        days_back=args.days_back,
        output_path=args.output,
        end_date=args.end_date,
        compute_indexes=not args.no_compute
    )


if __name__ == "__main__":
    main()
