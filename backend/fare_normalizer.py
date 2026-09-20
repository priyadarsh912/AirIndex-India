"""
AirScope — Reusable Fare Normalization Service
Normalizes raw fare class, cabin class, and fare family/brand from airline and OTA sources.
Follows strict rule: Never infer or guess. When uncertain, defaults to UNKNOWN.
"""

from typing import Dict, Any, Optional, Tuple

CABIN_CLASSES = {
    "ECONOMY",
    "PREMIUM_ECONOMY",
    "BUSINESS",
    "FIRST",
    "UNKNOWN"
}

FARE_FAMILIES = {
    "SAVER",
    "FLEXI",
    "REGULAR",
    "CORPORATE",
    "PREMIUM",
    "PROMO",
    "UNKNOWN"
}


class FareNormalizer:
    """Service to normalize raw fare strings and cabin descriptions into standardized taxonomy."""

    @staticmethod
    def normalize(
        raw_text: Optional[str] = None,
        source_cabin: Optional[str] = None,
        source_fare_family: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Normalizes raw fare and cabin inputs.
        
        Examples:
        - "Economy" -> cabin_class: ECONOMY, fare_family: UNKNOWN
        - "Economy Saver" -> cabin_class: ECONOMY, fare_family: SAVER, fare_brand: "Economy Saver"
        - "Business Flexi Plus" -> cabin_class: BUSINESS, fare_family: FLEXI, fare_brand: "Business Flexi Plus"
        - "RandomString" -> cabin_class: UNKNOWN, fare_family: UNKNOWN
        """
        raw_fare_class = (raw_text or "").strip()
        combined_text = f"{source_cabin or ''} {source_fare_family or ''} {raw_fare_class}".lower()

        # 1. Determine Cabin Class
        cabin_class = "UNKNOWN"
        if "premium economy" in combined_text or "prem economy" in combined_text or "premium eco" in combined_text:
            cabin_class = "PREMIUM_ECONOMY"
        elif "business" in combined_text or "biz" in combined_text:
            cabin_class = "BUSINESS"
        elif "first" in combined_text or "first class" in combined_text:
            cabin_class = "FIRST"
        elif "economy" in combined_text or "eco" in combined_text or "coach" in combined_text:
            cabin_class = "ECONOMY"
        elif source_cabin:
            norm_c = source_cabin.upper().replace(" ", "_")
            if norm_c in CABIN_CLASSES:
                cabin_class = norm_c

        # 2. Determine Fare Family
        fare_family = "UNKNOWN"
        if "saver" in combined_text or "supersaver" in combined_text or "super saver" in combined_text or "lite" in combined_text:
            fare_family = "SAVER"
        elif "flexi" in combined_text or "flex" in combined_text or "flexible" in combined_text:
            fare_family = "FLEXI"
        elif "corporate" in combined_text or "corp" in combined_text or "sme" in combined_text:
            fare_family = "CORPORATE"
        elif "promo" in combined_text or "sale" in combined_text:
            fare_family = "PROMO"
        elif "regular" in combined_text or "standard" in combined_text or "classic" in combined_text:
            fare_family = "REGULAR"
        elif source_fare_family:
            norm_f = source_fare_family.upper().replace(" ", "_")
            if norm_f in FARE_FAMILIES:
                fare_family = norm_f

        # 3. Fare Brand
        fare_brand = raw_fare_class if raw_fare_class else (
            f"{cabin_class.title()} {fare_family.title()}" if fare_family != "UNKNOWN" else cabin_class.title()
        )

        return {
            "cabin_class": cabin_class,
            "fare_family": fare_family,
            "fare_brand": fare_brand,
            "fare_basis": None,  # Populated when tariff booking code (e.g. 'R2IP') is available
            "raw_fare_class": raw_fare_class or None,
        }
