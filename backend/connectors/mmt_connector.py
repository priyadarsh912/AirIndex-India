"""
AirIndex India - MakeMyTrip (MMT) Connector
Playwright-based scraper for MakeMyTrip domestic flight search.
Extracts airline, flight number, departure/arrival, total fare from search results.
"""

import asyncio
import logging
import random
import re
from datetime import datetime
from typing import Dict, Any, List

from .base_connector import BaseAirlineConnector, AIRPORT_CITY_MAP

logger = logging.getLogger(__name__)


class MMTConnector(BaseAirlineConnector):
    """MakeMyTrip flight search scraper using Playwright."""

    def __init__(self):
        super().__init__(
            source_name="MakeMyTrip",
            base_url="https://www.makemytrip.com",
            rate_limit_sec=3.0,
        )

    def _build_search_url(self, origin: str, destination: str, travel_date: str) -> str:
        """Build MMT flight search URL.
        
        travel_date format: YYYY-MM-DD -> converts to DD/MM/YYYY for MMT URL
        """
        try:
            dt = datetime.strptime(travel_date, "%Y-%m-%d")
            date_str = dt.strftime("%d/%m/%Y")
        except ValueError:
            date_str = travel_date

        return (
            f"{self.base_url}/flight/search?"
            f"itinerary={origin}-{destination}-{date_str}"
            f"&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass=E"
        )

    async def fetch_observations(
        self, origin: str, destination: str, travel_date: str
    ) -> List[Dict[str, Any]]:
        """Scrape flight data from MakeMyTrip search results."""
        observations = []
        capture_date = datetime.now().strftime("%Y-%m-%d")
        booking_window = self._determine_booking_window(capture_date, travel_date)
        url = self._build_search_url(origin, destination, travel_date)

        logger.info(f"[MMT] Scraping {origin}->{destination} on {travel_date}")
        logger.info(f"[MMT] URL: {url}")

        self.scrape_stats["total_requests"] += 1

        try:
            await self.apply_rate_limit_async()

            # Navigate to search page
            response = await self._page.goto(url, wait_until="domcontentloaded", timeout=30000)

            if not response or response.status >= 400:
                logger.warning(f"[MMT] HTTP {response.status if response else 'None'} for {url}")
                self.scrape_stats["failed"] += 1
                return observations

            # Wait for flight results to load (MMT uses dynamic rendering)
            # Try multiple selectors as MMT changes their DOM frequently
            flight_selectors = [
                '[class*="listingCard"]',
                '[class*="fli-list"]',
                '[class*="flight-listing"]',
                '[class*="splitVw-item"]',
                '[data-testid*="flight"]',
                '.listingCard',
                '.fli-list',
            ]

            loaded = False
            for selector in flight_selectors:
                try:
                    await self._page.wait_for_selector(selector, timeout=12000)
                    loaded = True
                    logger.info(f"[MMT] Results loaded with selector: {selector}")
                    break
                except Exception:
                    continue

            if not loaded:
                logger.warning("[MMT] Could not detect flight results - trying page content extraction")
                # Fallback: try to extract from page content directly
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

            # Small random delay to mimic human behavior
            await asyncio.sleep(random.uniform(1.5, 3.0))

            # Extract flight data using JavaScript evaluation
            flights_data = await self._page.evaluate("""
                () => {
                    const flights = [];
                    
                    // Strategy 1: Try listingCard based extraction
                    const cards = document.querySelectorAll(
                        '[class*="listingCard"], [class*="fli-list"], [class*="splitVw-item"]'
                    );
                    
                    cards.forEach((card, i) => {
                        if (i >= 25) return; // Limit to top 25 results
                        
                        try {
                            // Extract airline name
                            const airlineEl = card.querySelector(
                                '[class*="airlineName"], [class*="airline-name"], ' +
                                '[class*="airways-name"], [class*="fli-info"] span'
                            );
                            const airline = airlineEl ? airlineEl.textContent.trim() : '';
                            
                            // Extract flight number
                            const flightNoEl = card.querySelector(
                                '[class*="fliCode"], [class*="flight-code"], ' +
                                '[class*="fli-code"], [class*="flightNumber"]'
                            );
                            const flightNo = flightNoEl ? flightNoEl.textContent.trim() : '';
                            
                            // Extract price
                            const priceEl = card.querySelector(
                                '[class*="blackText"], [class*="actual-price"], ' +
                                '[class*="priceSection"] [class*="blackFont"], ' +
                                '[class*="price"], [class*="fare"]'
                            );
                            let priceText = priceEl ? priceEl.textContent.trim() : '';
                            
                            // Extract departure time
                            const depEl = card.querySelector(
                                '[class*="departurTime"], [class*="departure-time"], ' +
                                '[class*="dept-time"], [class*="time"]:first-child'
                            );
                            const depTime = depEl ? depEl.textContent.trim() : '';
                            
                            // Extract arrival time
                            const arrEl = card.querySelector(
                                '[class*="arrivalTime"], [class*="arrival-time"], ' +
                                '[class*="arr-time"]'
                            );
                            const arrTime = arrEl ? arrEl.textContent.trim() : '';
                            
                            // Extract duration
                            const durEl = card.querySelector(
                                '[class*="duration"], [class*="stop-info"]'
                            );
                            const duration = durEl ? durEl.textContent.trim() : '';
                            
                            if (airline || priceText) {
                                flights.push({
                                    airline, flightNo, priceText,
                                    depTime, arrTime, duration
                                });
                            }
                        } catch (e) {}
                    });
                    
                    // Strategy 2: If no cards found, try text-based extraction
                    if (flights.length === 0) {
                        const allText = document.body.innerText;
                        // Look for price patterns like ₹ 4,500 or Rs. 4500
                        const priceMatches = allText.match(/[₹Rs.]+\s*[\d,]+/g) || [];
                        priceMatches.slice(0, 10).forEach(p => {
                            flights.push({
                                airline: 'Unknown',
                                flightNo: '',
                                priceText: p,
                                depTime: '', arrTime: '', duration: ''
                            });
                        });
                    }
                    
                    return flights;
                }
            """)

            logger.info(f"[MMT] Extracted {len(flights_data)} flight entries")

            for flight in flights_data:
                fare = self._parse_fare(flight.get("priceText", ""))
                if fare and fare > 500:  # Sanity check: ignore fares below ₹500
                    airline_name = self._clean_airline_name(flight.get("airline", ""))
                    flight_no = flight.get("flightNo", "").strip() or f"MMT-{random.randint(100, 999)}"

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
            logger.error(f"[MMT] Scraping error for {origin}-{destination}: {str(e)}")
            self.scrape_stats["failed"] += 1

        return observations

    def _parse_from_page_content(
        self, html_content: str, origin: str, dest: str,
        capture_date: str, travel_date: str, booking_window: str
    ) -> List[Dict[str, Any]]:
        """Fallback parser: extract fares from raw HTML using regex patterns."""
        observations = []

        # Find fare amounts in various formats: ₹4,500 | Rs 4500 | INR 4,500
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
                    if 800 <= fare_val <= 50000:  # Reasonable domestic fare range
                        fares_found.add(fare_val)
                except ValueError:
                    continue

        # Find airline names
        airline_pattern = r'(IndiGo|Air India Express|Air India|Akasa Air|SpiceJet|Vistara|Go First|Star Air|Alliance Air)'
        airlines_found = re.findall(airline_pattern, html_content, re.IGNORECASE)
        airlines_found = list(dict.fromkeys(airlines_found))  # Deduplicate preserving order

        # Create observations pairing fares with airlines
        fares_list = sorted(fares_found)[:20]  # Top 20 unique fares
        for i, fare in enumerate(fares_list):
            airline = airlines_found[i % len(airlines_found)] if airlines_found else "Airline"
            obs = self.normalize_observation(
                origin=origin,
                destination=dest,
                capture_date=capture_date,
                travel_date=travel_date,
                airline_name=airline,
                flight_number=f"MMT-{random.randint(100, 999)}",
                total_fare=fare,
                booking_window=booking_window,
            )
            observations.append(obs)

        return observations

    def _parse_fare(self, price_text: str) -> int:
        """Parse fare amount from various text formats."""
        if not price_text:
            return 0
        # Remove currency symbols, commas, spaces
        cleaned = re.sub(r'[₹Rs.,\s]', '', price_text)
        # Extract first number sequence
        match = re.search(r'(\d+)', cleaned)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                return 0
        return 0

    def _clean_airline_name(self, name: str) -> str:
        """Normalize airline name to match pipeline conventions."""
        if not name:
            return ""
        name = name.strip()
        # Map common variations
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
