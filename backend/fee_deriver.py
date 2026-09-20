import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
import pandas as pd

CONFIG_PATH = Path(__file__).resolve().parent / "config" / "fee_table.yaml"


def load_fee_table() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {
            "gst_rates": {"ECONOMY": 0.05, "BUSINESS": 0.12, "FIRST": 0.12, "PREMIUM_ECONOMY": 0.12, "UNKNOWN": 0.05},
            "aviation_security_fee": 236.0,
            "user_development_fees": {"default": 300.0},
            "fuel_surcharges": {"default": 400.0},
            "caps": {"max_tax_ratio": 0.45, "min_base_fare": 800.0}
        }
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


FEE_TABLE = load_fee_table()


def derive_fare_components(
    total_fare: float,
    cabin: str = "ECONOMY",
    origin: str = "",
    destination: str = "",
    reported_base: Optional[float] = None,
    reported_taxes: Optional[float] = None,
    currency: str = "INR"
) -> Optional[Dict[str, Any]]:
    """
    Validates and decomposes airfare into base_fare and taxes_fees.
    - If source provides reported_base and reported_taxes, verifies they match total_fare and sets fee_basis='reported'.
    - Otherwise, derives taxes and fees from the civil aviation fee table and sets fee_basis='derived'.
    - Returns None if total_fare is non-positive or currency is not INR.
    """
    if total_fare is None or total_fare <= 0:
        return None
    if currency and currency.upper() != "INR":
        return None

    norm_cabin = cabin.upper() if cabin else "ECONOMY"

    # If already reported by source
    if reported_base is not None and reported_taxes is not None and reported_base > 0:
        sum_components = reported_base + reported_taxes
        if abs(sum_components - total_fare) <= max(5.0, 0.02 * total_fare):
            return {
                "base_fare": round(float(reported_base), 2),
                "taxes_fees": round(float(reported_taxes), 2),
                "fee_basis": "reported",
                "total_fare": round(float(total_fare), 2),
                "currency": "INR",
                "is_valid": True
            }

    # Derive taxes and fees using Indian aviation rules
    gst_rate = FEE_TABLE.get("gst_rates", {}).get(norm_cabin, 0.05)
    asf = FEE_TABLE.get("aviation_security_fee", 236.0)
    udf_table = FEE_TABLE.get("user_development_fees", {})
    udf = udf_table.get(origin.upper(), udf_table.get("default", 300.0))
    fuel_surcharge = FEE_TABLE.get("fuel_surcharges", {}).get("default", 400.0)

    # Fixed fees
    fixed_fees = asf + udf + fuel_surcharge

    # total_fare = (base_fare * (1 + gst_rate)) + fixed_fees
    # base_fare = (total_fare - fixed_fees) / (1 + gst_rate)
    min_base = FEE_TABLE.get("caps", {}).get("min_base_fare", 800.0)
    max_tax_ratio = FEE_TABLE.get("caps", {}).get("max_tax_ratio", 0.45)

    if total_fare > fixed_fees + min_base:
        calc_base = (total_fare - fixed_fees) / (1.0 + gst_rate)
        calc_taxes = total_fare - calc_base
    else:
        # For lower fares, apply proportional tax cap
        calc_taxes = min(total_fare * max_tax_ratio, fixed_fees)
        calc_base = total_fare - calc_taxes

    # Ensure sanity checks
    calc_base = max(round(calc_base, 2), 100.0)
    calc_taxes = round(total_fare - calc_base, 2)

    return {
        "base_fare": calc_base,
        "taxes_fees": calc_taxes,
        "fee_basis": "derived",
        "total_fare": round(float(total_fare), 2),
        "currency": "INR",
        "is_valid": True
    }


def flag_outliers_iqr(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Applies IQR outlier detection per (origin, destination, lead_days, cabin).
    Only considers records that are available and have positive fares.
    Returns the list with is_outlier updated.
    """
    if not records:
        return []

    df = pd.DataFrame(records)
    if "is_outlier" not in df.columns:
        df["is_outlier"] = False

    group_cols = [c for c in ["origin", "destination", "lead_days", "cabin"] if c in df.columns]
    if len(group_cols) < 2:
        return df.to_dict(orient="records")

    for keys, group in df.groupby(group_cols):
        # Filter to available positive total_fare
        avail_mask = group.index[group["is_available"] == True] if "is_available" in group.columns else group.index
        fares = group.loc[avail_mask, "total_fare"].dropna()
        fares = fares[fares > 0]

        if len(fares) >= 4:
            q1 = float(np.percentile(fares, 25))
            q3 = float(np.percentile(fares, 75))
            iqr = q3 - q1
            lower_fence = max(0.0, q1 - 1.5 * iqr)
            upper_fence = q3 + 1.5 * iqr

            outliers = fares[(fares < lower_fence) | (fares > upper_fence)]
            if not outliers.empty:
                df.loc[outliers.index, "is_outlier"] = True

    return df.to_dict(orient="records")
