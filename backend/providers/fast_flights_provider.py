"""
AirIndex India - FastFlights Google Flights Provider
Implements FareProvider interface using the open fast-flights v3.0 package.
Requires no external paid API keys.
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

try:
    from backend.providers.base import FareProvider, FareQuote
    from backend.scraper.google_flights import scrape_route
    from backend.scraper.normalizer import normalize_flight
except ImportError:
    from providers.base import FareProvider, FareQuote
    from scraper.google_flights import scrape_route
    from scraper.normalizer import normalize_flight

logger = logging.getLogger("airscope.providers.fast_flights")


class FastFlightsGoogleFlightsProvider(FareProvider):
    """
    Live scraping FareProvider using fast-flights v3.0 to query Google Flights directly.
    Zero API key requirement, native rate-governed HTTP requests.
    """

    def __init__(self, currency: str = "INR"):
        self.currency = currency

    @property
    def name(self) -> str:
        return "FastFlights_GoogleFlights"

    @property
    def source_type(self) -> str:
        return "LIVE_SCRAPE"

    def is_configured(self) -> bool:
        """fast-flights does not require an API key; it is always configured if installed."""
        try:
            import fast_flights
            return True
        except ImportError:
            return False

    def fetch(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        lead_days: int = 7,
        cabin: str = "ECONOMY",
    ) -> List[Dict[str, Any]]:
        """
        Fetch quotes from Google Flights for a given origin, destination, and departure date.
        """
        now_utc = datetime.now(timezone.utc)
        try:
            results = scrape_route(
                origin=origin.upper(),
                destination=destination.upper(),
                travel_date=departure_date,
                cabin=cabin,
                currency=self.currency,
                max_stops=1,
            )
        except Exception as e:
            logger.error(f"[FastFlightsProvider] Failed to scrape {origin}->{destination}: {e}")
            raise

        quotes: List[Dict[str, Any]] = []

        for item in results:
            try:
                norm = normalize_flight(
                    flight_obj=item,
                    origin=origin.upper(),
                    destination=destination.upper(),
                    travel_date=departure_date,
                    lead_days=lead_days,
                    cabin=cabin,
                    currency=self.currency,
                    collected_at=now_utc,
                )

                if norm["total_fare"] <= 0:
                    continue

                quote = FareQuote(
                    source=self.source_type,
                    provider=self.name,
                    origin=norm["origin"],
                    destination=norm["destination"],
                    carrier=norm["airline"],
                    flight_no=norm["flight_number"],
                    departure_date=norm["departure_date"],
                    lead_days=norm["lead_days"],
                    cabin=norm["cabin"],
                    fare_class=norm.get("fare_class", cabin),
                    base_fare=norm["base_fare"],
                    taxes_fees=norm["taxes"],
                    fee_basis=norm["fee_basis"],
                    total_fare=norm["total_fare"],
                    currency=norm["currency"],
                    is_available=True,
                    stops=norm["stops"],
                    quality_score=norm["quality_score"],
                    is_outlier=False,
                    collected_at=now_utc,
                    dedup_key=norm["dedup_key"],
                )
                quotes.append(quote.to_dict())
            except Exception as fe:
                continue

        return quotes
