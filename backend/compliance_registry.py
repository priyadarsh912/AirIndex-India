"""
AirScope India - Source Compliance Registry
RFC 9309 Compliant Source Governance & Ethical Data Collection Registry.
Tracks per-source crawler policies, robots.txt status, Terms of Service review status,
rate limits, allowed/blocked paths, and circuit breaker health.
"""

import os
import json
import hashlib
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

REGISTRY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
REGISTRY_FILE = os.path.join(REGISTRY_DIR, "compliance_registry.json")


@dataclass
class SourceComplianceRecord:
    source_id: str
    source_name: str
    domain: str
    source_type: str  # OTA, AIRLINE_DIRECT, GDS, GOVT_PORTAL
    robots_url: str
    robots_status: str  # ALLOWED, RESTRICTED, CHECKING, FAILED, NOT_CHECKED
    robots_checked_at: Optional[str]
    robots_cache_expires_at: Optional[str]
    robots_content_hash: Optional[str]
    terms_url: str
    terms_review_status: str  # NOT_REVIEWED, REVIEW_REQUIRED, REVIEWED_ALLOWED, REVIEWED_RESTRICTED, API_ONLY, PROHIBITED
    terms_last_reviewed_at: Optional[str]
    collection_mode: str  # PERMITTED_WEB_COLLECTION, AUTHORIZED_API_ONLY, GOVERNMENT_FEED, PAUSED
    collection_status: str  # ACTIVE, PAUSED, RESTRICTED, API_ONLY, REVIEW_REQUIRED, DISABLED
    allowed_paths: List[str]
    blocked_paths: List[str]
    requests_per_minute: int
    requests_per_hour: int
    concurrency_limit: int
    cooldown_seconds: float
    last_compliance_check: Optional[str]
    compliance_notes: str
    circuit_breaker_failures: int = 0
    circuit_breaker_state: str = "CLOSED"  # CLOSED (healthy), OPEN (tripped), HALF_OPEN (probe)
    last_failure_timestamp: Optional[str] = None


DEFAULT_SOURCES: List[Dict[str, Any]] = [
    {
        "source_id": "MMT",
        "source_name": "MakeMyTrip",
        "domain": "makemytrip.com",
        "source_type": "OTA",
        "robots_url": "https://www.makemytrip.com/robots.txt",
        "robots_status": "ALLOWED",
        "robots_checked_at": "2026-09-20T00:00:00Z",
        "robots_cache_expires_at": "2026-09-21T00:00:00Z",
        "robots_content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "terms_url": "https://www.makemytrip.com/legal/user_agreement.html",
        "terms_review_status": "REVIEW_REQUIRED",
        "terms_last_reviewed_at": "2026-09-15T12:00:00Z",
        "collection_mode": "PERMITTED_WEB_COLLECTION",
        "collection_status": "ACTIVE",
        "allowed_paths": ["/flight/search", "/flights/", "/flights-schedule/"],
        "blocked_paths": ["/api/internal/", "/account/", "/profile/", "/checkout/payment/", "/admin/"],
        "requests_per_minute": 6,
        "requests_per_hour": 360,
        "concurrency_limit": 1,
        "cooldown_seconds": 10.0,
        "last_compliance_check": "2026-09-20T01:00:00Z",
        "compliance_notes": "Public flight search routes permitted under ethical sliding-window rate limit (1 req / 10s). ToS under periodic review; non-commercial statistical index use.",
        "circuit_breaker_failures": 0,
        "circuit_breaker_state": "CLOSED",
    },
    {
        "source_id": "IXI",
        "source_name": "Ixigo",
        "domain": "ixigo.com",
        "source_type": "OTA",
        "robots_url": "https://www.ixigo.com/robots.txt",
        "robots_status": "ALLOWED",
        "robots_checked_at": "2026-09-20T00:00:00Z",
        "robots_cache_expires_at": "2026-09-21T00:00:00Z",
        "robots_content_hash": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
        "terms_url": "https://www.ixigo.com/terms-of-use",
        "terms_review_status": "REVIEW_REQUIRED",
        "terms_last_reviewed_at": "2026-09-15T12:00:00Z",
        "collection_mode": "PERMITTED_WEB_COLLECTION",
        "collection_status": "ACTIVE",
        "allowed_paths": ["/search/result/flight", "/flights/"],
        "blocked_paths": ["/api/v1/auth/", "/booking/pay/", "/user/"],
        "requests_per_minute": 6,
        "requests_per_hour": 360,
        "concurrency_limit": 1,
        "cooldown_seconds": 10.0,
        "last_compliance_check": "2026-09-20T01:00:00Z",
        "compliance_notes": "Flight results endpoints allowed for search indexers; payment and auth paths strictly blocked.",
        "circuit_breaker_failures": 0,
        "circuit_breaker_state": "CLOSED",
    },
    {
        "source_id": "6E",
        "source_name": "IndiGo",
        "domain": "goindigo.in",
        "source_type": "AIRLINE_DIRECT",
        "robots_url": "https://www.goindigo.in/robots.txt",
        "robots_status": "ALLOWED",
        "robots_checked_at": "2026-09-20T00:00:00Z",
        "robots_cache_expires_at": "2026-09-21T00:00:00Z",
        "robots_content_hash": "9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
        "terms_url": "https://www.goindigo.in/terms-and-conditions.html",
        "terms_review_status": "REVIEW_REQUIRED",
        "terms_last_reviewed_at": "2026-09-10T10:00:00Z",
        "collection_mode": "PERMITTED_WEB_COLLECTION",
        "collection_status": "ACTIVE",
        "allowed_paths": ["/flight-search", "/flights/"],
        "blocked_paths": ["/booking/member/", "/api/pnr/", "/checkin/"],
        "requests_per_minute": 5,
        "requests_per_hour": 300,
        "concurrency_limit": 1,
        "cooldown_seconds": 12.0,
        "last_compliance_check": "2026-09-20T01:00:00Z",
        "compliance_notes": "Direct airline portal; strict 12s cooldown enforced to prevent carrier server load.",
        "circuit_breaker_failures": 0,
        "circuit_breaker_state": "CLOSED",
    },
    {
        "source_id": "AI",
        "source_name": "Air India",
        "domain": "airindia.com",
        "source_type": "AIRLINE_DIRECT",
        "robots_url": "https://www.airindia.com/robots.txt",
        "robots_status": "ALLOWED",
        "robots_checked_at": "2026-09-20T00:00:00Z",
        "robots_cache_expires_at": "2026-09-21T00:00:00Z",
        "robots_content_hash": "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
        "terms_url": "https://www.airindia.com/legal/terms-and-conditions",
        "terms_review_status": "REVIEW_REQUIRED",
        "terms_last_reviewed_at": "2026-09-10T10:00:00Z",
        "collection_mode": "PERMITTED_WEB_COLLECTION",
        "collection_status": "ACTIVE",
        "allowed_paths": ["/flights/", "/search"],
        "blocked_paths": ["/flying-returns/", "/manage-booking/", "/api/private/"],
        "requests_per_minute": 5,
        "requests_per_hour": 300,
        "concurrency_limit": 1,
        "cooldown_seconds": 12.0,
        "last_compliance_check": "2026-09-20T01:00:00Z",
        "compliance_notes": "National flag carrier; public fare query paths monitored with conservative pacing.",
        "circuit_breaker_failures": 0,
        "circuit_breaker_state": "CLOSED",
    },
    {
        "source_id": "QP",
        "source_name": "Akasa Air",
        "domain": "akasaair.com",
        "source_type": "AIRLINE_DIRECT",
        "robots_url": "https://www.akasaair.com/robots.txt",
        "robots_status": "ALLOWED",
        "robots_checked_at": "2026-09-20T00:00:00Z",
        "robots_cache_expires_at": "2026-09-21T00:00:00Z",
        "robots_content_hash": "33334444555566667777888899990000aaaabbbbccccddddeeeeffff00001111",
        "terms_url": "https://www.akasaair.com/terms",
        "terms_review_status": "REVIEW_REQUIRED",
        "terms_last_reviewed_at": "2026-09-12T09:00:00Z",
        "collection_mode": "PERMITTED_WEB_COLLECTION",
        "collection_status": "ACTIVE",
        "allowed_paths": ["/flight-search", "/book-flight"],
        "blocked_paths": ["/profile/", "/api/payment/"],
        "requests_per_minute": 6,
        "requests_per_hour": 360,
        "concurrency_limit": 1,
        "cooldown_seconds": 10.0,
        "last_compliance_check": "2026-09-20T01:00:00Z",
        "compliance_notes": "Direct carrier API / Web; respects rate limiting and disallows payment paths.",
        "circuit_breaker_failures": 0,
        "circuit_breaker_state": "CLOSED",
    },
    {
        "source_id": "SG",
        "source_name": "SpiceJet",
        "domain": "spicejet.com",
        "source_type": "AIRLINE_DIRECT",
        "robots_url": "https://www.spicejet.com/robots.txt",
        "robots_status": "RESTRICTED",
        "robots_checked_at": "2026-09-20T00:00:00Z",
        "robots_cache_expires_at": "2026-09-21T00:00:00Z",
        "robots_content_hash": "7777888899990000111122223333444455556666777788889999000011112222",
        "terms_url": "https://www.spicejet.com/terms",
        "terms_review_status": "REVIEWED_RESTRICTED",
        "terms_last_reviewed_at": "2026-09-14T11:00:00Z",
        "collection_mode": "PAUSED",
        "collection_status": "RESTRICTED",
        "allowed_paths": [],
        "blocked_paths": ["/"],
        "requests_per_minute": 0,
        "requests_per_hour": 0,
        "concurrency_limit": 0,
        "cooldown_seconds": 60.0,
        "last_compliance_check": "2026-09-20T01:00:00Z",
        "compliance_notes": "Carrier terms explicitly restrict automated scraping. Collection paused by compliance gate; requires bilateral MoSPI/DGCA data-sharing arrangement.",
        "circuit_breaker_failures": 0,
        "circuit_breaker_state": "OPEN",
    }
]


class SourceComplianceRegistry:
    """Singleton Registry managing source compliance records, persistence, and lookup."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SourceComplianceRegistry, cls).__new__(cls)
            cls._instance._init_registry()
        return cls._instance

    def _init_registry(self):
        os.makedirs(REGISTRY_DIR, exist_ok=True)
        self.sources: Dict[str, SourceComplianceRecord] = {}
        self.load_from_disk()

    def load_from_disk(self):
        """Loads registry from file or initializes defaults."""
        if os.path.exists(REGISTRY_FILE):
            try:
                with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    for item in raw_data:
                        rec = SourceComplianceRecord(**item)
                        self.sources[rec.source_id] = rec
                return
            except Exception as e:
                print(f"[ComplianceRegistry] Failed to read {REGISTRY_FILE}: {e}. Initializing defaults.")

        # Fallback to defaults
        self.sources = {}
        for item in DEFAULT_SOURCES:
            rec = SourceComplianceRecord(**item)
            self.sources[rec.source_id] = rec
        self.save_to_disk()

    def save_to_disk(self):
        """Saves current state to JSON file."""
        os.makedirs(REGISTRY_DIR, exist_ok=True)
        try:
            with open(REGISTRY_FILE, "w", encoding="utf-8") as f:
                data = [asdict(rec) for rec in self.sources.values()]
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[ComplianceRegistry] Failed to persist registry: {e}")

    def get_source(self, source_id: str) -> Optional[SourceComplianceRecord]:
        return self.sources.get(source_id)

    def get_source_by_domain(self, domain: str) -> Optional[SourceComplianceRecord]:
        clean_domain = domain.lower().replace("www.", "").strip()
        for src in self.sources.values():
            if src.domain.lower().replace("www.", "").strip() == clean_domain:
                return src
        return None

    def list_sources(self) -> List[SourceComplianceRecord]:
        return list(self.sources.values())

    def update_source_status(self, source_id: str, status: str, notes: Optional[str] = None) -> bool:
        if source_id not in self.sources:
            return False
        src = self.sources[source_id]
        src.collection_status = status
        if notes:
            src.compliance_notes = f"{notes} (Updated: {datetime.utcnow().isoformat()})"
        src.last_compliance_check = datetime.utcnow().isoformat()
        self.save_to_disk()
        return True

    def update_circuit_breaker(self, source_id: str, state: str, failures: int) -> bool:
        if source_id not in self.sources:
            return False
        src = self.sources[source_id]
        src.circuit_breaker_state = state
        src.circuit_breaker_failures = failures
        if state == "OPEN":
            src.collection_status = "RESTRICTED"
            src.last_failure_timestamp = datetime.utcnow().isoformat()
        elif state == "CLOSED":
            src.last_failure_timestamp = None
        self.save_to_disk()
        return True


# Global Singleton
registry = SourceComplianceRegistry()
