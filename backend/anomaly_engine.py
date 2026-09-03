"""
AirIndex India - Anomaly & Surge Engine Module
Detects airfare anomalies and price surges against rolling 7-day baselines.
"""

import pandas as pd
from typing import List, Dict, Any

def detect_airfare_anomalies(cleaned_observations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Evaluates fare observations against rolling baseline to surface surge alerts.
    """
    if not cleaned_observations:
        return []

    df = pd.DataFrame(cleaned_observations)
    usable_df = df[df["is_usable"]].copy()

    if usable_df.empty:
        return []

    # Get latest capture date
    dates = sorted(usable_df["capture_date"].unique())
    latest_date = dates[-1]

    # Subset latest observations
    latest_df = usable_df[usable_df["capture_date"] == latest_date]
    # Baseline period: previous 7 days
    history_df = usable_df[(usable_df["capture_date"] < latest_date) & (usable_df["capture_date"] >= dates[max(0, len(dates)-8)])]

    if history_df.empty:
        history_df = usable_df

    # Calculate baseline rolling median per route and booking_window
    baseline = history_df.groupby(["route", "booking_window"])["total_fare"].median().reset_index()
    baseline.rename(columns={"total_fare": "baseline_median"}, inplace=True)

    # Merge with latest observations
    merged = pd.merge(latest_df, baseline, on=["route", "booking_window"], how="left")
    merged["baseline_median"] = merged["baseline_median"].fillna(merged["total_fare"])

    # Compute deviation %
    merged["deviation_pct"] = round(((merged["total_fare"] - merged["baseline_median"]) / merged["baseline_median"]) * 100.0, 1)

    # Filter for notable surges or price dips (deviation >= 12% or <= -15%)
    surges = merged[(merged["deviation_pct"] >= 12.0) | (merged["deviation_pct"] <= -15.0)].copy()

    anomalies = []
    event_id = 501

    for _, row in surges.iterrows():
        dev = row["deviation_pct"]
        if dev >= 20.0:
            severity = "HIGH"
        elif dev >= 12.0:
            severity = "MEDIUM"
        else:
            severity = "INFORMATIONAL"

        driver = "T+1 Short-Notice Booking Surge" if row["booking_window"] == "T+1" else (
            f"Demand Spurt on {row['route']} corridor" if dev > 0 else "Discount Fare Campaign"
        )

        anomalies.append({
            "event_id": f"SRG-{event_id}",
            "route": row["route"],
            "airline": row["airline"],
            "booking_window": row["booking_window"],
            "travel_date": row["travel_date"],
            "observed_price": round(float(row["total_fare"]), 2),
            "expected_price": round(float(row["baseline_median"]), 2),
            "deviation_pct": float(dev),
            "severity": severity,
            "driver": driver,
            "timestamp": row["timestamp"],
            "source": row["source"]
        })
        event_id += 1

    # Sort by highest severity & deviation %
    anomalies.sort(key=lambda x: abs(x["deviation_pct"]), reverse=True)
    return anomalies[:15] # Return top 15 alerts

if __name__ == "__main__":
    from data_generator import generate_fixture_dataset
    from quality_engine import process_data_quality
    data = generate_fixture_dataset(30)
    cleaned, _ = process_data_quality(data["raw_observations"])
    anomalies = detect_airfare_anomalies(cleaned)
    print(f"Detected {len(anomalies)} surge anomalies.")
