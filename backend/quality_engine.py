"""
AirScope — Quality & Data Cleaning Engine
Implements schema validation, deduplication, IQR outlier detection,
availability analytics (available, sold-out, cancelled), and quality scoring.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
try:
    from fare_validator import FareValidator
    from fare_normalizer import FareNormalizer
except ImportError:
    from backend.fare_validator import FareValidator
    from backend.fare_normalizer import FareNormalizer


def process_data_quality(observations: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Cleans raw observations:
    - Deduplicates records
    - Applies FareNormalizer & FareValidator rules
    - Computes availability metrics (Available, Sold-Out, Cancelled, Errors)
    - Performs IQR outlier detection per (route, booking_window) on available fares
    - Flags price index usability
    """
    empty_stats = {
        "total": 0,
        "total_records": 0,
        "usable": 0,
        "usable_records": 0,
        "outliers": 0,
        "outlier_count": 0,
        "duplicates": 0,
        "duplicate_count": 0,
        "invalid": 0,
        "invalid_count": 0,
        "available_count": 0,
        "sold_out_count": 0,
        "cancelled_count": 0,
        "source_error_count": 0,
        "availability_rate_pct": 0.0,
        "sold_out_rate_pct": 0.0,
        "cancellation_rate_pct": 0.0,
        "valid_count": 0,
        "partial_count": 0,
        "avg_quality_score": 0.0,
    }

    if not observations:
        return [], empty_stats

    # Normalize each observation through FareValidator if needed
    normalized_list = []
    for obs in observations:
        item = dict(obs)
        if "data_quality_status" not in item or "quality_flags" not in item:
            val_res = FareValidator.validate_and_assess_quality(item)
            item["availability_status"] = val_res["availability_status"]
            item["status"] = val_res["availability_status"]
            item["data_quality_status"] = val_res["data_quality_status"]
            item["quality_flags"] = val_res["quality_flags"]
            item["calculated_component_total"] = val_res["calculated_component_total"]
            item["fare_difference"] = val_res["fare_difference"]
            existing_score = item.get("quality_score")
            item["quality_score"] = max(int(existing_score), val_res["quality_score"]) if existing_score is not None else val_res["quality_score"]
            item["total_fare"] = val_res["total_fare"]
            item["base_fare"] = val_res["base_fare"]
            item["taxes"] = val_res["taxes"]
        
        # Ensure cabin_class and fare_family exist
        if "cabin_class" not in item or "fare_family" not in item:
            nf = FareNormalizer.normalize(
                raw_text=item.get("raw_fare_class") or item.get("fare_class"),
                source_cabin=item.get("cabin_class")
            )
            item["cabin_class"] = nf["cabin_class"]
            item["fare_family"] = nf["fare_family"]
            item["fare_brand"] = nf["fare_brand"]

        normalized_list.append(item)

    df = pd.DataFrame(normalized_list)
    initial_count = len(df)

    # 1. Deduplication Check
    # Deduplicate by deterministic composite_key if available, else route/airline/flight/date/window
    if "composite_key" in df.columns and df["composite_key"].notna().any():
        df["is_duplicate"] = df.duplicated(subset=["composite_key"], keep="first")
    else:
        dup_cols = ["route", "airline", "flight_number", "capture_date", "booking_window"]
        existing_cols = [c for c in dup_cols if c in df.columns]
        df["is_duplicate"] = df.duplicated(subset=existing_cols, keep="first") if existing_cols else False

    duplicate_count = int(df["is_duplicate"].sum())

    # Keep non-duplicates for indexing
    clean_df = df[~df["is_duplicate"]].copy()

    # 2. Availability Breakdown
    status_series = clean_df["availability_status"].fillna(clean_df.get("status", "AVAILABLE")).str.upper()
    available_count = int((status_series == "AVAILABLE").sum())
    sold_out_count = int((status_series == "SOLD_OUT").sum())
    cancelled_count = int((status_series == "CANCELLED").sum())
    error_count = int((status_series.isin(["SOURCE_ERROR", "CAPTCHA_BLOCKED"])).sum())

    total_clean = len(clean_df)
    avail_rate = round((available_count / total_clean) * 100.0, 1) if total_clean > 0 else 0.0
    sold_out_rate = round((sold_out_count / total_clean) * 100.0, 1) if total_clean > 0 else 0.0
    cancel_rate = round((cancelled_count / total_clean) * 100.0, 1) if total_clean > 0 else 0.0

    # 3. IQR Outlier Detection per (route, booking_window) on AVAILABLE records
    clean_df["is_outlier"] = False
    clean_df["iqr_lower"] = 0.0
    clean_df["iqr_upper"] = 0.0
    outlier_indices = []

    for (route, bw), group in clean_df.groupby(["route", "booking_window"]):
        # Outlier detection only applies to AVAILABLE flights with valid positive numeric fares
        avail_group = group[(group["availability_status"] == "AVAILABLE") & group["total_fare"].notna()]
        valid_fares = pd.to_numeric(avail_group["total_fare"], errors="coerce").dropna().values
        valid_fares = valid_fares[valid_fares > 0]

        if len(valid_fares) >= 4:
            q1 = float(np.percentile(valid_fares, 25))
            q3 = float(np.percentile(valid_fares, 75))
            iqr = q3 - q1
            lower_bound = max(500.0, q1 - 1.5 * iqr)
            upper_bound = q3 + 1.5 * iqr

            clean_df.loc[group.index, "iqr_lower"] = round(lower_bound, 2)
            clean_df.loc[group.index, "iqr_upper"] = round(upper_bound, 2)

            outliers = avail_group[
                (avail_group["total_fare"] < lower_bound) | (avail_group["total_fare"] > upper_bound)
            ]
            outlier_indices.extend(outliers.index.tolist())

    clean_df.loc[outlier_indices, "is_outlier"] = True
    outlier_count = len(outlier_indices)

    # 4. Usable Flag for Price Index Engine:
    # Must be AVAILABLE, have total_fare > 0, not be an outlier, not duplicate,
    # and data_quality_status in ['VALID', 'PARTIAL'] with score >= 60.
    numeric_fare = pd.to_numeric(clean_df["total_fare"], errors="coerce")
    clean_df["is_usable"] = (
        (clean_df["availability_status"] == "AVAILABLE") &
        (numeric_fare.notna()) &
        (numeric_fare > 0) &
        (~clean_df["is_outlier"]) &
        (clean_df["quality_score"] >= 60)
    )

    usable_count = int(clean_df["is_usable"].sum())
    invalid_count = initial_count - usable_count

    # Data Quality status counts
    dq_series = clean_df["data_quality_status"].fillna("VALID").str.upper()
    valid_count = int((dq_series == "VALID").sum())
    partial_count = int((dq_series == "PARTIAL").sum())
    invalid_dq_count = int((dq_series == "INVALID").sum())

    stats = {
        "total": initial_count,
        "total_records": initial_count,
        "usable": usable_count,
        "usable_records": usable_count,
        "outliers": outlier_count,
        "outlier_count": outlier_count,
        "duplicates": duplicate_count,
        "duplicate_count": duplicate_count,
        "invalid": invalid_count,
        "invalid_count": invalid_count,
        "available_count": available_count,
        "sold_out_count": sold_out_count,
        "cancelled_count": cancelled_count,
        "source_error_count": error_count,
        "availability_rate_pct": avail_rate,
        "sold_out_rate_pct": sold_out_rate,
        "cancellation_rate_pct": cancel_rate,
        "valid_count": valid_count,
        "partial_count": partial_count,
        "invalid_dq_count": invalid_dq_count,
        "avg_quality_score": round(float(clean_df["quality_score"].mean()), 1) if not clean_df.empty else 100.0,
    }

    # Replace NaN/Infinity values with None/0 to ensure JSON compliance
    clean_df = clean_df.replace([np.nan, np.inf, -np.inf], None)
    processed_records = clean_df.to_dict(orient="records")
    return processed_records, stats
