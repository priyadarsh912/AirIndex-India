"""
AirIndex India - Quality & Data Cleaning Engine
Implements schema validation, deduplication, IQR outlier detection, and 0-100 quality scoring.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple

def process_data_quality(observations: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Cleans raw observations:
    - Deduplicates records
    - Calculates quality score (0-100)
    - Performs IQR outlier detection per (route, booking_window)
    - Evaluates data readiness statistics
    """
    if not observations:
        return [], {"total": 0, "usable": 0, "outliers": 0, "duplicates": 0, "invalid": 0}

    df = pd.DataFrame(observations)
    initial_count = len(df)
    
    # 1. Deduplication Check
    dup_cols = ["route", "airline", "flight_number", "capture_date", "booking_window", "total_fare"]
    df["is_duplicate"] = df.duplicated(subset=dup_cols, keep="first")
    duplicate_count = int(df["is_duplicate"].sum())
    
    # Keep non-duplicates for index engine
    clean_df = df[~df["is_duplicate"]].copy()
    
    # 2. Quality Score Calculation (0 - 100)
    def calculate_quality(row):
        score = 0
        if pd.notna(row.get("source")): score += 20
        if pd.notna(row.get("total_fare")) and row.get("total_fare") > 0: score += 20
        if pd.notna(row.get("base_fare")) and row.get("base_fare") > 0: score += 15
        if pd.notna(row.get("taxes")) and row.get("taxes") >= 0: score += 15
        if pd.notna(row.get("travel_date")): score += 10
        if pd.notna(row.get("airline")): score += 10
        if pd.notna(row.get("booking_window")): score += 10
        return score

    clean_df["quality_score"] = clean_df.apply(calculate_quality, axis=1)
    clean_df["quality_flag"] = clean_df["quality_score"].apply(
        lambda s: "EXCELLENT" if s >= 90 else ("GOOD" if s >= 80 else ("PARTIAL" if s >= 60 else "SUSPECT"))
    )
    
    # 3. IQR Outlier Detection per (route, booking_window)
    clean_df["is_outlier"] = False
    clean_df["iqr_lower"] = 0.0
    clean_df["iqr_upper"] = 0.0
    
    outlier_indices = []
    
    for (route, bw), group in clean_df.groupby(["route", "booking_window"]):
        valid_fares = group[group["total_fare"].notna()]["total_fare"].values
        if len(valid_fares) >= 4:
            q1 = np.percentile(valid_fares, 25)
            q3 = np.percentile(valid_fares, 75)
            iqr = q3 - q1
            lower_bound = max(500, q1 - 1.5 * iqr)
            upper_bound = q3 + 1.5 * iqr
            
            clean_df.loc[group.index, "iqr_lower"] = round(lower_bound, 2)
            clean_df.loc[group.index, "iqr_upper"] = round(upper_bound, 2)
            
            outliers = group[(group["total_fare"] < lower_bound) | (group["total_fare"] > upper_bound)]
            outlier_indices.extend(outliers.index.tolist())
            
    clean_df.loc[outlier_indices, "is_outlier"] = True
    outlier_count = len(outlier_indices)
    
    # 4. Usable Flag for Index Engine
    # Must have quality_score >= 70, not duplicate, not outlier, and status != 'SOLD_OUT'
    clean_df["is_usable"] = (
        (clean_df["quality_score"] >= 70) &
        (~clean_df["is_outlier"]) &
        (clean_df["status"] == "AVAILABLE")
    )
    
    usable_count = int(clean_df["is_usable"].sum())
    invalid_count = initial_count - usable_count
    
    stats = {
        "total_records": initial_count,
        "usable_records": usable_count,
        "outlier_count": outlier_count,
        "duplicate_count": duplicate_count,
        "invalid_count": invalid_count,
        "avg_quality_score": round(float(clean_df["quality_score"].mean()), 1)
    }
    
    # Replace NaN/Infinity values with None/0 to ensure JSON compliance
    clean_df = clean_df.replace([np.nan, np.inf, -np.inf], None)
    processed_records = clean_df.to_dict(orient="records")
    return processed_records, stats

if __name__ == "__main__":
    from data_generator import generate_fixture_dataset
    data = generate_fixture_dataset(30)
    cleaned, stats = process_data_quality(data["raw_observations"])
    print("Quality processing complete. Stats:", stats)
