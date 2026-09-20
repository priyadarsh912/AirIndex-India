from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any


@dataclass
class FareQuote:
    source: str  # 'LIVE_API', 'LIVE_SCRAPE', 'FIXTURE'
    provider: str  # e.g., 'SerpApi_GoogleFlights', 'Synthetic_Fixture'
    origin: str  # 3-letter IATA (DEL, BOM, etc.)
    destination: str
    carrier: str  # e.g., 'IndiGo', 'Air India'
    flight_no: str  # e.g., '6E-201'
    departure_date: str  # YYYY-MM-DD
    lead_days: int  # 1, 7, 15, 30, 45
    cabin: str = "ECONOMY"
    fare_class: Optional[str] = None
    base_fare: Optional[float] = None
    taxes_fees: Optional[float] = None
    fee_basis: str = "derived"  # 'reported', 'derived'
    total_fare: float = 0.0
    currency: str = "INR"
    is_available: bool = True
    stops: int = 0
    quality_score: float = 100.0
    is_outlier: bool = False
    collected_at: Optional[datetime] = None
    dedup_key: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if not d.get("collected_at"):
            d["collected_at"] = datetime.now(timezone.utc)
        return d


class FareProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def source_type(self) -> str:
        """Returns 'LIVE_API', 'FIXTURE', or 'LIVE_SCRAPE'."""
        pass

    @abstractmethod
    def fetch(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        lead_days: int = 7,
        cabin: str = "ECONOMY"
    ) -> List[Dict[str, Any]]:
        """Fetch quotes for a given route and departure date."""
        pass
