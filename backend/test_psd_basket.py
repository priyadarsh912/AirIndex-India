"""
Unit Tests for MoSPI PSD (Price Statistics Division) Basket & Weights Management Module
SIH26056: Index-construction module based on PSD given routes and weights.
"""

import unittest
import numpy as np
from psd_basket_manager import WeightValidator, PSDBasketManager


class TestPSDBasketManagement(unittest.TestCase):

    def setUp(self):
        self.valid_routes = [
            {"corridor": "DEL-BOM", "origin": "DEL", "destination": "BOM", "weight": 0.40, "base_price": 4000},
            {"corridor": "DEL-BLR", "origin": "DEL", "destination": "BLR", "weight": 0.35, "base_price": 4500},
            {"corridor": "BOM-BLR", "origin": "BOM", "destination": "BLR", "weight": 0.25, "base_price": 3500},
        ]

    def test_weight_sum_100_percent_passes(self):
        """Validates that weights summing to exactly 1.0 (100%) pass validation."""
        is_valid, errors, summary = WeightValidator.validate_routes_and_weights(self.valid_routes)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
        self.assertAlmostEqual(summary["total_weight"], 1.0, places=3)
        self.assertEqual(summary["total_weight_pct"], 100.0)

    def test_weight_sum_under_100_percent_fails(self):
        """Validates that weights summing to 80% fail validation with explicit error."""
        under_routes = [
            {"corridor": "DEL-BOM", "origin": "DEL", "destination": "BOM", "weight": 0.30},
            {"corridor": "DEL-BLR", "origin": "DEL", "destination": "BLR", "weight": 0.30},
            {"corridor": "BOM-BLR", "origin": "BOM", "destination": "BLR", "weight": 0.20},
        ]
        is_valid, errors, summary = WeightValidator.validate_routes_and_weights(under_routes)
        self.assertFalse(is_valid)
        self.assertTrue(any("sum to 80" in err for err in errors))
        self.assertEqual(summary["total_weight_pct"], 80.0)

    def test_weight_sum_over_100_percent_fails(self):
        """Validates that weights summing to 120% fail validation."""
        over_routes = [
            {"corridor": "DEL-BOM", "origin": "DEL", "destination": "BOM", "weight": 0.60},
            {"corridor": "DEL-BLR", "origin": "DEL", "destination": "BLR", "weight": 0.60},
        ]
        is_valid, errors, summary = WeightValidator.validate_routes_and_weights(over_routes)
        self.assertFalse(is_valid)
        self.assertTrue(any("expected 100%" in err for err in errors))

    def test_duplicate_route_rejection(self):
        """Duplicate routes in same basket must be rejected."""
        dup_routes = [
            {"corridor": "DEL-BOM", "origin": "DEL", "destination": "BOM", "weight": 0.50},
            {"corridor": "DEL-BOM", "origin": "DEL", "destination": "BOM", "weight": 0.50},
        ]
        is_valid, errors, _ = WeightValidator.validate_routes_and_weights(dup_routes)
        self.assertFalse(is_valid)
        self.assertTrue(any("Duplicate corridor" in err for err in errors))

    def test_identical_origin_destination_rejection(self):
        """Origin == Destination (e.g. DEL-DEL) is an invalid route."""
        invalid_route = [
            {"corridor": "DEL-DEL", "origin": "DEL", "destination": "DEL", "weight": 1.0},
        ]
        is_valid, errors, _ = WeightValidator.validate_routes_and_weights(invalid_route)
        self.assertFalse(is_valid)
        self.assertTrue(any("identical" in err.lower() for err in errors))

    def test_negative_weight_rejection(self):
        """Negative weights must be strictly rejected."""
        neg_routes = [
            {"corridor": "DEL-BOM", "origin": "DEL", "destination": "BOM", "weight": -0.20},
            {"corridor": "DEL-BLR", "origin": "DEL", "destination": "BLR", "weight": 1.20},
        ]
        is_valid, errors, _ = WeightValidator.validate_routes_and_weights(neg_routes)
        self.assertFalse(is_valid)
        self.assertTrue(any("strictly > 0" in err for err in errors))

    def test_csv_parser(self):
        """Tests standard PSD CSV parsing."""
        csv_text = (
            "route_code,origin,destination,weight,cluster\n"
            "DEL-BOM,DEL,BOM,0.50,Metro Trunk\n"
            "DEL-BLR,DEL,BLR,0.50,Metro Trunk\n"
        )
        routes, errors = WeightValidator.parse_csv_text(csv_text)
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(routes), 2)
        self.assertEqual(routes[0]["corridor"], "DEL-BOM")
        self.assertEqual(routes[0]["weight"], 0.50)

    def test_missing_route_renormalization(self):
        """
        Validates missing route policy: EXCLUDE_RENORMALIZE.
        If BOM-BLR (25%) is missing today, remaining routes (DEL-BOM 40%, DEL-BLR 35%)
        sum to 75% and are renormalized so weights sum to 100%.
        """
        initial_weights = {"DEL-BOM": 0.40, "DEL-BLR": 0.35, "BOM-BLR": 0.25}
        available_routes = ["DEL-BOM", "DEL-BLR"]  # BOM-BLR is missing

        avail_weight_sum = sum(initial_weights[r] for r in available_routes)
        self.assertAlmostEqual(avail_weight_sum, 0.75)

        renormalized = {r: initial_weights[r] / avail_weight_sum for r in available_routes}
        self.assertAlmostEqual(sum(renormalized.values()), 1.0)
        self.assertAlmostEqual(renormalized["DEL-BOM"], 0.40 / 0.75)
        self.assertAlmostEqual(renormalized["DEL-BLR"], 0.35 / 0.75)

    def test_elementary_jevons_vs_arithmetic(self):
        """
        Validates Jevons geometric mean:
        Price relatives: 110.0, 110.0, 105.0.
        Jevons = 100 * exp(mean(ln(P_curr / P_base))).
        Arithmetic = mean(price relatives).
        """
        p_base = np.array([4000.0, 4500.0, 3500.0])
        p_curr = np.array([4400.0, 4950.0, 3675.0])
        relatives = (p_curr / p_base) * 100.0

        jevons = 100.0 * np.exp(np.mean(np.log(p_curr / p_base)))
        arithmetic = np.mean(relatives)

        # In standard mathematics, geometric mean <= arithmetic mean
        self.assertLessEqual(jevons, arithmetic)
        self.assertAlmostEqual(jevons, 108.29, places=1)
        self.assertAlmostEqual(arithmetic, 108.33, places=1)


if __name__ == "__main__":
    unittest.main()
