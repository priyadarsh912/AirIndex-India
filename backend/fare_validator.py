"""
AirScope — Fare Validation & Quality Assessment Service
Implements:
- Price component arithmetic verification (base, taxes, surcharges, convenience & payment fees)
- Tolerance checks & fare discrepancy detection
- Quality assessment & flagging (data_quality_status, quality_flags)
- Availability state validation (AVAILABLE, SOLD_OUT, CANCELLED, etc.)
- Deterministic deduplication fingerprinting
"""

import hashlib
from typing import Dict, Any, List, Optional, Tuple

AVAILABILITY_STATUSES = {
    "AVAILABLE",
    "SOLD_OUT",
    "CANCELLED",
    "NOT_OPERATING",
    "NOT_LISTED",
    "SOURCE_ERROR",
    "CAPTCHA_BLOCKED",
    "UNKNOWN"
}

QUALITY_STATUSES = {
    "VALID",
    "PARTIAL",
    "INVALID",
    "UNAVAILABLE",
    "ERROR"
}


class FareValidator:
    """Validates fare quotes and computes component totals, differences, and quality flags."""

    TOLERANCE_INR = 1.0  # Max permitted discrepancy between component sum and total fare

    @staticmethod
    def generate_fingerprint(
        source: str,
        airline: str,
        flight_number: str,
        origin: str,
        destination: str,
        travel_date: str,
        cabin_class: str = "ECONOMY",
        fare_family: str = "UNKNOWN",
        timestamp: Optional[str] = None,
        bucket_minutes: int = 15
    ) -> str:
        """
        Creates a deterministic fingerprint guaranteeing that quotes for the same flight
        within the same observation window are deduplicated without losing legitimate price changes.
        """
        # Bucket timestamp to bucket_minutes (e.g., 15m)
        time_bucket = ""
        if timestamp:
            try:
                # Expecting ISO format 'YYYY-MM-DDTHH:MM:SS' or similar
                clean_ts = timestamp.replace("Z", "").replace("T", " ")
                parts = clean_ts.split(" ")
                date_part = parts[0]
                if len(parts) > 1:
                    time_part = parts[1]
                    h, m = int(time_part.split(":")[0]), int(time_part.split(":")[1])
                    bucket_m = (m // bucket_minutes) * bucket_minutes
                    time_bucket = f"{date_part} {h:02d}:{bucket_m:02d}"
                else:
                    time_bucket = date_part
            except Exception:
                time_bucket = str(timestamp)[:16]

        raw = (
            f"{str(source).strip().upper()}|"
            f"{str(airline).strip().upper()}|"
            f"{str(flight_number).strip().upper()}|"
            f"{str(origin).strip().upper()}|"
            f"{str(destination).strip().upper()}|"
            f"{str(travel_date).strip()}|"
            f"{str(cabin_class).strip().upper()}|"
            f"{str(fare_family).strip().upper()}|"
            f"{time_bucket}"
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def validate_and_assess_quality(cls, quote: Dict[str, Any]) -> Dict[str, Any]:
        """
        Performs full validation pipeline on a single raw quote or observation:
        1. Availability check
        2. Component calculation & difference check
        3. Quality flags assignment
        4. Overall data quality status assignment
        """
        flags: List[str] = []

        # 1. Availability Status
        raw_avail = str(quote.get("availability_status") or quote.get("status") or "AVAILABLE").upper()
        if raw_avail not in AVAILABILITY_STATUSES:
            raw_avail = "UNKNOWN"
        availability_status = raw_avail

        # 2. Extract Price Components
        total_fare = quote.get("total_fare")
        if total_fare is None and "price" in quote and quote.get("price") is not None:
            total_fare = quote.get("price")

        base_fare = quote.get("base_fare")
        taxes = quote.get("taxes")
        airline_surcharge = quote.get("airline_surcharge")
        convenience_fee = quote.get("convenience_fee")
        payment_fee = quote.get("payment_fee")
        other_fee = quote.get("other_fee") or quote.get("fees")

        displayed_fare = quote.get("displayed_fare")
        final_fare = quote.get("final_fare") or total_fare

        # Cast to float or None
        def to_optional_float(v):
            if v is None:
                return None
            try:
                val = float(v)
                return val if val >= 0 else None
            except (ValueError, TypeError):
                return None

        total_fare = to_optional_float(total_fare)
        base_fare = to_optional_float(base_fare)
        taxes = to_optional_float(taxes)
        airline_surcharge = to_optional_float(airline_surcharge)
        convenience_fee = to_optional_float(convenience_fee)
        payment_fee = to_optional_float(payment_fee)
        other_fee = to_optional_float(other_fee)
        displayed_fare = to_optional_float(displayed_fare)
        final_fare = to_optional_float(final_fare)

        # 3. Special handling for Unavailable States
        if availability_status == "SOLD_OUT":
            total_fare = None
            displayed_fare = None
            final_fare = None
            flags.append("SOLD_OUT")
        elif availability_status == "CANCELLED":
            total_fare = None
            displayed_fare = None
            final_fare = None
            flags.append("CANCELLED")
        elif availability_status in ["SOURCE_ERROR", "CAPTCHA_BLOCKED"]:
            total_fare = None
            flags.append("SOURCE_ERROR")

        # 4. Arithmetic Component Calculation
        component_parts = [base_fare, taxes, airline_surcharge, convenience_fee, payment_fee, other_fee]
        has_components = any(c is not None for c in component_parts)

        calculated_component_total = None
        fare_difference = None

        if has_components:
            calculated_component_total = sum(c for c in component_parts if c is not None)
            if total_fare is not None:
                fare_difference = round(abs(calculated_component_total - total_fare), 2)
                if fare_difference > cls.TOLERANCE_INR:
                    flags.append("TOTAL_FARE_MISMATCH")

        # 5. Component Disclosure Flags
        if availability_status == "AVAILABLE":
            if base_fare is None:
                flags.append("BASE_FARE_UNAVAILABLE")
            if taxes is None:
                flags.append("TAX_BREAKDOWN_UNAVAILABLE")
            if convenience_fee is None:
                flags.append("CONVENIENCE_FEE_NOT_DISCLOSED")
            if total_fare is None:
                flags.append("TOTAL_FARE_MISSING")

        # 6. Cabin & Fare Family Flags
        cabin_class = str(quote.get("cabin_class") or "UNKNOWN").upper()
        fare_family = str(quote.get("fare_family") or "UNKNOWN").upper()
        if cabin_class == "UNKNOWN":
            flags.append("FARE_CLASS_UNKNOWN")
        if fare_family == "UNKNOWN":
            flags.append("FARE_FAMILY_UNAVAILABLE")

        # 7. Overall Data Quality Status
        if availability_status in ["SOLD_OUT", "CANCELLED", "NOT_OPERATING"]:
            data_quality_status = "UNAVAILABLE"
        elif availability_status in ["SOURCE_ERROR", "CAPTCHA_BLOCKED"]:
            data_quality_status = "ERROR"
        elif "TOTAL_FARE_MISMATCH" in flags or "TOTAL_FARE_MISSING" in flags:
            data_quality_status = "INVALID"
        elif "TAX_BREAKDOWN_UNAVAILABLE" in flags or "CONVENIENCE_FEE_NOT_DISCLOSED" in flags or "FARE_CLASS_UNKNOWN" in flags:
            data_quality_status = "PARTIAL"
        else:
            data_quality_status = "VALID"

        # Quality score 0-100 for backward compatibility
        quality_score = 100
        if data_quality_status == "ERROR":
            quality_score = 0
        elif data_quality_status == "INVALID":
            quality_score = 25
        elif data_quality_status == "UNAVAILABLE":
            quality_score = 70  # Still valuable telemetry!
        elif data_quality_status == "PARTIAL":
            quality_score = 90
            if "TOTAL_FARE_MISMATCH" in flags:
                quality_score -= 30
            if "TAX_BREAKDOWN_UNAVAILABLE" in flags:
                quality_score -= 10
            if "CONVENIENCE_FEE_NOT_DISCLOSED" in flags:
                quality_score -= 5

        # Usable for Price Index
        # Must be AVAILABLE, have total_fare > 0, and not be INVALID or ERROR
        is_usable_for_index = (
            availability_status == "AVAILABLE"
            and total_fare is not None
            and total_fare > 0
            and data_quality_status in ["VALID", "PARTIAL"]
        )

        return {
            "availability_status": availability_status,
            "base_fare": base_fare,
            "taxes": taxes,
            "airline_surcharge": airline_surcharge,
            "convenience_fee": convenience_fee,
            "payment_fee": payment_fee,
            "other_fee": other_fee,
            "total_fare": total_fare,
            "displayed_fare": displayed_fare,
            "final_fare": final_fare,
            "calculated_component_total": calculated_component_total,
            "fare_difference": fare_difference,
            "data_quality_status": data_quality_status,
            "quality_flags": flags,
            "quality_score": max(0, min(100, quality_score)),
            "is_usable": is_usable_for_index,
        }
