"""
AirIndex India - Fare Providers Package
Google Flights via fast-flights v3.0 is the sole live data source.
"""

try:
    from backend.providers.base import FareProvider, FareQuote
    from backend.providers.fast_flights_provider import FastFlightsGoogleFlightsProvider
except ImportError:
    from providers.base import FareProvider, FareQuote
    from providers.fast_flights_provider import FastFlightsGoogleFlightsProvider

__all__ = [
    "FareProvider",
    "FareQuote",
    "FastFlightsGoogleFlightsProvider",
]
