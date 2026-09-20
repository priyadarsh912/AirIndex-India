try:
    from backend.providers.base import FareProvider, FareQuote
    from backend.providers.serpapi_provider import SerpApiGoogleFlightsProvider
    from backend.providers.fixture_provider import FixtureProvider
except ImportError:
    from providers.base import FareProvider, FareQuote
    from providers.serpapi_provider import SerpApiGoogleFlightsProvider
    from providers.fixture_provider import FixtureProvider

__all__ = [
    "FareProvider",
    "FareQuote",
    "SerpApiGoogleFlightsProvider",
    "FixtureProvider",
]
