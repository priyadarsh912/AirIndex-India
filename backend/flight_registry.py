"""
AirIndex India - Master Flight Registry (Golden Source of Truth)
Maps real flight numbers to their actual routes for each carrier.
Used by the Integrity Engine to detect and correct data misattribution.

Sources:
  - DGCA published schedules (public domain)
  - Published airline timetables (publicly available)
  - Aviation industry standard route databases

IMPORTANT: Flight numbers can change per season. This is a representative
registry for the project scope corridors only. Actual routes must be
validated at scrape time against live page context.
"""

from typing import Dict, Optional, List

# ============================================================
#  MASTER FLIGHT REGISTRY
#  Structure: { "CARRIER_CODE-FLIGHT_NUM": { route info } }
# ============================================================

# Real representative IndiGo (6E) flights on monitored routes
INDIGO_REGISTRY: Dict[str, Dict] = {
    # DEL-BOM corridor
    "6E-2501": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "6E-2505": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "6E-5050": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "6E-2503": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    # BOM-DEL corridor
    "6E-2502": {"origin": "BOM", "destination": "DEL", "route": "BOM-DEL"},
    "6E-2504": {"origin": "BOM", "destination": "DEL", "route": "BOM-DEL"},
    "6E-5051": {"origin": "BOM", "destination": "DEL", "route": "BOM-DEL"},
    # DEL-BLR corridor
    "6E-2041": {"origin": "DEL", "destination": "BLR", "route": "DEL-BLR"},
    "6E-2045": {"origin": "DEL", "destination": "BLR", "route": "DEL-BLR"},
    "6E-2037": {"origin": "DEL", "destination": "BLR", "route": "DEL-BLR"},
    # BLR-DEL corridor
    "6E-2042": {"origin": "BLR", "destination": "DEL", "route": "BLR-DEL"},
    "6E-2038": {"origin": "BLR", "destination": "DEL", "route": "BLR-DEL"},
    # BOM-BLR corridor
    "6E-321":  {"origin": "BOM", "destination": "BLR", "route": "BOM-BLR"},
    "6E-323":  {"origin": "BOM", "destination": "BLR", "route": "BOM-BLR"},
    "6E-5151": {"origin": "BOM", "destination": "BLR", "route": "BOM-BLR"},
    # BLR-BOM corridor
    "6E-322":  {"origin": "BLR", "destination": "BOM", "route": "BLR-BOM"},
    "6E-324":  {"origin": "BLR", "destination": "BOM", "route": "BLR-BOM"},
    # DEL-CCU corridor
    "6E-2381": {"origin": "DEL", "destination": "CCU", "route": "DEL-CCU"},
    "6E-2383": {"origin": "DEL", "destination": "CCU", "route": "DEL-CCU"},
    # CCU-DEL corridor
    "6E-2382": {"origin": "CCU", "destination": "DEL", "route": "CCU-DEL"},
    # BLR-HYD corridor
    "6E-831":  {"origin": "BLR", "destination": "HYD", "route": "BLR-HYD"},
    "6E-833":  {"origin": "BLR", "destination": "HYD", "route": "BLR-HYD"},
    # HYD-BLR corridor
    "6E-832":  {"origin": "HYD", "destination": "BLR", "route": "HYD-BLR"},
    # MAA-DEL corridor
    "6E-2811": {"origin": "MAA", "destination": "DEL", "route": "MAA-DEL"},
    "6E-2813": {"origin": "MAA", "destination": "DEL", "route": "MAA-DEL"},
    # DEL-MAA corridor
    "6E-2812": {"origin": "DEL", "destination": "MAA", "route": "DEL-MAA"},
    # DEL-PNQ corridor
    "6E-2231": {"origin": "DEL", "destination": "PNQ", "route": "DEL-PNQ"},
    # BOM-AMD corridor
    "6E-411":  {"origin": "BOM", "destination": "AMD", "route": "BOM-AMD"},
    "6E-413":  {"origin": "BOM", "destination": "AMD", "route": "BOM-AMD"},
    # AMD-BOM corridor
    "6E-412":  {"origin": "AMD", "destination": "BOM", "route": "AMD-BOM"},
    # DEL-GOI corridor
    "6E-2761": {"origin": "DEL", "destination": "GOI", "route": "DEL-GOI"},
    "6E-2763": {"origin": "DEL", "destination": "GOI", "route": "DEL-GOI"},
    # BOM-GOI corridor
    "6E-601":  {"origin": "BOM", "destination": "GOI", "route": "BOM-GOI"},
    # HYD-VTZ corridor (real 6E flights on this route)
    "6E-7325": {"origin": "HYD", "destination": "VTZ", "route": "HYD-VTZ"},
    "6E-7327": {"origin": "HYD", "destination": "VTZ", "route": "HYD-VTZ"},
    # DEL-GAU corridor
    "6E-2211": {"origin": "DEL", "destination": "GAU", "route": "DEL-GAU"},
    "6E-2215": {"origin": "DEL", "destination": "GAU", "route": "DEL-GAU"},
    # DEL-SXR corridor
    "6E-5010": {"origin": "DEL", "destination": "SXR", "route": "DEL-SXR"},
    "6E-5012": {"origin": "DEL", "destination": "SXR", "route": "DEL-SXR"},
    # DEL-JAI corridor
    "6E-511":  {"origin": "DEL", "destination": "JAI", "route": "DEL-JAI"},
    "6E-513":  {"origin": "DEL", "destination": "JAI", "route": "DEL-JAI"},
    # BLR-COK corridor
    "6E-541":  {"origin": "BLR", "destination": "COK", "route": "BLR-COK"},
    # DEL-LKO corridor
    "6E-361":  {"origin": "DEL", "destination": "LKO", "route": "DEL-LKO"},
    "6E-363":  {"origin": "DEL", "destination": "LKO", "route": "DEL-LKO"},
}

# Real representative Air India (AI) flights
AIR_INDIA_REGISTRY: Dict[str, Dict] = {
    # DEL-BOM
    "AI-101": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "AI-103": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "AI-105": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    # BOM-DEL
    "AI-102": {"origin": "BOM", "destination": "DEL", "route": "BOM-DEL"},
    "AI-104": {"origin": "BOM", "destination": "DEL", "route": "BOM-DEL"},
    # DEL-BLR
    "AI-501": {"origin": "DEL", "destination": "BLR", "route": "DEL-BLR"},
    "AI-503": {"origin": "DEL", "destination": "BLR", "route": "DEL-BLR"},
    # BLR-DEL
    "AI-502": {"origin": "BLR", "destination": "DEL", "route": "BLR-DEL"},
    "AI-504": {"origin": "BLR", "destination": "DEL", "route": "BLR-DEL"},
    # BOM-BLR
    "AI-621": {"origin": "BOM", "destination": "BLR", "route": "BOM-BLR"},
    # DEL-CCU
    "AI-401": {"origin": "DEL", "destination": "CCU", "route": "DEL-CCU"},
    "AI-403": {"origin": "DEL", "destination": "CCU", "route": "DEL-CCU"},
    # CCU-DEL
    "AI-402": {"origin": "CCU", "destination": "DEL", "route": "CCU-DEL"},
    # MAA-DEL
    "AI-531": {"origin": "MAA", "destination": "DEL", "route": "MAA-DEL"},
    # DEL-MAA
    "AI-532": {"origin": "DEL", "destination": "MAA", "route": "DEL-MAA"},
    # DEL-GOI
    "AI-651": {"origin": "DEL", "destination": "GOI", "route": "DEL-GOI"},
    # DEL-GAU
    "AI-891": {"origin": "DEL", "destination": "GAU", "route": "DEL-GAU"},
    # BLR-HYD
    "AI-541": {"origin": "BLR", "destination": "HYD", "route": "BLR-HYD"},
    # HYD-VTZ (real AI flight on this corridor)
    "AI-677": {"origin": "HYD", "destination": "VTZ", "route": "HYD-VTZ"},
    "AI-679": {"origin": "HYD", "destination": "VTZ", "route": "HYD-VTZ"},
}

# Real representative Air India Express (IX) flights
AIX_REGISTRY: Dict[str, Dict] = {
    "IX-433": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "IX-435": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "IX-611": {"origin": "BLR", "destination": "COK", "route": "BLR-COK"},
    "IX-613": {"origin": "COK", "destination": "BLR", "route": "COK-BLR"},
    "IX-541": {"origin": "BOM", "destination": "GOI", "route": "BOM-GOI"},
    "IX-543": {"origin": "GOI", "destination": "BOM", "route": "GOI-BOM"},
    "IX-571": {"origin": "DEL", "destination": "CCU", "route": "DEL-CCU"},
    "IX-225": {"origin": "BLR", "destination": "HYD", "route": "BLR-HYD"},
    "IX-231": {"origin": "MAA", "destination": "DEL", "route": "MAA-DEL"},
    "IX-239": {"origin": "BOM", "destination": "BLR", "route": "BOM-BLR"},
}

# Real representative Akasa Air (QP) flights
AKASA_REGISTRY: Dict[str, Dict] = {
    "QP-1301": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "QP-1303": {"origin": "DEL", "destination": "BOM", "route": "DEL-BOM"},
    "QP-1302": {"origin": "BOM", "destination": "DEL", "route": "BOM-DEL"},
    "QP-1161": {"origin": "BOM", "destination": "BLR", "route": "BOM-BLR"},
    "QP-1163": {"origin": "BLR", "destination": "BOM", "route": "BLR-BOM"},
    "QP-1101": {"origin": "DEL", "destination": "BLR", "route": "DEL-BLR"},
    "QP-1201": {"origin": "BOM", "destination": "AMD", "route": "BOM-AMD"},
    "QP-1401": {"origin": "DEL", "destination": "MAA", "route": "DEL-MAA"},
}

# Combined registry
MASTER_FLIGHT_REGISTRY: Dict[str, Dict] = {}
MASTER_FLIGHT_REGISTRY.update(INDIGO_REGISTRY)
MASTER_FLIGHT_REGISTRY.update(AIR_INDIA_REGISTRY)
MASTER_FLIGHT_REGISTRY.update(AIX_REGISTRY)
MASTER_FLIGHT_REGISTRY.update(AKASA_REGISTRY)

# Per-route known flight pools (for realistic assignment when synthesizing data)
ROUTE_FLIGHT_POOLS: Dict[str, List[str]] = {}
for flight_id, info in MASTER_FLIGHT_REGISTRY.items():
    route = info["route"]
    if route not in ROUTE_FLIGHT_POOLS:
        ROUTE_FLIGHT_POOLS[route] = []
    ROUTE_FLIGHT_POOLS[route].append(flight_id)

# Per-carrier per-route pools
CARRIER_ROUTE_FLIGHTS: Dict[str, Dict[str, List[str]]] = {
    "IndiGo": {},
    "Air India": {},
    "Air India Express": {},
    "Akasa Air": {},
}

CARRIER_CODE_MAP = {
    "6E": "IndiGo",
    "AI": "Air India",
    "IX": "Air India Express",
    "QP": "Akasa Air",
}

for flight_id, info in MASTER_FLIGHT_REGISTRY.items():
    carrier_code = flight_id.split("-")[0]
    carrier_name = CARRIER_CODE_MAP.get(carrier_code, "Unknown")
    route = info["route"]
    if carrier_name in CARRIER_ROUTE_FLIGHTS:
        if route not in CARRIER_ROUTE_FLIGHTS[carrier_name]:
            CARRIER_ROUTE_FLIGHTS[carrier_name][route] = []
        CARRIER_ROUTE_FLIGHTS[carrier_name][route].append(flight_id)


def lookup_flight(flight_number: str) -> Optional[Dict]:
    """Look up a flight number in the master registry. Returns route info or None."""
    # Normalize: remove spaces, uppercase
    normalized = flight_number.replace(" ", "").upper()
    # Try direct lookup
    if normalized in MASTER_FLIGHT_REGISTRY:
        return MASTER_FLIGHT_REGISTRY[normalized]
    # Try with hyphen formatting (e.g., 6E339 -> 6E-339)
    for key in MASTER_FLIGHT_REGISTRY:
        if key.replace("-", "") == normalized.replace("-", ""):
            return MASTER_FLIGHT_REGISTRY[key]
    return None


def get_valid_flight_for_route(carrier_name: str, route: str) -> Optional[str]:
    """Return a valid real flight number for a given carrier and route."""
    flights = CARRIER_ROUTE_FLIGHTS.get(carrier_name, {}).get(route, [])
    if not flights:
        # Try route-level fallback
        all_route_flights = ROUTE_FLIGHT_POOLS.get(route, [])
        if all_route_flights:
            # Filter by carrier prefix
            carrier_prefix_map = {
                "IndiGo": "6E",
                "Air India": "AI",
                "Air India Express": "IX",
                "Akasa Air": "QP",
            }
            prefix = carrier_prefix_map.get(carrier_name, "")
            filtered = [f for f in all_route_flights if f.startswith(prefix)]
            if filtered:
                import random
                return random.choice(filtered)
        return None
    import random
    return random.choice(flights)


def validate_flight_route_match(flight_number: str, actual_origin: str, actual_destination: str) -> Dict:
    """
    Cross-check a scraped flight number against its expected route in the registry.
    Returns a validation result dict.
    """
    registry_entry = lookup_flight(flight_number)

    if registry_entry is None:
        return {
            "status": "UNVERIFIED",
            "message": f"Flight {flight_number} not found in master registry. Cannot verify route.",
            "expected_origin": None,
            "expected_destination": None,
            "route_match": None,
            "confidence": 50
        }

    expected_origin = registry_entry["origin"]
    expected_destination = registry_entry["destination"]
    origin_match = expected_origin.upper() == actual_origin.upper()
    dest_match = expected_destination.upper() == actual_destination.upper()
    route_match = origin_match and dest_match

    if route_match:
        return {
            "status": "VERIFIED",
            "message": f"Flight {flight_number} correctly mapped to {actual_origin}-{actual_destination}.",
            "expected_origin": expected_origin,
            "expected_destination": expected_destination,
            "route_match": True,
            "confidence": 99
        }
    else:
        return {
            "status": "MISATTRIBUTED",
            "message": (
                f"Flight {flight_number} is registered on {expected_origin}-{expected_destination} "
                f"but was placed on {actual_origin}-{actual_destination}. DATA INTEGRITY VIOLATION."
            ),
            "expected_origin": expected_origin,
            "expected_destination": expected_destination,
            "corrected_route": f"{expected_origin}-{expected_destination}",
            "route_match": False,
            "confidence": 98
        }
