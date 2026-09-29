"""
AirIndex India - Google Flights Scraper Module (fast-flights v3.0+)
"""

try:
    from backend.scraper.normalizer import (
        normalize_flight,
        normalize_flight_results,
        compute_observation_dedup_key,
    )
    from backend.scraper.google_flights import (
        scrape_route,
        scrape_and_normalize_route,
        scrape_time_series,
        GoogleFlightsScraper,
        DEFAULT_MONITORED_ROUTES,
        DEFAULT_BOOKING_WINDOWS,
    )
    from backend.scraper.scheduler import (
        FastFlightsScheduler,
        fast_flights_scheduler,
    )
except ImportError:
    from scraper.normalizer import (
        normalize_flight,
        normalize_flight_results,
        compute_observation_dedup_key,
    )
    from scraper.google_flights import (
        scrape_route,
        scrape_and_normalize_route,
        scrape_time_series,
        GoogleFlightsScraper,
        DEFAULT_MONITORED_ROUTES,
        DEFAULT_BOOKING_WINDOWS,
    )
    from scraper.scheduler import (
        FastFlightsScheduler,
        fast_flights_scheduler,
    )

__all__ = [
    "normalize_flight",
    "normalize_flight_results",
    "compute_observation_dedup_key",
    "scrape_route",
    "scrape_and_normalize_route",
    "scrape_time_series",
    "GoogleFlightsScraper",
    "FastFlightsScheduler",
    "fast_flights_scheduler",
    "DEFAULT_MONITORED_ROUTES",
    "DEFAULT_BOOKING_WINDOWS",
]
