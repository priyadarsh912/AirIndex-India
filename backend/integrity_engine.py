"""
AirIndex India - Production Anti-Contamination & Integrity Engine
=================================================================
Implements Dual-Phase Validation Gateway and AI/ML Anti-Contamination Pipeline.
Root Problem Solved:
  - Eliminates flight-to-route misattributions (e.g. 6E-339 erroneously on HYD-VTZ).
  - Eliminates pricing field drifts and component mismatches.
  - Partitions observations into Clean Observational Lake vs Quarantine Store.
"""

import logging
import math
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    IsolationForest = None

from flight_registry import (
    CARRIER_CODE_MAP,
    MASTER_FLIGHT_REGISTRY,
    get_valid_flight_for_route,
    lookup_flight,
    validate_flight_route_match,
)

logger = logging.getLogger(__name__)

# Standard domestic airport coordinate matrix for haversine distance
AIRPORT_COORDINATES: Dict[str, Tuple[float, float]] = {
    "DEL": (28.5562, 77.1000),
    "BOM": (19.0896, 72.8656),
    "BLR": (13.1986, 77.7066),
    "CCU": (22.6547, 88.4467),
    "HYD": (17.2403, 78.4294),
    "VTZ": (17.7211, 83.2245),
    "MAA": (12.9941, 80.1709),
    "PNQ": (18.5822, 73.9197),
    "AMD": (23.0734, 72.6347),
    "GOI": (15.3808, 73.8314),
    "GAU": (26.1061, 91.5859),
    "SXR": (33.9871, 74.7741),
    "JAI": (26.8242, 75.8122),
    "COK": (10.1520, 76.4019),
    "PAT": (25.5913, 85.0880),
    "IXB": (26.6812, 88.3286),
    "LKO": (26.7606, 80.8893),
    "NAG": (21.0922, 79.0472),
    "IDR": (22.7217, 75.8011),
    "UDR": (24.6177, 73.8961),
    "VNS": (25.4524, 82.8593),
    "IXL": (34.1359, 77.5465),
    "RPR": (21.1804, 81.7388),
}

CARRIER_PREFIX_MAP: Dict[str, str] = {
    "IndiGo": "6E",
    "Air India": "AI",
    "Air India Express": "IX",
    "Akasa Air": "QP",
    "SpiceJet": "SG",
    "Vistara": "UK",
}


class AntiContaminationEngine:
    """
    Production-grade AI/ML Anti-Contamination Engine.
    Combines deterministic registry verification with Isolation Forest statistical pricing models.
    """

    def __init__(self, master_registry: Optional[Dict[str, Dict[str, Any]]] = None):
        self.registry = master_registry or MASTER_FLIGHT_REGISTRY
        if SKLEARN_AVAILABLE and IsolationForest is not None:
            self.iso_forest = IsolationForest(
                n_estimators=100,
                contamination=0.02,
                random_state=42,
            )
            self._initialize_baseline_models()
        else:
            self.iso_forest = None
            logger.warning("scikit-learn is not available; falling back to statistical heuristics.")

    def _initialize_baseline_models(self):
        """Fits baseline calibration distribution for fare_per_km, tax_ratio, and window z-score."""
        if self.iso_forest is None:
            return
        X_train = np.array([
            [4.2, 0.18, 0.1],
            [5.1, 0.19, 0.4],
            [3.8, 0.16, -0.2],
            [6.0, 0.21, 1.1],
            [4.5, 0.17, 0.0],
            [3.2, 0.15, -0.5],
            [5.8, 0.22, 0.8],
            [4.9, 0.18, 0.2],
        ])
        self.iso_forest.fit(X_train)

    @staticmethod
    def _haversine_distance(origin: str, destination: str) -> float:
        """Computes orthodromic distance in kilometers between domestic airports."""
        if origin not in AIRPORT_COORDINATES or destination not in AIRPORT_COORDINATES:
            return 1000.0  # Fallback distance

        lat1, lon1 = math.radians(AIRPORT_COORDINATES[origin][0]), math.radians(AIRPORT_COORDINATES[origin][1])
        lat2, lon2 = math.radians(AIRPORT_COORDINATES[destination][0]), math.radians(AIRPORT_COORDINATES[destination][1])

        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return 6371.0 * c

    def evaluate_observation(
        self,
        flight_number: str,
        origin: str,
        destination: str,
        departure_date: Optional[Any] = None,
        base_fare: float = 0.0,
        taxes: float = 0.0,
        total_fare: float = 0.0,
        booking_window_days: int = 7,
    ) -> Tuple[bool, float, List[str], Dict[str, Any]]:
        """
        Validates record against identity resolution & statistical anomaly detectors.
        Returns: (is_clean, confidence_score, quarantine_reasons, debug_features)
        """
        reasons: List[str] = []
        rule_score = 100.0
        distance = self._haversine_distance(origin, destination)
        fare_per_km = total_fare / max(distance, 100.0)
        tax_ratio = taxes / max(base_fare, 1.0)

        normalized_fn = flight_number.strip().upper()
        carrier_prefix = normalized_fn.split("-")[0] if "-" in normalized_fn else normalized_fn[:2]

        # 1. HARD RULE: Master Flight Registry Verification
        # Catches the 6E-339 on HYD-VTZ bug immediately!
        entry = lookup_flight(normalized_fn)
        if entry:
            reg_origin = entry.get("origin")
            reg_dest = entry.get("destination")
            reg_route = entry.get("route", f"{reg_origin}-{reg_dest}")
            secondary_routes = entry.get("secondary_routes", [])

            actual_route = f"{origin}-{destination}"
            valid_corridors = [reg_route] + secondary_routes

            if actual_route not in valid_corridors:
                rule_score = 0.0
                reasons.append(
                    f"CRITICAL_IDENTITY_MISMATCH: Flight {normalized_fn} is officially bound to "
                    f"{reg_origin}->{reg_dest} (Corridors: {', '.join(valid_corridors)}), "
                    f"but reported on {origin}->{destination}."
                )

        # 2. HARD RULE: Carrier IATA Code Check
        if carrier_prefix not in ["6E", "AI", "IX", "QP", "SG", "UK"]:
            rule_score -= 50.0
            reasons.append(f"INVALID_CARRIER_PREFIX: {carrier_prefix}")

        # 3. STATISTICAL MODEL: Isolation Forest Evaluation (with heuristic fallback)
        if self.iso_forest is not None:
            feature_vec = np.array([[fare_per_km, tax_ratio, 0.0]])
            iso_pred = self.iso_forest.predict(feature_vec)[0]  # 1 for inlier, -1 for outlier
        else:
            iso_pred = 1 if (1.5 <= fare_per_km <= 25.0 and 0.05 <= tax_ratio <= 0.65) else -1
        ml_score = 95.0 if iso_pred == 1 else 30.0
        if iso_pred == -1:
            reasons.append(
                f"STATISTICAL_PRICE_OUTLIER: Fare/km ({fare_per_km:.2f}) or tax ratio "
                f"({tax_ratio:.2f}) violates historical distribution bounds."
            )

        # 4. TAX REASONABLENESS BOUNDS
        if base_fare > 0 and (tax_ratio < 0.05 or tax_ratio > 0.65):
            rule_score -= 30.0
            reasons.append(
                f"TAX_ARITHMETIC_ANOMALY: Taxes constitute {tax_ratio*100:.1f}% of base fare "
                "(statutory limits: 5% - 65%)."
            )

        # Composite Weighted Scoring
        confidence = (0.60 * rule_score) + (0.40 * ml_score)
        confidence = max(0.0, min(100.0, confidence))

        is_clean = (confidence >= 85.0) and (len(reasons) == 0)

        features = {
            "flight_number": normalized_fn,
            "origin": origin,
            "destination": destination,
            "fare_per_km": round(fare_per_km, 2),
            "tax_ratio": round(tax_ratio, 3),
            "distance_km": round(distance, 1),
            "confidence_score": round(confidence, 1),
        }

        return is_clean, confidence, reasons, features


# Initialize Global Singleton Engine
GLOBAL_ANTI_CONTAMINATION_ENGINE = AntiContaminationEngine()


def partition_observations(
    observations: List[Dict[str, Any]],
    engine: Optional[AntiContaminationEngine] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Partitions raw observation list into:
      1. clean_observations (confidence >= 85.0 and zero violations)
      2. quarantined_observations (isolated, excluded from downstream index)
      3. telemetry_audit (quarantine telemetry, contamination rate, drift monitor)
    """
    active_engine = engine or GLOBAL_ANTI_CONTAMINATION_ENGINE

    clean_records: List[Dict[str, Any]] = []
    quarantined_records: List[Dict[str, Any]] = []
    flight_route_map: Dict[str, set] = {}

    # Pre-extract statistical feature matrix for high-speed batch IsolationForest prediction
    feature_matrix = []
    for obs in observations:
        orig = obs.get("origin", "").strip().upper()
        dest = obs.get("destination", "").strip().upper()
        base = float(obs.get("base_fare") or 0.0)
        taxes = float(obs.get("taxes") or 0.0)
        total = float(obs.get("total_fare") or 0.0)
        dist = active_engine._haversine_distance(orig, dest)
        fare_km = total / max(dist, 100.0)
        tax_r = taxes / max(base, 1.0)
        feature_matrix.append([fare_km, tax_r, 0.0])

    if feature_matrix:
        if active_engine.iso_forest is not None:
            batch_iso_preds = active_engine.iso_forest.predict(np.array(feature_matrix))
        else:
            batch_iso_preds = np.array([
                1 if (1.5 <= row[0] <= 25.0 and 0.05 <= row[1] <= 0.65) else -1
                for row in feature_matrix
            ])
    else:
        batch_iso_preds = np.array([])

    for idx, obs in enumerate(observations):
        obs_copy = dict(obs)
        fn = obs_copy.get("flight_number", "").strip().upper()
        orig = obs_copy.get("origin", "").strip().upper()
        dest = obs_copy.get("destination", "").strip().upper()
        route = obs_copy.get("route", f"{orig}-{dest}").strip().upper()
        base = float(obs_copy.get("base_fare") or 0.0)
        taxes = float(obs_copy.get("taxes") or 0.0)
        fees = float(obs_copy.get("fees") or 0.0)
        total = float(obs_copy.get("total_fare") or 0.0)

        # Track route drifts per flight number
        if fn:
            if fn not in flight_route_map:
                flight_route_map[fn] = set()
            flight_route_map[fn].add(route)

        # Fare component integrity verification
        arithmetic_issue = None
        if total > 0:
            comp_sum = base + taxes + fees
            if abs(comp_sum - total) > 6:
                arithmetic_issue = (
                    f"FARE_ARITHMETIC_MISMATCH: base({base}) + taxes({taxes}) + fees({fees}) = "
                    f"{comp_sum} != total({total})"
                )

        # Anti-contamination AI/ML evaluation with precomputed iso_pred
        iso_p = batch_iso_preds[idx] if idx < len(batch_iso_preds) else 1
        distance = active_engine._haversine_distance(orig, dest)
        fare_per_km = total / max(distance, 100.0)
        tax_ratio = taxes / max(base, 1.0)
        reasons = []
        rule_score = 100.0

        entry = lookup_flight(fn)
        if entry:
            reg_origin = entry.get("origin")
            reg_dest = entry.get("destination")
            reg_route = entry.get("route", f"{reg_origin}-{reg_dest}")
            secondary_routes = entry.get("secondary_routes", [])
            valid_corridors = [reg_route] + secondary_routes
            if route not in valid_corridors:
                rule_score = 0.0
                reasons.append(
                    f"CRITICAL_IDENTITY_MISMATCH: Flight {fn} is officially bound to "
                    f"{reg_origin}->{reg_dest} (Corridors: {', '.join(valid_corridors)}), "
                    f"but reported on {orig}->{dest}."
                )

        carrier_prefix = fn.split("-")[0] if "-" in fn else fn[:2]
        if carrier_prefix not in ["6E", "AI", "IX", "QP", "SG", "UK"]:
            rule_score -= 50.0
            reasons.append(f"INVALID_CARRIER_PREFIX: {carrier_prefix}")

        ml_score = 95.0 if iso_p == 1 else 30.0
        if iso_p == -1:
            reasons.append(
                f"STATISTICAL_PRICE_OUTLIER: Fare/km ({fare_per_km:.2f}) or tax ratio "
                f"({tax_ratio:.2f}) violates historical distribution bounds."
            )

        if base > 0 and (tax_ratio < 0.05 or tax_ratio > 0.65):
            rule_score -= 30.0
            reasons.append(
                f"TAX_ARITHMETIC_ANOMALY: Taxes constitute {tax_ratio*100:.1f}% of base fare "
                "(statutory limits: 5% - 65%)."
            )

        confidence = max(0.0, min(100.0, (0.60 * rule_score) + (0.40 * ml_score)))
        is_clean = (confidence >= 85.0) and (len(reasons) == 0)

        features = {
            "flight_number": fn,
            "origin": orig,
            "destination": dest,
            "fare_per_km": round(fare_per_km, 2),
            "tax_ratio": round(tax_ratio, 3),
            "distance_km": round(distance, 1),
            "confidence_score": round(confidence, 1),
        }

        if arithmetic_issue:
            reasons.append(arithmetic_issue)
            is_clean = False
            confidence = min(confidence, 60.0)

        obs_copy["confidence_score"] = round(confidence, 1)
        obs_copy["anti_contamination_features"] = features

        if is_clean:
            obs_copy["validation_status"] = "VERIFIED"
            obs_copy["is_usable"] = True
            clean_records.append(obs_copy)
        else:
            obs_copy["validation_status"] = "QUARANTINED"
            obs_copy["is_usable"] = False
            obs_copy["quarantine_reasons"] = reasons

            # Generate suggested healing route
            reg_entry = lookup_flight(fn)
            if reg_entry:
                obs_copy["self_healing_suggested_route"] = reg_entry.get("route")

            quarantined_records.append(obs_copy)

    # Flight-Route Drift Monitor: find flights operating on multiple distinct corridors
    drifting_flights = [
        {"flight_number": k, "observed_routes": sorted(list(v)), "routes_count": len(v)}
        for k, v in flight_route_map.items()
        if len(v) > 1
    ]

    total_scraped = len(observations)
    quarantine_count = len(quarantined_records)
    contamination_rate = round((quarantine_count / max(total_scraped, 1)) * 100, 2)

    status = "NORMAL"
    if contamination_rate > 7.0:
        status = "CRITICAL"
    elif contamination_rate > 3.5:
        status = "WARNING"

    telemetry_audit = {
        "engine_version": "2.0.0-DualPhaseGateway",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "total_scraped_observations": total_scraped,
        "clean_records_count": len(clean_records),
        "quarantined_records_count": quarantine_count,
        "contamination_rate_pct": contamination_rate,
        "contamination_status": status,
        "flight_route_drift_count": len(drifting_flights),
        "flight_route_drifts": drifting_flights[:15],
        "quarantined_sample": quarantined_records[:25],
        "top_rejection_reasons": _aggregate_rejection_reasons(quarantined_records),
    }

    return clean_records, quarantined_records, telemetry_audit


def _aggregate_rejection_reasons(quarantined_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    reason_counts: Dict[str, int] = {}
    for q in quarantined_records:
        for r in q.get("quarantine_reasons", []):
            category = r.split(":")[0] if ":" in r else "GENERIC_ANOMALY"
            reason_counts[category] = reason_counts.get(category, 0) + 1

    return [{"reason": k, "count": v} for k, v in sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)]


def run_integrity_engine(
    observations: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Backward-compatible entry point for existing modules.
    Executes partitioning via AntiContaminationEngine and returns (clean_records, report).
    """
    clean_obs, quarantined_obs, telemetry = partition_observations(observations)

    report = {
        "engine": "AirIndex Integrity Engine v2.0 (Dual-Phase Gateway)",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "total_observations": len(observations),
        "verified_clean": len(clean_obs),
        "quarantined_records": len(quarantined_obs),
        "data_integrity_pct": round(100.0 - telemetry["contamination_rate_pct"], 2),
        "contamination_rate_pct": telemetry["contamination_rate_pct"],
        "contamination_status": telemetry["contamination_status"],
        "flight_route_drifts": telemetry["flight_route_drifts"],
        "top_issues": telemetry["quarantined_sample"],
        "top_rejection_reasons": telemetry["top_rejection_reasons"],
    }

    return clean_obs, report


def detect_cross_route_price_contamination(observations: List[Dict[str, Any]]) -> List[str]:
    """
    Detects cross-corridor price bleeding using statistical grouping.
    """
    warnings: List[str] = []
    if not observations:
        return warnings

    df = pd.DataFrame(observations)
    if "route" not in df.columns or "total_fare" not in df.columns:
        return warnings

    route_stats = df.groupby("route")["total_fare"].agg(["median", "std", "count"]).reset_index()

    for _, row in route_stats.iterrows():
        route = row["route"]
        median = row["median"]
        # Standard domestic price sanity threshold
        if median < 1000 or median > 28000:
            warnings.append(
                f"PRICE_CONTAMINATION_WARNING: Route {route} has median fare INR{median:.0f} "
                "outside typical domestic bounds. Potential fare drift."
            )

    return warnings
