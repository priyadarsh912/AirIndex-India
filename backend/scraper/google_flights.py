"""
AirIndex India - Google Flights Scraper Service (v2, accuracy-focused)

Pipeline: fast-flights (primp) fetches the Google Flights page -> this module parses the
embedded `ds:*` JSON payload itself -> every itinerary is validated -> clean records.

What changed compared to the old version
----------------------------------------
* Reads BOTH result sections Google returns ("best"/top flights AND "other" flights).
  The stock fast-flights parser only reads one of them, so cheap/top options went missing.
* Finds the data <script class="ds:N"> by content, not by a hard-coded "ds:1".
* No fake defaults: the old parser silently used date 2026-01-01 and "carbon = 87000".
  Missing dates now fall back to the requested travel date / previous leg, never a made-up year.
* Price is read defensively, rejected when <= 0, checked against a per-cabin sane range and
  against the median of the same search (outlier flagging). Optional `samples` > 1 takes the
  median price over repeated fetches.
* Language is pinned to English + currency pinned, so airline/airport names and prices do not
  change with the server's IP location.
* "Today" is computed in IST (a UTC server would otherwise be one day off in the evenings).
* Returns EVERY itinerary Google lists for the search (all stops, best + other sections). Nothing
  is filtered out; rows that look odd are kept and flagged in `registry_validation`.
* Fare structure: {base_fare, taxes_and_fees, final_fare}. Google only publishes the FINAL fare, so
  final_fare is real; base/taxes are a labelled ESTIMATE (see estimate_fare_breakdown).
* Seats: only filled when Google's own payload contains an explicit "N seats left" label, otherwise
  None ("N/A"). Nothing is invented.
"""

import os
import sys

# Ensure backend and project root are in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
root_dir = os.path.dirname(backend_dir)
for p in [backend_dir, root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

import re
import json
import time
import random
import hashlib
import logging
import threading
import statistics
from datetime import datetime, date, time as dtime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple

try:
    from fast_flights import FlightQuery, Passengers, create_query, fetch_flights_html
except ImportError as e:
    raise ImportError(
        "fast-flights is required for Google Flights scraping. Install with: pip install fast-flights"
    ) from e

from selectolax.lexbor import LexborHTMLParser

logger = logging.getLogger("airscope.scraper.google_flights")

IST = timezone(timedelta(hours=5, minutes=30))
RAW_PROXIES = os.environ.get("AIRINDEX_PROXY_LIST") or os.environ.get("AIRINDEX_PROXY") or ""
PROXIES = [p.strip() for p in RAW_PROXIES.split(",") if p.strip()]
_proxy_idx = 0
_proxy_lock = threading.Lock()

DEBUG_DIR = os.environ.get("AIRINDEX_DEBUG_DIR") or None  # raw HTML is dumped here on parse failure
RAW_DUMP_DIR = os.environ.get("AIRINDEX_DUMP_RAW") or None  # ALWAYS dump html + parsed JSON here (for inspection)


def get_next_proxy() -> Optional[str]:
    global _proxy_idx
    if not PROXIES:
        return None
    with _proxy_lock:
        proxy = PROXIES[_proxy_idx % len(PROXIES)]
        _proxy_idx += 1
        return proxy


def today_ist() -> date:
    return datetime.now(IST).date()


# --------------------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------------------
DEFAULT_MONITORED_ROUTES = [
    {"origin": "DEL", "destination": "BOM"},
    {"origin": "DEL", "destination": "BLR"},
    {"origin": "DEL", "destination": "HYD"},
    {"origin": "DEL", "destination": "MAA"},
    {"origin": "BOM", "destination": "DEL"},
    {"origin": "BOM", "destination": "BLR"},
    {"origin": "BLR", "destination": "DEL"},
    {"origin": "BLR", "destination": "BOM"},
    {"origin": "CCU", "destination": "DEL"},
    {"origin": "DEL", "destination": "CCU"},
]
DEFAULT_BOOKING_WINDOWS = [1, 7, 15, 30, 45]

CABIN_MAP = {
    "ECONOMY": "economy",
    "PREMIUM_ECONOMY": "premium-economy",
    "PREMIUM-ECONOMY": "premium-economy",
    "BUSINESS": "business",
    "FIRST": "first",
}

# Sane INR one-way fare band per cabin (domestic-oriented). Fares outside are flagged.
FARE_BANDS_INR = {
    "economy": (800, 60_000),
    "premium-economy": (1_500, 100_000),
    "business": (3_000, 300_000),
    "first": (3_000, 400_000),
}

# Airports in the IST time zone (used only to sanity check duration vs clock times).
INDIA_AIRPORTS = {
    "DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "AMD", "PNQ", "GOI", "GOX", "COK", "JAI", "LKO",
    "GAU", "PAT", "IXC", "ATQ", "SXR", "IXB", "BBI", "NAG", "IDR", "VNS", "TRV", "IXR", "RPR",
    "BDQ", "IXJ", "IXL", "IXZ", "IMF", "DIB", "HBX", "CJB", "VTZ", "IXM", "UDR", "IXE", "JDH",
    "IXU", "BHO", "DED", "IXA", "AGR", "GWL", "TIR", "VGA", "RAJ", "STV", "BHU", "IXD", "KNU",
    "IXG", "AJL", "DMU", "IXS", "IXH", "BKB", "JLR", "TRZ", "SHL", "HGI", "PGH", "BHJ", "ISK",
}

# ---- Fare breakdown model (ESTIMATE ONLY - Google Flights exposes just the final fare) ----
# final = base(+fuel surcharge) + GST on that base + airport fees (PSF/UDF/ADF, not GST-able).
GST_RATE_BY_CABIN = {"economy": 0.05, "premium-economy": 0.12, "business": 0.12, "first": 0.12}
AIRPORT_FEES_INR: Dict[str, float] = {}      # per DEPARTURE airport; fill in real values, e.g. {"DEL": 500}
DEFAULT_AIRPORT_FEES_INR = 400.0            # placeholder used when the airport is not in the table

SEAT_LABEL_RE = re.compile(r"(\d{1,2})\s+seats?\s+(?:left|remaining)", re.I)
FLIGHT_NO_RE = re.compile(r"^[A-Z0-9]{2}-\d{1,4}[A-Z]?$")
IATA_RE = re.compile(r"^[A-Z]{3}$")


# --------------------------------------------------------------------------------------
# Low level helpers
# --------------------------------------------------------------------------------------
def _at(seq: Any, i: int, default: Any = None) -> Any:
    """Safe index access into Google's nested arrays."""
    try:
        v = seq[i]
        return default if v is None else v
    except (IndexError, TypeError, KeyError):
        return default


def _parse_hm(value: Any) -> Optional[Tuple[int, int]]:
    """Google drops zero components: [8] -> 08:00, [None, 31] -> 00:31."""
    if not isinstance(value, list):
        return None
    padded = [*value, None, None]
    h, m = (padded[0] or 0), (padded[1] or 0)
    if isinstance(h, int) and isinstance(m, int) and 0 <= h < 24 and 0 <= m < 60:
        return h, m
    return None


def _parse_ymd(value: Any) -> Optional[date]:
    if isinstance(value, (list, tuple)) and len(value) == 3 and all(isinstance(x, int) for x in value):
        try:
            return date(*value)
        except ValueError:
            return None
    return None


def _to_float_price(k: Any) -> Optional[float]:
    """Itinerary price lives at k[1][0][1]; reject anything that is not a positive number."""
    price = _at(_at(_at(k, 1, []), 0, []), 1)
    if isinstance(price, bool) or not isinstance(price, (int, float)):
        return None
    return float(price) if price > 0 else None


def _find_seats_left(node: Any) -> Optional[int]:
    """Return N only if the itinerary payload literally contains a '<N> seats left' label."""
    found: List[int] = []
    stack = [node]
    while stack:
        n = stack.pop()
        if isinstance(n, str):
            m = SEAT_LABEL_RE.search(n)
            if m:
                found.append(int(m.group(1)))
        elif isinstance(n, (list, tuple)):
            stack.extend(n)
        elif isinstance(n, dict):
            stack.extend(n.values())
    return min(found) if found else None


def estimate_fare_breakdown(total: Optional[float], origin: str, cabin: str, currency: str) -> Dict[str, Any]:
    """
    Split the (real) final fare into base + taxes. base + taxes == final exactly.
    This is an ESTIMATE: Google Flights never shows the split. Tune GST_RATE_BY_CABIN /
    AIRPORT_FEES_INR for better numbers, or replace with airline-actual data.
    """
    out: Dict[str, Any] = {
        "currency": currency,
        "base_fare": None,
        "taxes_and_fees": None,
        "final_fare": total,
        "tax_breakdown": {"gst": None, "airport_fees_psf_udf": None},
        "breakdown_type": "unavailable",
        "final_fare_source": "google_flights",
    }
    if total is None or currency != "INR":
        return out
    rate = GST_RATE_BY_CABIN.get(cabin, 0.05)
    fees = int(round(min(AIRPORT_FEES_INR.get(origin, DEFAULT_AIRPORT_FEES_INR), total * 0.5)))
    gst = int(round((total - fees) / (1 + rate) * rate))
    base = int(round(total)) - fees - gst
    out.update({
        "base_fare": float(base),
        "taxes_and_fees": float(fees + gst),
        "tax_breakdown": {"gst": float(gst), "airport_fees_psf_udf": float(fees)},
        "breakdown_type": "estimated",
    })
    return out


# --------------------------------------------------------------------------------------
# HTML -> payload
# --------------------------------------------------------------------------------------
def _looks_blocked(html: str) -> Optional[str]:
    low = html[:200_000].lower()
    if "consent.google.com" in low or "before you continue to google" in low:
        return "Google consent page returned (try a proxy/region without consent wall)"
    if "unusual traffic" in low or "/sorry/" in low or "captcha" in low:
        return "Google rate-limit/CAPTCHA page returned (slow down or use AIRINDEX_PROXY)"
    return None


def _extract_payloads(html: str) -> List[list]:
    """Return every ds:* JSON payload that looks like a flight-results payload."""
    tree = LexborHTMLParser(html)
    payloads: List[list] = []
    for node in tree.css("script"):
        cls = node.attributes.get("class") or ""
        if not cls.startswith("ds:"):
            continue
        js = node.text()
        if "data:" not in js:
            continue
        raw = js.split("data:", 1)[1].rsplit(",", 1)[0]
        if raw.rstrip().endswith("errorHasStatus: true"):
            logger.debug("ds block reported errorHasStatus")
            continue
        try:
            payload = json.loads(raw)
        except Exception:
            continue
        if isinstance(payload, list) and len(payload) > 3:
            payloads.append(payload)
    return payloads


def _iter_itineraries(payload: list):
    """Yield (section_name, raw_item) for both the 'best' (idx 2) and 'other' (idx 3) lists."""
    for idx, name in ((2, "best"), (3, "other")):
        section = _at(payload, idx)
        items = _at(section, 0) if isinstance(section, list) else None
        if isinstance(items, list):
            for item in items:
                yield name, item


# --------------------------------------------------------------------------------------
# Itinerary parsing
# --------------------------------------------------------------------------------------
def _parse_leg(sf: Any, fallback_date: date, fallback_carrier: str) -> Optional[Dict[str, Any]]:
    from_code = str(_at(sf, 3, "")).upper()
    to_code = str(_at(sf, 6, "")).upper()
    dep_hm = _parse_hm(_at(sf, 8))
    arr_hm = _parse_hm(_at(sf, 10))
    if not (from_code and to_code and dep_hm and arr_hm):
        return None

    dep_date = _parse_ymd(_at(sf, 20)) or fallback_date
    arr_date = _parse_ymd(_at(sf, 21))
    dep_dt = datetime.combine(dep_date, dtime(*dep_hm))
    if arr_date is None:  # never invent a year: same day, roll over if it lands "earlier"
        arr_date = dep_date if arr_hm >= dep_hm else dep_date + timedelta(days=1)
    arr_dt = datetime.combine(arr_date, dtime(*arr_hm))

    ident = _at(sf, 22, [])
    carrier = num = airline_name = None
    if isinstance(ident, list):
        carrier, num, airline_name = _at(ident, 0), _at(ident, 1), _at(ident, 3)
    carrier = str(carrier or fallback_carrier or "").upper()
    flight_number = f"{carrier}-{str(num).strip()}" if carrier and num else None

    duration = _at(sf, 11, 0)
    return {
        "from": from_code,
        "to": to_code,
        "dep": dep_dt,
        "arr": arr_dt,
        "duration_min": duration if isinstance(duration, int) else 0,
        "aircraft": str(_at(sf, 17, "") or ""),
        "flight_number": flight_number,
        "airline": str(airline_name or ""),
    }


def _parse_itinerary(item: Any, section: str, travel_day: date) -> Optional[Dict[str, Any]]:
    flight = _at(item, 0)
    price = _to_float_price(item)
    legs_raw = _at(flight, 2)
    if not isinstance(legs_raw, list) or not legs_raw:
        return None

    typ = str(_at(flight, 0, ""))
    airline_names = _at(flight, 1, [])
    carrier_hint = typ if len(typ) == 2 else ""

    legs: List[Dict[str, Any]] = []
    cursor = travel_day
    for sf in legs_raw:
        leg = _parse_leg(sf, cursor, carrier_hint)
        if leg is None:
            return None
        cursor = leg["arr"].date()
        legs.append(leg)

    carriers = []
    for lg in legs:
        name = lg["airline"] or (airline_names[0] if airline_names else "")
        if name and name not in carriers:
            carriers.append(name)

    numbers = [lg["flight_number"] or "N/A" for lg in legs]
    first, last = legs[0], legs[-1]
    return {
        "price": price,
        "section": section,
        "legs": legs,
        "airline": " + ".join(carriers) or "Unknown",
        "airline_code": (first["flight_number"] or "N/A").split("-")[0],
        "flight_number": numbers[0],
        "full_flight_number": " / ".join(numbers),
        "origin_actual": first["from"],
        "destination_actual": last["to"],
        "dep": first["dep"],
        "arr": last["arr"],
        "stops": len(legs) - 1,
        "layovers": [lg["to"] for lg in legs[:-1]],
        "aircraft": first["aircraft"],
        "total_duration_min": int(sum(lg["duration_min"] for lg in legs)),
        "seats_left": _find_seats_left(item),
    }


def parse_google_flights_html(html: str, travel_date: str) -> List[Dict[str, Any]]:
    """Parse a Google Flights HTML page into raw (unvalidated) itinerary dicts, de-duplicated."""
    travel_day = datetime.strptime(travel_date, "%Y-%m-%d").date()
    seen: Dict[Tuple[str, str, Any], Dict[str, Any]] = {}
    raw_total = skipped = 0
    for payload in _extract_payloads(html):
        for section, item in _iter_itineraries(payload):
            raw_total += 1
            try:
                it = _parse_itinerary(item, section, travel_day)
            except Exception as exc:  # one bad row must never sink the whole search
                logger.debug(f"Skipping unparseable itinerary: {exc}")
                skipped += 1
                continue
            if it is None:
                skipped += 1
                continue
            key = (it["full_flight_number"], it["dep"].isoformat(), it["price"])
            if key not in seen or (it["section"] == "best" and seen[key]["section"] != "best"):
                seen[key] = it
        if seen:
            break  # first payload that actually contained flights wins
    if raw_total:
        logger.info(f"Parsed {len(seen)} unique itineraries from {raw_total} listed ({skipped} unparseable)")
    return list(seen.values())


# --------------------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------------------
def _validate(it: Dict[str, Any], origin: str, destination: str, travel_day: date, cabin: str) -> List[str]:
    issues: List[str] = []
    lo, hi = FARE_BANDS_INR.get(cabin, FARE_BANDS_INR["economy"])
    if it["price"] is None:
        issues.append("price_unavailable")
    elif not (lo <= it["price"] <= hi):
        issues.append("fare_out_of_band")
    for n in it["full_flight_number"].split(" / "):
        if not FLIGHT_NO_RE.match(n):
            issues.append("bad_flight_no")
            break
    if it["origin_actual"] != origin or it["destination_actual"] != destination:
        issues.append("route_mismatch")
    if not (IATA_RE.match(it["origin_actual"]) and IATA_RE.match(it["destination_actual"])):
        issues.append("bad_airport_code")
    if it["dep"].date() != travel_day:
        issues.append("date_mismatch")
    if it["arr"] <= it["dep"]:
        issues.append("arrival_before_departure")
    else:
        # Duration cross-check is only meaningful when every airport shares IST.
        all_ist = all(lg["from"] in INDIA_AIRPORTS and lg["to"] in INDIA_AIRPORTS for lg in it["legs"])
        if all_ist and it["stops"] == 0 and it["legs"][0]["duration_min"]:
            elapsed = (it["arr"] - it["dep"]).total_seconds() / 60
            if abs(elapsed - it["legs"][0]["duration_min"]) > 10:
                issues.append("duration_mismatch")
    return issues


def _finalize(
    items: List[Dict[str, Any]],
    origin: str,
    destination: str,
    travel_date: str,
    cabin: str,
    currency: str,
    lead_days: Optional[int],
    include_suspect: bool,
    run_slot: Optional[str] = None,
) -> List[Dict[str, Any]]:
    travel_day = datetime.strptime(travel_date, "%Y-%m-%d").date()
    observed = datetime.now(IST)
    if lead_days is None:
        lead_days = max(0, (travel_day - observed.date()).days)

    prices = [it["price"] for it in items if it["price"] is not None]
    median = statistics.median(prices) if prices else None

    out: List[Dict[str, Any]] = []
    for it in items:
        issues = _validate(it, origin, destination, travel_day, cabin)
        if (median and len(prices) >= 5 and it["price"] is not None
                and (it["price"] > 4 * median or it["price"] < median / 4)):
            issues.append("price_outlier")
        if issues and not include_suspect:
            continue
        uid = hashlib.sha1(
            f"{origin}|{destination}|{travel_date}|{cabin}|{it['full_flight_number']}|"
            f"{it['dep'].strftime('%H:%M')}|{run_slot or observed.date()}".encode()
        ).hexdigest()[:16]
        fare = estimate_fare_breakdown(it["price"], it["legs"][0]["from"], cabin, currency)
        seats = it.get("seats_left")
        out.append({
            "id": f"gf_{uid}",
            "source": "google_flights",
            "origin": origin,
            "destination": destination,
            "travel_date": travel_date,
            "lead_days": lead_days,
            "cabin": cabin.upper().replace("-", "_"),
            "currency": currency,
            "flight_number": it["flight_number"],
            "full_flight_number": it["full_flight_number"],
            "airline": it["airline"],
            "airline_code": it["airline_code"],
            "departure_time": it["dep"].strftime("%H:%M"),
            "arrival_time": it["arr"].strftime("%H:%M"),
            "departure_datetime": it["dep"].isoformat(),
            "arrival_datetime": it["arr"].isoformat(),
            "arrives_next_day": it["arr"].date() > it["dep"].date(),
            "duration_minutes": it["total_duration_min"],
            "stops": it["stops"],
            "layover_airports": it["layovers"],
            "aircraft": it["aircraft"],
            # ---- fare structure: final is REAL (Google); base/taxes are ESTIMATED ----
            "fare": fare,
            "base_fare": fare["base_fare"],
            "taxes": fare["taxes_and_fees"],
            "total_fare": fare["final_fare"],
            "fare_breakdown_type": fare["breakdown_type"],
            "price_section": it["section"],
            # ---- seats: only from an explicit Google label, never guessed ----
            "seat_availability": seats,
            "seat_availability_source": "google_label" if seats is not None else "not_provided_by_google",
            "status": "Scheduled",
            "registry_validation": "VERIFIED" if not issues else "REVIEW: " + ",".join(sorted(set(issues))),
            "validation_issues": sorted(set(issues)),
            "observed_at": observed.isoformat(),
            "run_slot": run_slot,   # 3-hour scrape slot, e.g. 20260924T0900 (part of the id)
        })
    out.sort(key=lambda r: (r["departure_datetime"], r["total_fare"] if r["total_fare"] is not None else float("inf")))
    return out


# --------------------------------------------------------------------------------------
# Scraping
# --------------------------------------------------------------------------------------
def _build_query(origin: str, destination: str, travel_date: str, cabin: str, currency: str,
                 max_stops: Optional[int], adults: int):
    seat = CABIN_MAP.get(cabin.upper(), cabin.lower())
    if seat not in FARE_BANDS_INR:
        seat = "economy"
    flight = FlightQuery(
        date=travel_date,
        from_airport=origin.upper(),
        to_airport=destination.upper(),
        max_stops=max_stops,
    )
    query = create_query(
        flights=[flight],
        seat=seat,
        trip="one-way",
        passengers=Passengers(adults=adults),
        language="en",          # pinned: names/prices must not vary with server location
        currency=currency.upper(),
        exclude_basic_economy=False,
    )
    return query, seat


def _dump_raw(html: str) -> None:
    os.makedirs(RAW_DUMP_DIR, exist_ok=True)
    stamp = int(time.time() * 1000)
    with open(os.path.join(RAW_DUMP_DIR, f"gf_{stamp}.html"), "w", encoding="utf-8") as fh:
        fh.write(html)
    payloads = _extract_payloads(html)
    if payloads:
        with open(os.path.join(RAW_DUMP_DIR, f"gf_{stamp}_payload.json"), "w", encoding="utf-8") as fh:
            json.dump(payloads[0], fh, indent=1)
    logger.info(f"Raw Google response saved in {RAW_DUMP_DIR} (stamp {stamp})")


def _fetch_once(query, travel_date: str) -> List[Dict[str, Any]]:
    proxy = get_next_proxy()
    html = fetch_flights_html(query, proxy=proxy)
    if RAW_DUMP_DIR:
        _dump_raw(html)
    items = parse_google_flights_html(html, travel_date)
    if not items:
        blocked = _looks_blocked(html)
        if blocked:
            raise RuntimeError(blocked)
        if DEBUG_DIR:
            os.makedirs(DEBUG_DIR, exist_ok=True)
            path = os.path.join(DEBUG_DIR, f"gf_{int(time.time())}.html")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(html)
            logger.warning(f"No itineraries parsed; raw HTML saved to {path}")
    return items


def scrape_route(
    origin: str,
    destination: str,
    travel_date: str,
    cabin: str = "economy",
    currency: str = "INR",
    max_stops: Optional[int] = None,
    adults: int = 1,
    max_retries: int = 2,
    backoff_seconds: float = 3.0,
    samples: int = 1,
    lead_days: Optional[int] = None,
    include_suspect: bool = True,
    run_slot: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch, parse and validate one route/date. Returns a list of record dicts.

    samples > 1 repeats the search and uses the MEDIAN fare per itinerary, which filters out
    the occasional transient/stale price Google serves on a single request.
    """
    origin, destination = origin.upper(), destination.upper()
    # max_stops is applied client-side (server-side filtering can return empty pages); None = every flight
    query, seat = _build_query(origin, destination, travel_date, cabin, currency, None, adults)

    runs: List[List[Dict[str, Any]]] = []
    last_error: Optional[Exception] = None
    for s in range(max(1, samples)):
        items: List[Dict[str, Any]] = []
        for attempt in range(max_retries + 1):
            try:
                items = _fetch_once(query, travel_date)
                last_error = None
                if items:
                    break
                logger.info(f"Empty result {origin}->{destination} {travel_date} (attempt {attempt + 1})")
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                is_rate_limit = "rate-limit" in err_str or "captcha" in err_str or "429" in err_str or "sorry" in err_str
                if is_rate_limit:
                    sleep_time = max(6.0, backoff_seconds * (3.0 ** attempt) + random.uniform(2.0, 5.0))
                    logger.warning(f"[Rate-Limit Engine] Google rate-limit detected for {origin}->{destination}. Adaptive backoff pause for {sleep_time:.1f}s (Attempt {attempt + 1}/{max_retries + 1})...")
                    time.sleep(sleep_time)
                else:
                    logger.warning(f"Attempt {attempt + 1}/{max_retries + 1} failed for {origin}->{destination}: {e}")
                    if attempt < max_retries:
                        time.sleep(backoff_seconds * (2 ** attempt) + random.uniform(0.5, 1.5))
        if items:
            runs.append(items)
        if s < samples - 1:
            time.sleep(random.uniform(1.0, 2.0))

    if not runs:
        if last_error is not None:
            raise RuntimeError(f"Google Flights scrape failed for {origin}->{destination} on {travel_date}: {last_error}")
        logger.warning(f"No flights returned for {origin}->{destination} on {travel_date}")
        return []

    merged = runs[0]
    if len(runs) > 1:  # median fare across samples, keyed by itinerary identity
        by_key: Dict[Tuple[str, str], List[float]] = {}
        for run in runs:
            for it in run:
                by_key.setdefault((it["full_flight_number"], it["dep"].isoformat()), []).append(it["price"])
        base: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for run in runs:
            for it in run:
                base.setdefault((it["full_flight_number"], it["dep"].isoformat()), it)
        merged = []
        for key, it in base.items():
            it = dict(it)
            vals = [v for v in by_key[key] if v is not None]
            it["price"] = float(statistics.median(vals)) if vals else None
            merged.append(it)
    if max_stops is not None:
        merged = [it for it in merged if it["stops"] <= max_stops]

    records = _finalize(merged, origin, destination, travel_date, seat, currency.upper(), lead_days, include_suspect, run_slot)
    logger.info(f"[Google Flights] {len(records)} validated flights {origin}->{destination} on {travel_date}")
    return records


def scrape_and_normalize_route(
    origin: str,
    destination: str,
    travel_date: str,
    cabin: str = "ECONOMY",
    currency: str = "INR",
    max_stops: Optional[int] = None,
    lead_days: Optional[int] = None,
    samples: int = 1,
    include_suspect: bool = True,
    run_slot: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Kept for backward compatibility: scrape_route already returns normalized records."""
    return scrape_route(
        origin=origin,
        destination=destination,
        travel_date=travel_date,
        cabin=cabin,
        currency=currency,
        max_stops=max_stops,
        lead_days=lead_days,
        samples=samples,
        include_suspect=include_suspect,
        run_slot=run_slot,
    )


def scrape_time_series(
    routes: Optional[List[Dict[str, str]]] = None,
    booking_windows: Optional[List[int]] = None,
    cabin: str = "ECONOMY",
    currency: str = "INR",
    base_date: Optional[date] = None,
    delay_range: tuple = (1.5, 3.0),
    max_total_searches: int = 25,
    samples: int = 1,
) -> List[Dict[str, Any]]:
    """
    Time-series observations across routes x booking windows (T+1, T+7 ...).
    ALL listed flights are kept. To build the price index, filter on registry_validation == 'VERIFIED'.
    """
    target_routes = routes or DEFAULT_MONITORED_ROUTES
    windows = booking_windows or DEFAULT_BOOKING_WINDOWS
    start_date = base_date or today_ist()

    all_obs: List[Dict[str, Any]] = []
    searches = 0
    for route in target_routes:
        orig, dest = route["origin"].upper(), route["destination"].upper()
        for lead in windows:
            if searches >= max_total_searches:
                logger.info(f"Reached search limit of {max_total_searches}.")
                return all_obs
            target = (start_date + timedelta(days=lead)).strftime("%Y-%m-%d")
            try:
                all_obs.extend(scrape_and_normalize_route(
                    orig, dest, target, cabin=cabin, currency=currency,
                    lead_days=lead, samples=samples, include_suspect=True,
                ))
            except Exception as e:
                logger.warning(f"Error scraping {orig}->{dest} on {target}: {e}")
            searches += 1  # count failures too, so a blocked IP cannot loop forever
            time.sleep(random.uniform(*delay_range))
    return all_obs


class GoogleFlightsScraper:
    """Object-oriented wrapper around the scraper service."""

    def __init__(self, currency: str = "INR", default_cabin: str = "ECONOMY"):
        self.currency = currency
        self.default_cabin = default_cabin

    def scrape_route(self, origin: str, destination: str, travel_date: str, max_stops: Optional[int] = None,
                     samples: int = 1) -> List[Dict[str, Any]]:
        return scrape_and_normalize_route(
            origin, destination, travel_date, cabin=self.default_cabin,
            currency=self.currency, max_stops=max_stops, samples=samples,
        )

    def scrape_corridor_matrix(self, routes: List[Dict[str, str]], lead_days: int = 7,
                               base_date: Optional[date] = None) -> List[Dict[str, Any]]:
        target = ((base_date or today_ist()) + timedelta(days=lead_days)).strftime("%Y-%m-%d")
        results: List[Dict[str, Any]] = []
        for r in routes:
            try:
                results.extend(self.scrape_route(r["origin"], r["destination"], target))
                time.sleep(random.uniform(1.2, 2.5))
            except Exception as e:
                logger.error(f"Failed {r['origin']}->{r['destination']}: {e}")
        return results


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------
def _money(v: Optional[float]) -> str:
    return "N/A" if v is None else f"{v:,.0f}"


def print_table(observations: List[Dict[str, Any]]) -> None:
    header = (f"{'Flight':<12} | {'Airline':<18} | {'Dep':<5} -> {'Arr':<7} | {'Stops':<5} | "
              f"{'Base Fare*':<10} | {'Taxes*':<8} | {'Final Fare':<10} | {'Seats':<5} | {'Status':<9} | {'Validation'}")
    print(header)
    print("-" * len(header))
    for o in observations:
        seats = o.get("seat_availability")
        arr = o["arrival_time"] + ("+1" if o.get("arrives_next_day") else "")
        print(
            f"{o.get('flight_number', 'N/A'):<12} | "
            f"{o.get('airline', 'N/A')[:18]:<18} | "
            f"{o['departure_time']:<5} -> {arr:<7} | "
            f"{o.get('stops', 0):<5} | "
            f"{_money(o.get('base_fare')):<10} | "
            f"{_money(o.get('taxes')):<8} | "
            f"{_money(o.get('total_fare')):<10} | "
            f"{('N/A' if seats is None else seats):<5} | "
            f"{o.get('status', 'N/A'):<9} | "
            f"{o.get('registry_validation', 'N/A')}"
        )
    print("\n* Base Fare / Taxes are ESTIMATES (Google Flights publishes only the Final Fare, in INR).")
    print("  Seats shows N/A unless Google's own response contains a '<N> seats left' label.")


CSV_FIELDS = [
    "id", "origin", "destination", "travel_date", "lead_days", "cabin", "currency", "flight_number",
    "full_flight_number", "airline", "departure_time", "arrival_time", "arrives_next_day", "stops",
    "layover_airports", "duration_minutes", "aircraft", "base_fare", "taxes", "total_fare",
    "fare_breakdown_type", "seat_availability", "seat_availability_source", "status",
    "registry_validation", "price_section", "observed_at",
]


def write_csv(path: str, rows: List[Dict[str, Any]]) -> None:
    import csv
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            r = dict(r)
            r["layover_airports"] = ">".join(r.get("layover_airports") or [])
            w.writerow(r)


def main():
    import argparse
    global RAW_DUMP_DIR
    parser = argparse.ArgumentParser(description="AirIndex India - Google Flights Scraper CLI")
    parser.add_argument("--origin", "-o", default="DEL")
    parser.add_argument("--destination", "-d", default="BOM")
    parser.add_argument("--date", default=None, help="YYYY-MM-DD (overrides --days)")
    parser.add_argument("--days", type=int, default=7, help="Lead days from today IST (default 7)")
    parser.add_argument("--cabin", default="ECONOMY", choices=["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
    parser.add_argument("--currency", default="INR")
    parser.add_argument("--max-stops", type=int, default=None, help="Optional client-side stop limit (default: ALL flights)")
    parser.add_argument("--samples", type=int, default=1, help="Repeat the search N times, use median fare")
    parser.add_argument("--strict", action="store_true", help="Hide rows that fail validation (default: show all)")
    parser.add_argument("--json", dest="json_out", default=None, help="Write all records (full fare structure) to this JSON file")
    parser.add_argument("--csv", dest="csv_out", default=None, help="Write all records to this CSV file")
    parser.add_argument("--dump-raw", default=None, help="Directory to save Google's raw HTML + payload JSON (use to inspect seats)")
    parser.add_argument("--save", action="store_true", help="Persist to Supabase and frontend JSON")
    args = parser.parse_args()

    if args.dump_raw:
        RAW_DUMP_DIR = args.dump_raw
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    origin, destination = args.origin.upper(), args.destination.upper()
    today = today_ist()
    travel_date = args.date or (today + timedelta(days=args.days)).strftime("%Y-%m-%d")
    lead_days = args.days if not args.date else max(
        1, (datetime.strptime(travel_date, "%Y-%m-%d").date() - today).days)

    print("\n=======================================================")
    print("  AirIndex India - Google Flights Live Scraper")
    print(f"  Route:       {origin} -> {destination}")
    print(f"  Travel Date: {travel_date} (T+{lead_days})")
    print(f"  Cabin:       {args.cabin} | Currency: {args.currency} | Samples: {args.samples}")
    print(f"  Stops:       {'ALL flights' if args.max_stops is None else f'<= {args.max_stops}'}")
    print("=======================================================\n")

    try:
        observations = scrape_and_normalize_route(
            origin, destination, travel_date, cabin=args.cabin, currency=args.currency,
            max_stops=args.max_stops, lead_days=lead_days, samples=args.samples,
            include_suspect=not args.strict,
        )
    except Exception as e:
        print(f"[Error] Scrape failed: {e}")
        sys.exit(1)

    if not observations:
        print("No flights returned (route/date may have no service, or Google returned no data).")
        sys.exit(0)

    flagged = sum(1 for o in observations if o["validation_issues"])
    print(f"Harvested ALL {len(observations)} listed flights ({len(observations) - flagged} verified, {flagged} flagged):\n")
    print_table(observations)

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(observations, f, indent=2, default=str)
        print(f"\n[Export] JSON -> {args.json_out}")
    if args.csv_out:
        write_csv(args.csv_out, observations)
        print(f"[Export] CSV  -> {args.csv_out}")

    if args.save:
        to_save = [o for o in observations if o["total_fare"] is not None]
        print(f"\n[Persistence] Saving {len(to_save)} priced rows (filter registry_validation == 'VERIFIED' for the index)...")
        try:
            try:
                from backend.db_client import save_observations_to_supabase
            except ImportError:
                from db_client import save_observations_to_supabase
            saved = save_observations_to_supabase(to_save)
            print(f"  - Supabase Database: {'SUCCESS' if saved else 'SKIPPED/OFFLINE'}")
        except Exception as se:
            print(f"  - Supabase Database: Error ({se})")

        try:
            frontend_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                "frontend", "src", "data", "scrapedObservations.json",
            )
            if os.path.exists(os.path.dirname(frontend_path)):
                existing = []
                if os.path.exists(frontend_path):
                    with open(frontend_path, "r", encoding="utf-8") as f:
                        existing = json.load(f)
                obs_map = {o["id"]: o for o in existing if "id" in o}
                for o in to_save:
                    obs_map[o["id"]] = o
                with open(frontend_path, "w", encoding="utf-8") as f:
                    json.dump(list(obs_map.values()), f, indent=2, default=str)
                print(f"  - Frontend Synced:   {frontend_path} ({len(obs_map)} total records)")
        except Exception as fe:
            print(f"  - Frontend Sync:     Error ({fe})")

    print("\n[Done] Scrape cycle complete.\n")


if __name__ == "__main__":
    main()