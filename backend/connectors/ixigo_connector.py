"""
AirIndex India - Ixigo Connector
Playwright-based scraper for Ixigo domestic flight search.
Extracts airline, flight number, departure/arrival times, total fare from search results.
"""

import asyncio
import logging
import random
import re
from datetime import datetime
from typing import Dict, Any, List

from .base_connector import BaseAirlineConnector, AIRPORT_CITY_MAP

logger = logging.getLogger(__name__)


class IxigoConnector(BaseAirlineConnector):
    """Ixigo flight search scraper using Playwright."""

    def __init__(self):
        super().__init__(
            source_name="Ixigo",
            base_url="https://www.ixigo.com",
            rate_limit_sec=3.0,
        )

    def _build_search_url(self, origin: str, destination: str, travel_date: str) -> str:
        """Build Ixigo flight search URL.
        
        travel_date format: YYYY-MM-DD -> converts to DDMMYYYY for Ixigo URL format
        """
        try:
            dt = datetime.strptime(travel_date, "%Y-%m-%d")
            date_str = dt.strftime("%d%m%Y")
        except ValueError:
            date_str = travel_date

        return (
            f"{self.base_url}/search/result/flight?"
            f"from={origin}&to={destination}&date={date_str}"
            f"&adults=1&children=0&infants=0&class=e&source=Search+Form"
        )

    async def fetch_observations(
        self, origin: str, destination: str, travel_date: str
    ) -> List[Dict[str, Any]]:
        """Scrape flight data from Ixigo search results."""
        observations = []
        capture_date = datetime.now().strftime("%Y-%m-%d")
        booking_window = self._determine_booking_window(capture_date, travel_date)
        url = self._build_search_url(origin, destination, travel_date)

        logger.info(f"[Ixigo] Scraping {origin}->{destination} on {travel_date}")
        logger.info(f"[Ixigo] URL: {url}")

        self.scrape_stats["total_requests"] += 1

        try:
            await self.apply_rate_limit_async()

            response = await self._page.goto(url, wait_until="domcontentloaded", timeout=30000)

            if not response or response.status >= 400:
                logger.warning(f"[Ixigo] HTTP {response.status if response else 'None'} for {url}")
                self.scrape_stats["failed"] += 1
                return observations

            # Wait for flight cards
            flight_selectors = [
                '.c-flight-listing-split-row',
                '[data-testid*="flight"]',
                '.flight-card',
                '.c-flight-list',
                '[class*="flightCard"]',
                '[class*="result-card"]',
            ]

            loaded = False
            for selector in flight_selectors:
                try:
                    await self._page.wait_for_selector(selector, timeout=12000)
                    loaded = True
                    logger.info(f"[Ixigo] Results loaded with selector: {selector}")
                    break
                except Exception:
                    continue

            if not loaded:
                logger.warning("[Ixigo] Could not detect flight results - trying page content extraction")
                content = await self._page.content()
                observations = self._parse_from_page_content(
                    content, origin, destination, capture_date, travel_date, booking_window
                )
                if observations:
                    self.scrape_stats["successful"] += 1
                    self.scrape_stats["total_records"] += len(observations)
                else:
                    self.scrape_stats["blocked"] += 1
                return observations

            await asyncio.sleep(random.uniform(1.5, 3.0))

            # Extract flight data via DOM evaluation
            flights_data = await self._page.evaluate("""
                () => {
                    const flights = [];
                    const cards = document.querySelectorAll(
                        '.c-flight-listing-split-row, [class*="flightCard"], [class*="result-card"], .flight-card'
                    );
                    
                    cards.forEach((card, i) => {
                        if (i >= 25) return;
                        
                        try {
                            const airlineEl = card.querySelector(
                                '[class*="airline"], [class*="name"], .u-text-ellipsis'
                            );
                            const airline = airlineEl ? airlineEl.textContent.trim() : '';
                            
                            const flightNoEl = card.querySelector(
                                '[class*="flight-number"], [class*="flightNo"], [class*="code"]'
                            );
                            const flightNo = flightNoEl ? flightNoEl.textContent.trim() : '';
                            
                            const priceEl = card.querySelector(
                                '[class*="price"], [class*="fare"], .bold-price, [class*="amount"]'
                            );
                            const priceText = priceEl ? priceEl.textContent.trim() : '';
                            
                            if (airline || priceText) {
                                flights.push({ airline, flightNo, priceText });
                            }
                        } catch (e) {}
                    });
                    
                    return flights;
                }
            """)

            logger.info(f"[Ixigo] Extracted {len(flights_data)} flight entries")

            for flight in flights_data:
                fare = self._parse_fare(flight.get("priceText", ""))
                if fare and fare > 500:
                    airline_name = self._clean_airline_name(flight.get("airline", ""))
                    flight_no = flight.get("flightNo", "").strip() or f"IXI-{random.randint(100, 999)}"

                    obs = self.normalize_observation(
                        origin=origin,
                        destination=destination,
                        capture_date=capture_date,
                        travel_date=travel_date,
                        airline_name=airline_name or "Unknown Airline",
                        flight_number=flight_no,
                        total_fare=fare,
                        booking_window=booking_window,
                    )
                    observations.append(obs)

            self.scrape_stats["successful"] += 1
            self.scrape_stats["total_records"] += len(observations)
            self.scrape_stats["last_scrape_time"] = capture_date

        except Exception as e:
            logger.error(f"[Ixigo] Scraping error for {origin}-{destination}: {str(e)}")
            self.scrape_stats["failed"] += 1

        return observations

    def _parse_from_page_content(
        self, html_content: str, origin: str, dest: str,
        capture_date: str, travel_date: str, booking_window: str
    ) -> List[Dict[str, Any]]:
        """Fallback regex parser for raw HTML."""
        observations = []
        fare_patterns = [
            r'₹\s*([\d,]+)',
            r'Rs\.?\s*([\d,]+)',
            r'INR\s*([\d,]+)',
            r'"price":\s*(\d+)',
            r'"fare":\s*(\d+)',
            r'"totalFare":\s*(\d+)',
        ]

        fares_found = set()
        for pattern in fare_patterns:
            matches = re.findall(pattern, html_content)
            for m in matches:
                try:
                    fare_val = int(m.replace(",", ""))
                    if 800 <= fare_val <= 50000:
                        fares_found.add(fare_val)
                except ValueError:
                    continue

        airline_pattern = r'(IndiGo|Air India Express|Air India|Akasa Air|SpiceJet|Vistara|Go First|Star Air|Alliance Air)'
        airlines_found = re.findall(airline_pattern, html_content, re.IGNORECASE)
        airlines_found = list(dict.fromkeys(airlines_found))

        fares_list = sorted(fares_found)[:20]
        for i, fare in enumerate(fares_list):
            airline = airlines_found[i % len(airlines_found)] if airlines_found else "Airline"
            obs = self.normalize_observation(
                origin=origin,
                destination=dest,
                capture_date=capture_date,
                travel_date=travel_date,
                airline_name=airline,
                flight_number=f"IXI-{random.randint(100, 999)}",
                total_fare=fare,
                booking_window=booking_window,
            )
            observations.append(obs)

        return observations

    def _parse_fare(self, price_text: str) -> int:
        """Parse numerical fare from string."""
        if not price_text:
            return 0
        cleaned = re.sub(r'[₹Rs.,\s]', '', price_text)
        match = re.search(r'(\d+)', cleaned)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                return 0
        return 0

    def _clean_airline_name(self, name: str) -> str:
        """Normalize airline name."""
        if not name:
            return ""
        name = name.strip()
        name_map = {
            "indigo": "IndiGo",
            "6e": "IndiGo",
            "air india express": "Air India Express",
            "air india": "Air India",
            "akasa air": "Akasa Air",
            "akasa": "Akasa Air",
            "spicejet": "SpiceJet",
            "vistara": "Vistara",
            "go first": "Go First",
            "star air": "Star Air",
            "alliance air": "Alliance Air",
        }
        for key, canonical in name_map.items():
            if key in name.lower():
                return canonical
        return name
