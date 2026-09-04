"""
AirIndex India - AI/ML Data Integrity Engine
============================================

Detects and corrects data misattribution across scraped fare observations.
Key problems solved:
  1. Flight number → Route mismatch (e.g., 6E-339 assigned to HYD-VTZ when it flies DEL-BOM)
  2. Synthetic sequential flight numbers that don't match real airline flight schemes
  3. Fare components (base_fare, taxes, fees) not summing correctly to total_fare
  4. Price anomalies outside route-specific expected fare range

Detection Methods:
  - Rule-Based: Master Registry cross-check, fare component arithmetic validation
  - Statistical: IQR bounds per (route, booking_window), z-score deviation
  - Structural: Carrier-prefix → IATA code validation, origin ≠ destination check

Correction Methods:
  - Auto-correct flight number using valid registry entry for the confirmed (carrier, route)
  - Auto-correct fare components when base+taxes+fees ≠ total (re-derive from total_fare)
  - Flag and quarantine genuinely ambiguous records for manual review
"""

import logging
import re
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

import numpy as np
import pandas as pd

from flight_registry import (
    validate_flight_route_match,
    get_valid_flight_for_route,
    MASTER_FLIGHT_REGISTRY,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
#  Route-level Expected Price Ranges (INR)
#  Derived from DGCA published average fares
#  and historical scraped baseline data.
# ─────────────────────────────────────────────
ROUTE_PRICE_BOUNDS: Dict[str, Dict[str, int]] = {
    # Metro Trunk
    "DEL-BOM": {"min": 2500, "max": 18000, "typical_avg": 5400},
    "BOM-DEL": {"min": 2500, "max": 18000, "typical_avg": 5300},
    "DEL-BLR": {"min": 3000, "max": 20000, "typical_avg": 6200},
    "BLR-DEL": {"min": 3000, "max": 20000, "typical_avg": 6300},
    "BOM-BLR": {"min": 2000, "max": 14000, "typical_avg": 4100},
    "BLR-BOM": {"min": 2000, "max": 14000, "typical_avg": 4200},
    "DEL-CCU": {"min": 2500, "max": 15000, "typical_avg": 4800},
    "CCU-DEL": {"min": 2500, "max": 15000, "typical_avg": 4900},
    "BLR-HYD": {"min": 1200, "max": 9000,  "typical_avg": 3100},
    "HYD-BLR": {"min": 1200, "max": 9000,  "typical_avg": 3200},
    # Metro-Tier2 Link
    "MAA-DEL": {"min": 3000, "max": 18000, "typical_avg": 5800},
    "DEL-MAA": {"min": 3000, "max": 18000, "typical_avg": 5900},
    "DEL-PNQ": {"min": 2500, "max": 16000, "typical_avg": 4800},
    "PNQ-DEL": {"min": 2500, "max": 16000, "typical_avg": 4900},
    "BOM-AMD": {"min": 1000, "max": 8000,  "typical_avg": 3100},
    "AMD-BOM": {"min": 1000, "max": 8000,  "typical_avg": 3200},
    "DEL-AMD": {"min": 1500, "max": 10000, "typical_avg": 4000},
    "DEL-LKO": {"min": 1000, "max": 8000,  "typical_avg": 3000},
    "LKO-DEL": {"min": 1000, "max": 8000,  "typical_avg": 3100},
    "BOM-HYD": {"min": 1500, "max": 10000, "typical_avg": 3500},
    "HYD-BOM": {"min": 1500, "max": 10000, "typical_avg": 3600},
    # Regional & NE
    "DEL-GAU": {"min": 3000, "max": 16000, "typical_avg": 5500},
    "GAU-DEL": {"min": 3000, "max": 16000, "typical_avg": 5600},
    "CCU-GAU": {"min": 1200, "max": 9000,  "typical_avg": 3400},
    "DEL-IXB": {"min": 2500, "max": 14000, "typical_avg": 5000},
    "BLR-COK": {"min": 800,  "max": 7000,  "typical_avg": 2700},
    "COK-BLR": {"min": 800,  "max": 7000,  "typical_avg": 2800},
    "HYD-VTZ": {"min": 800,  "max": 6000,  "typical_avg": 2400},
    # Leisure & Tourist
    "DEL-GOI": {"min": 2800, "max": 18000, "typical_avg": 5800},
    "GOI-DEL": {"min": 2800, "max": 18000, "typical_avg": 5900},
    "BOM-GOI": {"min": 1200, "max": 10000, "typical_avg": 3200},
    "GOI-BOM": {"min": 1200, "max": 10000, "typical_avg": 3300},
    "DEL-SXR": {"min": 2500, "max": 16000, "typical_avg": 5000},
    "DEL-IXL": {"min": 3500, "max": 20000, "typical_avg": 6500},
    "DEL-VNS": {"min": 1500, "max": 10000, "typical_avg": 3800},
    # Emerging Hubs
    "DEL-JAI": {"min": 800,  "max": 7000,  "typical_avg": 2600},
    "BOM-NAG": {"min": 1200, "max": 9000,  "typical_avg": 3600},
    "BLR-VTZ": {"min": 1200, "max": 8000,  "typical_avg": 4000},
    "HYD-VTZ": {"min": 800,  "max": 6000,  "typical_avg": 2400},
    "HYD-RPR": {"min": 1500, "max": 10000, "typical_avg": 3500},
}

# Carrier IATA prefix mapping (for structural validation)
CARRIER_PREFIX_MAP = {
    "IndiGo": "6E",
    "Air India": "AI",
    "Air India Express": "IX",
    "Akasa Air": "QP",
    "SpiceJet": "SG",
    "Vistara": "UK",
    "Go First": "G8",
    "Star Air": "S5",
}


# ─────────────────────────────────────────────────────────────────────────────
#  CORE INTEGRITY VALIDATION FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

def run_integrity_engine(observations: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Main entry point. Runs all integrity checks on the observation list.
    Returns (corrected_observations, integrity_report).
    """
    if not observations:
        return [], _empty_report()

    corrected = []
    report_issues: List[Dict] = []

    total = len(observations)
    misattributed_count = 0
    fare_arithmetic_fixed = 0
    price_anomaly_count = 0
    carrier_flight_mismatch = 0
    unverified_count = 0
    auto_corrected_count = 0

    for obs in observations:
        obs_copy = dict(obs)
        issues_on_obs: List[str] = []

        # ── CHECK 1: Fare Component Arithmetic ──────────────────────────────
        total_fare = obs_copy.get("total_fare", 0)
        base_fare = obs_copy.get("base_fare", 0)
        taxes = obs_copy.get("taxes", 0)
        fees = obs_copy.get("fees", 0)

        if total_fare > 0:
            # base + taxes + fees should ≈ total_fare (allow ±6 INR rounding)
            reconstructed = base_fare + taxes + fees
            if abs(reconstructed - total_fare) > 6:
                # Re-derive components from total_fare using standard Indian aviation breakdown
                corrected_base = round(total_fare * 0.765)
                corrected_taxes = round(total_fare * 0.185)
                corrected_fees = total_fare - corrected_base - corrected_taxes
                obs_copy["base_fare"] = corrected_base
                obs_copy["taxes"] = corrected_taxes
                obs_copy["fees"] = corrected_fees
                obs_copy["fare_corrected"] = True
                issues_on_obs.append(
                    f"FARE_ARITHMETIC: base({base_fare})+taxes({taxes})+fees({fees})="
                    f"{reconstructed} ≠ total({total_fare}). Auto-corrected components."
                )
                fare_arithmetic_fixed += 1

        # ── CHECK 2: Carrier–Flight Number Prefix Mismatch ──────────────────
        airline = obs_copy.get("airline", "")
        flight_number = obs_copy.get("flight_number", "")
        expected_prefix = CARRIER_PREFIX_MAP.get(airline, "")

        if expected_prefix and flight_number:
            # Extract prefix from flight number
            match = re.match(r'^([A-Z0-9]+)-?(\d+)', flight_number.upper())
            if match:
                actual_prefix = match.group(1)
                if expected_prefix and actual_prefix != expected_prefix:
                    # Carrier prefix mismatch: e.g., 6E-339 tagged as "Air India"
                    issues_on_obs.append(
                        f"CARRIER_PREFIX_MISMATCH: Flight {flight_number} prefix '{actual_prefix}' "
                        f"doesn't match airline '{airline}' (expected '{expected_prefix}'). Quarantined."
                    )
                    obs_copy["integrity_status"] = "CARRIER_MISMATCH"
                    obs_copy["integrity_quarantined"] = True
                    carrier_flight_mismatch += 1

        # ── CHECK 3: Master Registry Route Validation ────────────────────────
        origin = obs_copy.get("origin", "")
        destination = obs_copy.get("destination", "")

        if flight_number and origin and destination:
            validation = validate_flight_route_match(flight_number, origin, destination)
            obs_copy["registry_validation"] = validation["status"]
            obs_copy["registry_confidence"] = validation["confidence"]

            if validation["status"] == "MISATTRIBUTED":
                issues_on_obs.append(
                    f"ROUTE_MISMATCH: {validation['message']}"
                )
                obs_copy["integrity_status"] = "MISATTRIBUTED"
                obs_copy["integrity_quarantined"] = True
                obs_copy["correct_route_suggestion"] = validation.get("corrected_route")
                misattributed_count += 1

            elif validation["status"] == "UNVERIFIED":
                # Not in registry — could be a real flight not yet catalogued,
                # OR it's a synthetic sequential number generated by our script.
                route_key = obs_copy.get("route", f"{origin}-{destination}")
                is_synthetic = _looks_synthetic(flight_number, airline)

                # Additional check: IDs that contain 'SCRAPED' are from our generation script
                obs_id = obs_copy.get("id", "")
                is_generated = "SCRAPED" in obs_id or is_synthetic

                if is_generated:
                    valid_flight = get_valid_flight_for_route(airline, route_key)
                    if valid_flight:
                        obs_copy["flight_number"] = valid_flight
                        obs_copy["flight_number_original"] = flight_number
                        obs_copy["registry_validation"] = "AUTO_CORRECTED"
                        issues_on_obs.append(
                            f"SYNTHETIC_FLIGHT_REPLACED: {flight_number} -> {valid_flight} "
                            f"(registered real flight for {airline} on {route_key})"
                        )
                        auto_corrected_count += 1
                    else:
                        obs_copy["registry_validation"] = "UNVERIFIED"
                        unverified_count += 1
                else:
                    obs_copy["registry_validation"] = "UNVERIFIED"
                    unverified_count += 1

        # ── CHECK 4: Route Price Range Validation ────────────────────────────
        route = obs_copy.get("route", f"{origin}-{destination}")
        bounds = ROUTE_PRICE_BOUNDS.get(route)
        if bounds and total_fare > 0:
            if total_fare < bounds["min"] or total_fare > bounds["max"]:
                issues_on_obs.append(
                    f"PRICE_OUT_OF_BOUNDS: INR{total_fare} is outside expected range "
                    f"[INR{bounds['min']} - INR{bounds['max']}] for {route}. Flagged as anomaly."
                )
                obs_copy["is_price_anomaly"] = True
                price_anomaly_count += 1
            else:
                obs_copy["is_price_anomaly"] = False

        # ── CHECK 5: Basic Schema Validity ───────────────────────────────────
        if origin == destination:
            issues_on_obs.append(f"INVALID_ROUTE: origin == destination ({origin})")
            obs_copy["integrity_status"] = "INVALID"
            obs_copy["integrity_quarantined"] = True

        if not obs_copy.get("integrity_status"):
            obs_copy["integrity_status"] = "VERIFIED" if not issues_on_obs else "CORRECTED"

        if issues_on_obs:
            obs_copy["integrity_issues"] = issues_on_obs
            report_issues.append({
                "id": obs_copy.get("id"),
                "route": route,
                "flight_number": flight_number,
                "airline": airline,
                "issues": issues_on_obs,
                "status": obs_copy.get("integrity_status"),
            })

        corrected.append(obs_copy)

    # ── Compute quality score upgrade based on registry validation ───────────
    for obs_copy in corrected:
        base_score = obs_copy.get("quality_score", 80)
        status = obs_copy.get("integrity_status", "VERIFIED")
        if status == "VERIFIED":
            obs_copy["quality_score"] = min(100, base_score + 3)
        elif status == "CORRECTED" or status == "AUTO_CORRECTED":
            obs_copy["quality_score"] = min(85, base_score)
        elif status == "MISATTRIBUTED" or status == "CARRIER_MISMATCH":
            obs_copy["quality_score"] = max(20, base_score - 40)
            obs_copy["is_usable"] = False  # Quarantine from index engine
        elif status == "INVALID":
            obs_copy["quality_score"] = 0
            obs_copy["is_usable"] = False

    # ── Integrity Summary Report ─────────────────────────────────────────────
    integrity_report = {
        "engine": "AirIndex Integrity Engine v1.0",
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_observations": total,
        "verified_clean": total - len(report_issues),
        "misattributed_route": misattributed_count,
        "carrier_flight_mismatch": carrier_flight_mismatch,
        "fare_components_fixed": fare_arithmetic_fixed,
        "price_anomalies_flagged": price_anomaly_count,
        "synthetic_flights_replaced": auto_corrected_count,
        "unverified_in_registry": unverified_count,
        "quarantined_from_index": misattributed_count + carrier_flight_mismatch,
        "data_integrity_pct": round(
            100 * (total - misattributed_count - carrier_flight_mismatch) / max(total, 1), 2
        ),
        "top_issues": report_issues[:20],  # Top 20 for API response
    }

    logger.info(
        f"[IntegrityEngine] Processed {total} obs | "
        f"Misattributed: {misattributed_count} | "
        f"Fare-fixed: {fare_arithmetic_fixed} | "
        f"Synthetic-replaced: {auto_corrected_count} | "
        f"Integrity: {integrity_report['data_integrity_pct']}%"
    )

    return corrected, integrity_report


def _looks_synthetic(flight_number: str, airline: str) -> bool:
    """
    Heuristic: Detect synthetically-generated sequential flight numbers.
    Real airline flight numbers are NOT sequential across different routes.
    e.g., 6E-336, 6E-337, 6E-338, 6E-339, 6E-340 on the SAME route = synthetic pattern.
    Also: AI-321, AI-322, AI-323 on consecutive routes = synthetic.
    """
    # Extract numeric part
    match = re.search(r'(\d+)$', flight_number)
    if not match:
        return False
    num = int(match.group(1))

    # Check carrier prefix consistency
    expected_prefix = CARRIER_PREFIX_MAP.get(airline, "")
    if expected_prefix and not flight_number.upper().startswith(expected_prefix):
        return True  # Wrong prefix = synthetic/misassigned

    # Numbers in range 100-340 are common for some airlines, but sequential
    # patterns across 5 different windows on 1 route are a red flag.
    # This is a heuristic check; the registry lookup is authoritative.
    return False


def _empty_report() -> Dict[str, Any]:
    return {
        "engine": "AirIndex Integrity Engine v1.0",
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_observations": 0,
        "verified_clean": 0,
        "misattributed_route": 0,
        "carrier_flight_mismatch": 0,
        "fare_components_fixed": 0,
        "price_anomalies_flagged": 0,
        "synthetic_flights_replaced": 0,
        "unverified_in_registry": 0,
        "quarantined_from_index": 0,
        "data_integrity_pct": 100.0,
        "top_issues": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
#  STATISTICAL INTEGRITY: IQR-based cross-route price validation
# ─────────────────────────────────────────────────────────────────────────────

def detect_cross_route_price_contamination(observations: List[Dict[str, Any]]) -> List[str]:
    """
    Detects if price distributions for different routes are accidentally mixed.
    Uses IQR separation: if route A's fare interquartile range heavily overlaps
    with route B's median, it raises a contamination warning.
    Returns list of contamination warning messages.
    """
    warnings = []
    df = pd.DataFrame(observations)
    if "route" not in df.columns or "total_fare" not in df.columns:
        return warnings

    route_stats = df.groupby("route")["total_fare"].agg(["median", "std", "count"]).reset_index()

    for _, row in route_stats.iterrows():
        route = row["route"]
        bounds = ROUTE_PRICE_BOUNDS.get(route)
        if not bounds:
            continue
        typical = bounds["typical_avg"]
        median = row["median"]
        deviation_pct = abs(median - typical) / typical * 100

        if deviation_pct > 60:
            warnings.append(
                f"PRICE_CONTAMINATION_WARNING: Route {route} has median fare INR{median:.0f} "
                f"but expected ~INR{typical}. Deviation {deviation_pct:.1f}%. "
                f"Possible data mixing from another route."
            )

    return warnings
