import hashlib
import random
from datetime import datetime, timezone
from typing import List, Dict, Any
try:
    from backend.providers.base import FareProvider, FareQuote
    from backend.fee_deriver import derive_fare_components
except ImportError:
    from providers.base import FareProvider, FareQuote
    from fee_deriver import derive_fare_components

CARRIERS = [
    ("IndiGo", "6E"),
    ("Air India", "AI"),
    ("Vistara", "UK"),
    ("SpiceJet", "SG"),
    ("Akasa Air", "QP"),
]

ROUTE_BASE_PRICES = {
    ("DEL", "BOM"): 4800,
    ("BOM", "DEL"): 4800,
    ("DEL", "BLR"): 5400,
    ("BLR", "DEL"): 5400,
    ("BOM", "BLR"): 4200,
    ("BLR", "BOM"): 4200,
    ("DEL", "HYD"): 5000,
    ("HYD", "DEL"): 5000,
    ("DEL", "MAA"): 5800,
    ("MAA", "DEL"): 5800,
    ("DEL", "CCU"): 5200,
    ("CCU", "DEL"): 5200,
    ("BOM", "GOI"): 3600,
    ("GOI", "BOM"): 3600,
}


class FixtureProvider(FareProvider):
    """
    Deterministic synthetic fixture provider used when SERPAPI_KEY is not present
    or when explicit fixture baseline is requested.
    """

    @property
    def name(self) -> str:
        return "Synthetic_Fixture"

    @property
    def source_type(self) -> str:
        return "FIXTURE"

    def fetch(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        lead_days: int = 7,
        cabin: str = "ECONOMY"
    ) -> List[Dict[str, Any]]:
        orig = origin.upper()
        dest = destination.upper()
        norm_cabin = cabin.upper()

        # Seed deterministically by route + departure_date + lead_days
        seed_str = f"{orig}_{dest}_{departure_date}_{lead_days}_{norm_cabin}"
        seed_int = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed_int)

        base_nominal = ROUTE_BASE_PRICES.get((orig, dest), 4600)

        # Lead day multiplier: closer to departure = more expensive
        lead_mult = 1.0
        if lead_days <= 1:
            lead_mult = 1.65
        elif lead_days <= 3:
            lead_mult = 1.35
        elif lead_days <= 7:
            lead_mult = 1.15
        elif lead_days <= 15:
            lead_mult = 1.0
        elif lead_days <= 30:
            lead_mult = 0.88
        else:
            lead_mult = 0.82

        cabin_mult = {
            "ECONOMY": 1.0,
            "PREMIUM_ECONOMY": 1.85,
            "BUSINESS": 3.4,
            "FIRST": 5.0
        }.get(norm_cabin, 1.0)

        now_utc = datetime.now(timezone.utc)
        quotes: List[Dict[str, Any]] = []

        # Generate 3 to 5 realistic flight quotes across carriers
        num_quotes = rng.randint(3, 5)
        selected_carriers = rng.sample(CARRIERS, min(num_quotes, len(CARRIERS)))

        for i, (carrier, code) in enumerate(selected_carriers):
            flight_num = f"{code}-{rng.randint(100, 999)}"
            carrier_bias = rng.uniform(0.92, 1.12)
            total_fare = round(base_nominal * lead_mult * cabin_mult * carrier_bias, -1)  # round to 10s
            stops = 0 if rng.random() > 0.15 else 1

            components = derive_fare_components(
                total_fare=total_fare,
                cabin=norm_cabin,
                origin=orig,
                destination=dest,
                currency="INR"
            )
            if not components or not components.get("is_valid"):
                continue

            quote = FareQuote(
                source=self.source_type,
                provider=self.name,
                origin=orig,
                destination=dest,
                carrier=carrier,
                flight_no=flight_num,
                departure_date=departure_date,
                lead_days=lead_days,
                cabin=norm_cabin,
                fare_class=f"{norm_cabin[:3]}-R" if norm_cabin != "ECONOMY" else "ECO-SAVER",
                base_fare=components["base_fare"],
                taxes_fees=components["taxes_fees"],
                fee_basis=components["fee_basis"],
                total_fare=components["total_fare"],
                currency="INR",
                is_available=True,
                stops=stops,
                quality_score=98.0,
                is_outlier=False,
                collected_at=now_utc,
            )
            quotes.append(quote.to_dict())

        return quotes
