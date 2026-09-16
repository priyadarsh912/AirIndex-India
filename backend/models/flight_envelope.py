# backend/models/flight_envelope.py
import hashlib
from datetime import date, datetime
from typing import Optional, List, Dict, Any
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
    base_fare: float = Field(..., ge=0.0)
    statutory_taxes: float = Field(..., ge=0.0)
    user_development_fee: float = Field(default=0.0, ge=0.0)
    fuel_charge: float = Field(default=0.0, ge=0.0)
    total_price: float = Field(..., ge=0.0)
    currency: str = Field(default="INR")

    @model_validator(mode="after")
    def verify_arithmetic_integrity(self):
        computed = self.base_fare + self.statutory_taxes + self.user_development_fee + self.fuel_charge
        # Tolerance of +/- 2 INR for currency conversion rounding
        if abs(computed - self.total_price) > 2.0:
            raise ValueError(
                f"Arithmetic mismatch: Component sum ({computed}) != total_price ({self.total_price}). "
                "Pricing attributes are contaminated or misaligned."
            )
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
