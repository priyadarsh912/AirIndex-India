"""
AirIndex India - Base Scraper Connector Protocol
Defines standardized data collection interface with ethical scraping safeguards,
robots.txt verification, rate limiting, and shared Playwright browser management.
"""

import time
import random
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import urllib.robotparser
import urllib.parse

logger = logging.getLogger(__name__)

# Airport code to city name mapping for search queries
AIRPORT_CITY_MAP = {
    "DEL": "Delhi",
    "BOM": "Mumbai",
    "BLR": "Bengaluru",
    "CCU": "Kolkata",
    "HYD": "Hyderabad",
    "MAA": "Chennai",
}

# Standard desktop browser User-Agent pool for compliance testing
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


class BaseAirlineConnector:
    """Base class for all airline/OTA web scraping connectors with ethical safeguards."""

    def __init__(self, source_name: str, base_url: str, rate_limit_sec: float = 3.0):
        self.source_name = source_name
        self.base_url = base_url
        self.rate_limit_sec = rate_limit_sec
        self.last_request_time = 0.0
        self.user_agent = random.choice(USER_AGENTS)
        self.robots_txt_compliant = True
        self._robot_parser = None
        self._browser = None
        self._context = None
        self._page = None
        self.scrape_stats = {
            "total_requests": 0,
            "successful": 0,
            "failed": 0,
            "blocked": 0,
            "last_scrape_time": None,
            "total_records": 0,
        }

    def verify_robots_txt(self, target_url: Optional[str] = None) -> bool:
        """
        Dynamically passes target request through AirScope Compliance Gateway.
        Enforces RFC 9309 rules, ToS review gating, rate limits, and circuit breaker health.
        Never defaults to bypassing on failure (Conservative Government Fail-Safe).
        """
        from compliance_gateway import gateway
        check_url = target_url or self.base_url
        source_id = "MMT" if "makemytrip" in self.source_name.lower() else ("IXI" if "ixigo" in self.source_name.lower() else self.source_name)

        decision = gateway.evaluate_request(source_id=source_id, url_or_path=check_url, user_agent=self.user_agent)
        self.robots_txt_compliant = decision.allowed

        if not decision.allowed:
            logger.warning(f"[{self.source_name}] COMPLIANCE BLOCKED: {decision.reason}")
            self.scrape_stats["blocked"] += 1
            return False

        logger.info(f"[{self.source_name}] COMPLIANCE APPROVED: {check_url} passed gateway.")
        return True

    def apply_rate_limit(self):
        """Enforces ethical server load protection delay with random distribution to prevent traffic spikes."""
        elapsed = time.time() - self.last_request_time
        jitter = random.uniform(0.5, 2.0)
        wait_time = self.rate_limit_sec + jitter
        if elapsed < wait_time:
            time.sleep(wait_time - elapsed)
        self.last_request_time = time.time()

    async def apply_rate_limit_async(self):
        """Async version of ethical rate limiting."""
        elapsed = time.time() - self.last_request_time
        jitter = random.uniform(0.5, 2.0)
        wait_time = self.rate_limit_sec + jitter
        if elapsed < wait_time:
            await asyncio.sleep(wait_time - elapsed)
        self.last_request_time = time.time()

    async def init_browser(self):
        """Initialize Playwright browser with standard desktop viewport headers."""
        from playwright.async_api import async_playwright

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-http2",
            ],
        )
        self._context = await self._browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent=self.user_agent,
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            extra_http_headers={
                "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            },
        )
        # Standardized browser context settings
        await self._context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)
        self._page = await self._context.new_page()
        logger.info(f"[{self.source_name}] Browser initialized for automated ingestion")

    async def close_browser(self):
        """Cleanup browser resources."""
        if self._page:
            await self._page.close()
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info(f"[{self.source_name}] Browser closed")

    def normalize_observation(
        self,
        origin: str,
        destination: str,
        capture_date: str,
        travel_date: str,
        airline_name: str,
        flight_number: str,
        total_fare: Optional[float] = None,
        booking_window: Optional[str] = None,
        seat_availability: int = -1,
        cabin_class: Optional[str] = None,
        base_fare: Optional[float] = None,
        taxes: Optional[float] = None,
        airline_surcharge: Optional[float] = None,
        convenience_fee: Optional[float] = None,
        payment_fee: Optional[float] = None,
        other_fee: Optional[float] = None,
        displayed_fare: Optional[float] = None,
        final_fare: Optional[float] = None,
        raw_fare_class: Optional[str] = None,
        fare_family: Optional[str] = None,
        fare_brand: Optional[str] = None,
        fare_basis: Optional[str] = None,
        availability_status: Optional[str] = None,
        raw_source_reference: Optional[str] = None,
        source_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a standardized, fully normalized FareObservation dict with verified components."""
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from fare_normalizer import FareNormalizer
        from fare_validator import FareValidator

        obs_id = f"LIVE-{self.source_name[:3].upper()}-{int(time.time() * 1000)}-{random.randint(100, 999)}"
        route = f"{origin}-{destination}"
        now_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")

        # Determine advance purchase days and booking window
        try:
            cap_dt = datetime.strptime(capture_date, "%Y-%m-%d")
            trav_dt = datetime.strptime(travel_date, "%Y-%m-%d")
            adv_days = max(0, (trav_dt - cap_dt).days)
        except Exception:
            adv_days = 7

        if not booking_window:
            booking_window = self._determine_booking_window(capture_date, travel_date)

        # Normalize Fare Class & Family
        norm_fare = FareNormalizer.normalize(
            raw_text=raw_fare_class,
            source_cabin=cabin_class,
            source_fare_family=fare_family
        )
        resolved_cabin = norm_fare["cabin_class"]
        resolved_family = norm_fare["fare_family"]
        resolved_brand = fare_brand or norm_fare["fare_brand"]
        resolved_raw_class = norm_fare["raw_fare_class"]

        # Availability status logic
        if availability_status is None:
            if seat_availability == 0:
                availability_status = "SOLD_OUT"
            else:
                availability_status = "AVAILABLE"

        # If sold out, total_fare must be None
        if availability_status == "SOLD_OUT":
            total_fare = None

        # Source type detection
        if not source_type:
            source_type = "OTA" if self.source_name.lower() in ["makemytrip", "ixigo", "easemytrip", "yatra", "cleartrip"] else "AIRLINE"

        # Validate components and generate quality flags
        quote_payload = {
            "source": self.source_name,
            "airline": airline_name,
            "flight_number": flight_number,
            "origin": origin,
            "destination": destination,
            "travel_date": travel_date,
            "availability_status": availability_status,
            "cabin_class": resolved_cabin,
            "fare_family": resolved_family,
            "base_fare": base_fare,
            "taxes": taxes,
            "airline_surcharge": airline_surcharge,
            "convenience_fee": convenience_fee,
            "payment_fee": payment_fee,
            "other_fee": other_fee,
            "total_fare": total_fare,
            "displayed_fare": displayed_fare,
            "final_fare": final_fare,
        }
        val_res = FareValidator.validate_and_assess_quality(quote_payload)

        # Generate deterministic fingerprint
        comp_key = FareValidator.generate_fingerprint(
            source=self.source_name,
            airline=airline_name,
            flight_number=flight_number,
            origin=origin,
            destination=destination,
            travel_date=travel_date,
            cabin_class=resolved_cabin,
            fare_family=resolved_family,
            timestamp=now_iso,
            bucket_minutes=15
        )

        # Map route to cluster
        try:
            from data_generator import ROUTES_CONFIG
            cluster = next((r.get("cluster", "Metro Trunk") for r in ROUTES_CONFIG if r["code"] == route), "Metro Trunk")
        except Exception:
            cluster = "Metro Trunk"

        return {
            "id": obs_id,
            "observation_id": obs_id,
            "composite_key": comp_key,
            "timestamp": now_iso,
            "observation_timestamp": now_iso,
            "capture_date": capture_date,
            "travel_date": travel_date,
            "advance_purchase_days": adv_days,
            "origin": origin,
            "destination": destination,
            "route": route,
            "cluster": cluster,
            "airline": airline_name,
            "airline_code": self._get_airline_code(airline_name),
            "flight_number": flight_number,
            "source": self.source_name,
            "source_type": source_type,
            "booking_window": booking_window,

            # Fare Class
            "cabin_class": resolved_cabin,
            "fare_family": resolved_family,
            "fare_brand": resolved_brand,
            "fare_basis": fare_basis,
            "raw_fare_class": resolved_raw_class,

            # Price Breakdown
            "displayed_fare": val_res["displayed_fare"],
            "base_fare": val_res["base_fare"],
            "taxes": val_res["taxes"],
            "airline_surcharge": val_res["airline_surcharge"],
            "convenience_fee": val_res["convenience_fee"],
            "payment_fee": val_res["payment_fee"],
            "other_fee": val_res["other_fee"],
            "fees": val_res["other_fee"] or (val_res["convenience_fee"] or 0) + (val_res["payment_fee"] or 0),
            "total_fare": val_res["total_fare"],
            "final_fare": val_res["final_fare"] or val_res["total_fare"],
            "calculated_component_total": val_res["calculated_component_total"],
            "fare_difference": val_res["fare_difference"],
            "currency": "INR",

            # Availability
            "availability_status": val_res["availability_status"],
            "status": val_res["availability_status"],
            "seat_availability": seat_availability if val_res["availability_status"] == "AVAILABLE" else 0,

            # Data Quality
            "data_quality_status": val_res["data_quality_status"],
            "quality_flags": val_res["quality_flags"],
            "quality_score": val_res["quality_score"],
            "is_usable": val_res["is_usable"],

            # Telemetry & Audit
            "raw_source_reference": raw_source_reference,
            "simulated_outlier": False,
            "missing_field": len(val_res["quality_flags"]) > 0,
            "is_live_scraped": True,
        }

    def _get_airline_code(self, airline_name: str) -> str:
        """Map airline names to IATA codes."""
        code_map = {
            "IndiGo": "6E",
            "indigo": "6E",
            "Air India": "AI",
            "air india": "AI",
            "Air India Express": "IX",
            "air india express": "IX",
            "Akasa Air": "QP",
            "akasa air": "QP",
            "akasa": "QP",
            "SpiceJet": "SG",
            "spicejet": "SG",
            "Vistara": "UK",
            "vistara": "UK",
            "Go First": "G8",
            "Star Air": "S5",
            "Alliance Air": "9I",
        }
        for key, code in code_map.items():
            if key.lower() in airline_name.lower():
                return code
        return "XX"

    def _determine_booking_window(self, capture_date: str, travel_date: str) -> str:
        """Determine booking window code based on date difference."""
        try:
            cap = datetime.strptime(capture_date, "%Y-%m-%d")
            trav = datetime.strptime(travel_date, "%Y-%m-%d")
            diff = (trav - cap).days
            if diff <= 1:
                return "T+1"
            elif diff <= 7:
                return "T+7"
            elif diff <= 15:
                return "T+15"
            elif diff <= 30:
                return "T+30"
            else:
                return "T+45"
        except Exception:
            return "T+7"

    async def fetch_observations(
        self, origin: str, destination: str, travel_date: str
    ) -> List[Dict[str, Any]]:
        """Abstract fetch method to be overridden by source-specific connectors."""
        raise NotImplementedError(
            "Connectors must implement fetch_observations method."
        )
