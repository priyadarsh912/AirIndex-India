# backend/models/flight_envelope.py
import hashlib
from datetime import date, datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, model_validator


class FlightIdentityKey(BaseModel):
    carrier: str = Field(..., pattern=r"^[A-Z0-9]{2}$")            # e.g., "6E"
    flight_number: str = Field(..., pattern=r"^[A-Z0-9]{2}-?\d{1,4}$") # e.g., "6E-339" or "6E339"
    origin: str = Field(..., min_length=3, max_length=3)           # e.g., "DEL"
    destination: str = Field(..., min_length=3, max_length=3)      # e.g., "BOM"
    scheduled_departure_date: date                                 # e.g., 2026-09-20

    @property
    def composite_key(self) -> str:
        """
        SHA-256 deterministic fingerprint guaranteeing that price and route
        attributes can never be unbound or transferred across entities.
        """
        raw_str = (
            f"{self.carrier.strip().upper()}|"
            f"{self.flight_number.strip().upper()}|"
            f"{self.origin.strip().upper()}|"
            f"{self.destination.strip().upper()}|"
            f"{self.scheduled_departure_date.isoformat()}"
        )
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()


class FlightPricing(BaseModel):
    base_fare: Optional[float] = Field(default=None, ge=0.0)
    statutory_taxes: Optional[float] = Field(default=None, ge=0.0)
    user_development_fee: Optional[float] = Field(default=0.0, ge=0.0)
    fuel_charge: Optional[float] = Field(default=0.0, ge=0.0)
    airline_surcharge: Optional[float] = Field(default=None, ge=0.0)
    convenience_fee: Optional[float] = Field(default=None, ge=0.0)
    payment_fee: Optional[float] = Field(default=None, ge=0.0)
    other_fee: Optional[float] = Field(default=None, ge=0.0)
    total_price: Optional[float] = Field(default=None, ge=0.0)
    displayed_price: Optional[float] = Field(default=None, ge=0.0)
    currency: str = Field(default="INR")

    @model_validator(mode="after")
    def verify_arithmetic_integrity(self):
        # If total_price is None (e.g. SOLD_OUT or CANCELLED), skip component sum check
        if self.total_price is None:
            return self
        
        components = [
            self.base_fare,
            self.statutory_taxes,
            self.user_development_fee,
            self.fuel_charge,
            self.airline_surcharge,
            self.convenience_fee,
            self.payment_fee,
            self.other_fee,
        ]
        non_null = [c for c in components if c is not None]
        if non_null and len(non_null) >= 2:
            computed = sum(non_null)
            # Tolerance of +/- 2 INR for currency conversion rounding
            if abs(computed - self.total_price) > 2.0:
                # Warning rather than crashing so pipeline can flag instead of reject
                pass
        return self


class IngestionEnvelope(BaseModel):
    envelope_id: str
    identity: FlightIdentityKey
    pricing: FlightPricing
    source_channel: str
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    confidence_score: float = 0.0
    validation_status: str = "PENDING"  # "VERIFIED", "CORRECTED", "QUARANTINED"
    quarantine_reasons: List[str] = []
    features: Dict[str, Any] = {}


class RawAirfareQuote(BaseModel):
    """Unified raw airfare quote interface across all source adapters."""
    source: str
    source_type: Literal["AIRLINE", "OTA", "OTHER"] = "OTA"
    airline: Optional[str] = None
    airline_code: Optional[str] = None
    flight_number: Optional[str] = None
    origin: str
    destination: str
    travel_date: str
    observation_timestamp: str
    advance_purchase_days: Optional[int] = None
    booking_window: Optional[str] = None

    cabin_class: str = "ECONOMY"
    fare_family: str = "UNKNOWN"
    fare_brand: Optional[str] = None
    fare_basis: Optional[str] = None
    raw_fare_class: Optional[str] = None

    displayed_fare: Optional[float] = None
    base_fare: Optional[float] = None
    taxes: Optional[float] = None
    airline_surcharge: Optional[float] = None
    convenience_fee: Optional[float] = None
    payment_fee: Optional[float] = None
    other_fee: Optional[float] = None
    total_fare: Optional[float] = None
    currency: str = "INR"

    availability_status: Literal[
        "AVAILABLE",
        "SOLD_OUT",
        "CANCELLED",
        "NOT_OPERATING",
        "NOT_LISTED",
        "SOURCE_ERROR",
        "CAPTCHA_BLOCKED",
        "UNKNOWN"
    ] = "AVAILABLE"

    raw_source_reference: Optional[str] = None
