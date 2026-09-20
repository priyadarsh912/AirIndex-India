import os
import requests
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
try:
    from backend.providers.base import FareProvider, FareQuote
    from backend.fee_deriver import derive_fare_components
except ImportError:
    from providers.base import FareProvider, FareQuote
    from fee_deriver import derive_fare_components


class SerpApiGoogleFlightsProvider(FareProvider):
    """
    Live API provider using SerpApi Google Flights engine.
    Requires SERPAPI_KEY environment variable.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("SERPAPI_KEY") or os.getenv("SERP_API_KEY")

    @property
    def name(self) -> str:
        return "SerpApi_GoogleFlights"

    @property
    def source_type(self) -> str:
        return "LIVE_API"

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def fetch(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        lead_days: int = 7,
        cabin: str = "ECONOMY"
    ) -> List[Dict[str, Any]]:
        if not self.is_configured():
            raise ValueError("SERPAPI_KEY is not configured or invalid.")

        travel_class_map = {
            "ECONOMY": 1,
            "PREMIUM_ECONOMY": 2,
            "BUSINESS": 3,
            "FIRST": 4
        }
        travel_class = travel_class_map.get(cabin.upper(), 1)

        url = "https://serpapi.com/search"
        params = {
            "engine": "google_flights",
            "departure_id": origin.upper(),
            "arrival_id": destination.upper(),
            "outbound_date": departure_date,
            "currency": "INR",
            "gl": "in",
            "hl": "en",
            "type": 2,  # one-way
            "travel_class": travel_class,
            "api_key": self.api_key
        }

        resp = requests.get(url, params=params, timeout=20)
        if resp.status_code != 200:
            raise RuntimeError(f"SerpApi HTTP {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        error = data.get("error")
        if error:
            raise RuntimeError(f"SerpApi Error: {error}")

        now_utc = datetime.now(timezone.utc)
        quotes: List[Dict[str, Any]] = []

        flight_groups = []
        if "best_flights" in data and isinstance(data["best_flights"], list):
            flight_groups.extend(data["best_flights"])
        if "other_flights" in data and isinstance(data["other_flights"], list):
            flight_groups.extend(data["other_flights"])

        for item in flight_groups:
            price = item.get("price")
            if not price or float(price) <= 0:
                continue
            total_fare = float(price)

            flights_legs = item.get("flights", [])
            first_leg = flights_legs[0] if flights_legs else {}
            carrier = first_leg.get("airline") or item.get("airline") or "Unknown"
            flight_no = first_leg.get("flight_number") or item.get("flight_number") or f"{carrier[:2]}-000"
            stops = len(flights_legs) - 1 if flights_legs else 0

            # Derive components
            components = derive_fare_components(
                total_fare=total_fare,
                cabin=cabin,
                origin=origin,
                destination=destination,
                currency="INR"
            )
            if not components or not components.get("is_valid"):
                continue

            quote = FareQuote(
                source=self.source_type,
                provider=self.name,
                origin=origin.upper(),
                destination=destination.upper(),
                carrier=carrier,
                flight_no=flight_no,
                departure_date=departure_date,
                lead_days=lead_days,
                cabin=cabin.upper(),
                fare_class=first_leg.get("travel_class") or cabin,
                base_fare=components["base_fare"],
                taxes_fees=components["taxes_fees"],
                fee_basis=components["fee_basis"],
                total_fare=components["total_fare"],
                currency="INR",
                is_available=True,
                stops=stops,
                quality_score=95.0,
                is_outlier=False,
                collected_at=now_utc,
            )
            quotes.append(quote.to_dict())

        return quotes
