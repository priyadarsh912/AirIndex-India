"""
AirIndex India - Index Calculation & PSD Weighting Engine
Translates raw flight observations into statistical index series:
SCRAPED PRICE ↓ flight_observations ↓ route matching ↓ PSD ↓ weight ↓ INDEX
"""

import math
import logging
from typing import List, Dict, Any, Optional

try:
    from backend.psd_basket_manager import basket_manager
    from backend.index_engine import compute_airfare_indexes
except ImportError:
    from psd_basket_manager import basket_manager
    from index_engine import compute_airfare_indexes

logger = logging.getLogger("airscope.index.calculator")


class AirfareIndexCalculator:
    """Calculates weighted price relatives and aggregate Airfare Price Index (APIx)."""

    def __init__(self):
        self.basket_manager = basket_manager

    def compute_price_relative(
        self,
        current_price: float,
        base_price: float
    ) -> float:
        """Computes price relative: P_t / P_0."""
        if base_price <= 0:
            return 1.0
        return round(current_price / base_price, 4)

    def calculate_observation_contribution(
        self,
        observation: Dict[str, Any],
        active_basket_version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates how an individual scraped observation contributes to the index:
        Google Flights observation ↓ DEL → BOM ↓ ₹5,240 ↓ Route identification ↓
        PSD / product specification ↓ Applicable route weight ↓ Price relative ↓
        Weighted contribution
        """
        route = observation.get("route") or f"{observation.get('origin', '')}-{observation.get('destination', '')}"
        current_fare = float(observation.get("total_fare") or observation.get("price") or 0.0)

        # Get route weight and specification from PSD Basket
        route_spec = self.basket_manager.get_route_spec(route, basket_version=active_basket_version)
        if route_spec:
            weight = route_spec.get("weight", 0.0)
            base_price = route_spec.get("base_price") or 4500.0
            cluster = route_spec.get("cluster", "Metro Trunk")
        else:
            weight = 0.02  # Default conservative fallback
            base_price = 4500.0
            cluster = "Monitored Domestic"

        price_relative = self.compute_price_relative(current_fare, base_price)
        pct_change = round((price_relative - 1.0) * 100, 2)
        weighted_contribution = round(price_relative * weight * 100, 4)

        return {
            "route": route,
            "current_fare": current_fare,
            "base_price": base_price,
            "price_relative": price_relative,
            "percentage_change": pct_change,
            "psd_weight": weight,
            "cluster": cluster,
            "weighted_contribution": weighted_contribution,
            "source": observation.get("source", "Google Flights"),
            "flight_number": observation.get("flight_number") or observation.get("flight_no"),
            "airline": observation.get("airline") or observation.get("carrier"),
        }

    def compute_full_index(
        self,
        observations: List[Dict[str, Any]],
        frequency: str = "daily"
    ) -> Dict[str, Any]:
        """Computes full statistical index metrics across observations using the core index engine."""
        return compute_airfare_indexes(observations)


# Global singleton instance
index_calculator = AirfareIndexCalculator()
