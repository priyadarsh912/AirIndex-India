"""
AirScope — Comprehensive Fare Intelligence Test Suite
Covers:
1. Fare classification and normalization
2. Price component decomposition & arithmetic validation
3. Missing component tolerance & NULL safety
4. Sold-out and cancellation handling (no zero price, preserved historically, excluded from price index)
5. Deterministic fingerprinting & duplicate detection
6. Availability analytics & Price movement decomposition
7. FastAPI REST API endpoints (/api/fares, /api/fares/{id}/breakdown, /api/fares/availability, /api/fares/quality, /api/index/airfare)
"""

import unittest
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fare_normalizer import FareNormalizer
from fare_validator import FareValidator
from quality_engine import process_data_quality
from index_engine import compute_airfare_indexes
from fastapi.testclient import TestClient
import main


class TestFareNormalization(unittest.TestCase):
    """Verifies strict normalization rules: never guess; default to UNKNOWN when ambiguous."""

    def test_economy_basic(self):
        res = FareNormalizer.normalize(raw_text="Economy")
        self.assertEqual(res["cabin_class"], "ECONOMY")
        self.assertEqual(res["fare_family"], "UNKNOWN")

    def test_economy_saver(self):
        res = FareNormalizer.normalize(raw_text="Economy Saver")
        self.assertEqual(res["cabin_class"], "ECONOMY")
        self.assertEqual(res["fare_family"], "SAVER")
        self.assertEqual(res["fare_brand"], "Economy Saver")

    def test_business_flexi(self):
        res = FareNormalizer.normalize(raw_text="Business Flexi Plus")
        self.assertEqual(res["cabin_class"], "BUSINESS")
        self.assertEqual(res["fare_family"], "FLEXI")

    def test_premium_economy(self):
        res = FareNormalizer.normalize(raw_text="Premium Economy Standard")
        self.assertEqual(res["cabin_class"], "PREMIUM_ECONOMY")
        self.assertEqual(res["fare_family"], "REGULAR")

    def test_corporate_fare(self):
        res = FareNormalizer.normalize(raw_text="Corporate Fare", source_cabin="Economy")
        self.assertEqual(res["cabin_class"], "ECONOMY")
        self.assertEqual(res["fare_family"], "CORPORATE")

    def test_unknown_string(self):
        res = FareNormalizer.normalize(raw_text="XYZ Promo Tariff 99")
        self.assertEqual(res["cabin_class"], "UNKNOWN")
        self.assertEqual(res["fare_family"], "PROMO")


class TestFareCalculationAndValidation(unittest.TestCase):
    """Verifies component arithmetic, tolerance thresholds, and quality flagging."""

    def test_arithmetic_exact_match(self):
        quote = {
            "source": "MakeMyTrip",
            "airline": "IndiGo",
            "flight_number": "6E-201",
            "origin": "DEL",
            "destination": "BOM",
            "travel_date": "2026-09-25",
            "cabin_class": "ECONOMY",
            "fare_family": "SAVER",
            "base_fare": 3800.0,
            "taxes": 1100.0,
            "airline_surcharge": 200.0,
            "convenience_fee": 199.0,
            "payment_fee": 0.0,
            "other_fee": 183.0,
            "total_fare": 5482.0,
            "availability_status": "AVAILABLE"
        }
        res = FareValidator.validate_and_assess_quality(quote)
        self.assertEqual(res["calculated_component_total"], 5482.0)
        self.assertEqual(res["fare_difference"], 0.0)
        self.assertEqual(res["data_quality_status"], "VALID")
        self.assertNotIn("TOTAL_FARE_MISMATCH", res["quality_flags"])
        self.assertTrue(res["is_usable"])

    def test_arithmetic_mismatch_detection(self):
        quote = {
            "source": "OTA_X",
            "airline": "Air India",
            "flight_number": "AI-801",
            "origin": "DEL",
            "destination": "BLR",
            "travel_date": "2026-09-25",
            "cabin_class": "ECONOMY",
            "fare_family": "REGULAR",
            "base_fare": 4000.0,
            "taxes": 1000.0,
            "convenience_fee": 250.0,
            "total_fare": 6000.0,  # 750 INR mismatch!
            "availability_status": "AVAILABLE"
        }
        res = FareValidator.validate_and_assess_quality(quote)
        self.assertEqual(res["calculated_component_total"], 5250.0)
        self.assertEqual(res["fare_difference"], 750.0)
        self.assertIn("TOTAL_FARE_MISMATCH", res["quality_flags"])
        self.assertEqual(res["data_quality_status"], "INVALID")
        self.assertFalse(res["is_usable"])

    def test_missing_components_graceful_handling(self):
        """Ensures NULL components do NOT cause crashes and emit appropriate disclosure flags."""
        quote = {
            "source": "MinimalSource",
            "airline": "Akasa Air",
            "flight_number": "QP-110",
            "origin": "BOM",
            "destination": "DEL",
            "travel_date": "2026-09-25",
            "cabin_class": "ECONOMY",
            "fare_family": "UNKNOWN",
            "base_fare": None,
            "taxes": None,
            "convenience_fee": None,
            "total_fare": 4890.0,
            "availability_status": "AVAILABLE"
        }
        res = FareValidator.validate_and_assess_quality(quote)
        self.assertIsNone(res["base_fare"])
        self.assertIsNone(res["taxes"])
        self.assertIsNone(res["convenience_fee"])
        self.assertEqual(res["total_fare"], 4890.0)
        self.assertIn("BASE_FARE_UNAVAILABLE", res["quality_flags"])
        self.assertIn("TAX_BREAKDOWN_UNAVAILABLE", res["quality_flags"])
        self.assertIn("CONVENIENCE_FEE_NOT_DISCLOSED", res["quality_flags"])
        self.assertEqual(res["data_quality_status"], "PARTIAL")
        self.assertTrue(res["is_usable"])  # Usable because total_fare is valid positive number


class TestAvailabilityHandling(unittest.TestCase):
    """Verifies that SOLD_OUT and CANCELLED flights are retained with total_fare = None, not 0."""

    def test_sold_out_handling(self):
        quote = {
            "source": "MakeMyTrip",
            "airline": "IndiGo",
            "flight_number": "6E-555",
            "origin": "DEL",
            "destination": "BOM",
            "travel_date": "2026-09-21",
            "cabin_class": "ECONOMY",
            "total_fare": 5200.0,  # Even if raw parser passed a stale price, sold out must clear it!
            "availability_status": "SOLD_OUT"
        }
        res = FareValidator.validate_and_assess_quality(quote)
        self.assertEqual(res["availability_status"], "SOLD_OUT")
        self.assertIsNone(res["total_fare"])  # Must be None, NOT 0!
        self.assertIn("SOLD_OUT", res["quality_flags"])
        self.assertEqual(res["data_quality_status"], "UNAVAILABLE")
        self.assertFalse(res["is_usable"])  # Never directly enters price index

    def test_cancellation_handling(self):
        quote = {
            "source": "DGCA_Feed",
            "airline": "Air India",
            "flight_number": "AI-102",
            "origin": "DEL",
            "destination": "CCU",
            "travel_date": "2026-09-22",
            "availability_status": "CANCELLED"
        }
        res = FareValidator.validate_and_assess_quality(quote)
        self.assertEqual(res["availability_status"], "CANCELLED")
        self.assertIsNone(res["total_fare"])
        self.assertIn("CANCELLED", res["quality_flags"])
        self.assertEqual(res["data_quality_status"], "UNAVAILABLE")
        self.assertFalse(res["is_usable"])


class TestDuplicateFingerprinting(unittest.TestCase):
    """Verifies deterministic composite_key generation."""

    def test_identical_fingerprint(self):
        fp1 = FareValidator.generate_fingerprint(
            source="MakeMyTrip",
            airline="IndiGo",
            flight_number="6E-101",
            origin="DEL",
            destination="BOM",
            travel_date="2026-09-25",
            cabin_class="ECONOMY",
            fare_family="SAVER",
            timestamp="2026-09-20T10:12:00Z",
            bucket_minutes=15
        )
        fp2 = FareValidator.generate_fingerprint(
            source="MakeMyTrip",
            airline="IndiGo",
            flight_number="6E-101",
            origin="DEL",
            destination="BOM",
            travel_date="2026-09-25",
            cabin_class="ECONOMY",
            fare_family="SAVER",
            timestamp="2026-09-20T10:14:30Z",  # Within same 15m bucket
            bucket_minutes=15
        )
        self.assertEqual(fp1, fp2)

    def test_distinct_fingerprint_across_fare_family(self):
        fp_saver = FareValidator.generate_fingerprint(
            source="MakeMyTrip",
            airline="IndiGo",
            flight_number="6E-101",
            origin="DEL",
            destination="BOM",
            travel_date="2026-09-25",
            cabin_class="ECONOMY",
            fare_family="SAVER",
            timestamp="2026-09-20T10:12:00Z"
        )
        fp_flexi = FareValidator.generate_fingerprint(
            source="MakeMyTrip",
            airline="IndiGo",
            flight_number="6E-101",
            origin="DEL",
            destination="BOM",
            travel_date="2026-09-25",
            cabin_class="ECONOMY",
            fare_family="FLEXI",
            timestamp="2026-09-20T10:12:00Z"
        )
        self.assertNotEqual(fp_saver, fp_flexi)


class TestIndexPipelineAndDecomposition(unittest.TestCase):
    """Verifies that the index pipeline excludes sold out/cancelled flights and computes decomposition."""

    def test_index_excludes_unavailable(self):
        records = [
            {
                "id": "OBS-1",
                "route": "DEL-BOM",
                "airline": "IndiGo",
                "capture_date": "2026-09-19",
                "booking_window": "T+7",
                "cabin_class": "ECONOMY",
                "total_fare": 5000.0,
                "base_fare": 3900.0,
                "taxes": 850.0,
                "fees": 250.0,
                "availability_status": "AVAILABLE",
                "is_usable": True,
                "quality_score": 95
            },
            {
                "id": "OBS-2",
                "route": "DEL-BOM",
                "airline": "Air India",
                "capture_date": "2026-09-19",
                "booking_window": "T+7",
                "cabin_class": "ECONOMY",
                "total_fare": None,  # Sold out flight!
                "availability_status": "SOLD_OUT",
                "is_usable": False,
                "quality_score": 70
            },
            {
                "id": "OBS-3",
                "route": "DEL-BOM",
                "airline": "SpiceJet",
                "capture_date": "2026-09-19",
                "booking_window": "T+7",
                "cabin_class": "ECONOMY",
                "total_fare": None,  # Cancelled flight!
                "availability_status": "CANCELLED",
                "is_usable": False,
                "quality_score": 70
            },
        ]

        cleaned, stats = process_data_quality(records)
        self.assertEqual(stats["available_count"], 1)
        self.assertEqual(stats["sold_out_count"], 1)
        self.assertEqual(stats["cancelled_count"], 1)
        self.assertAlmostEqual(stats["sold_out_rate_pct"], 33.3, places=1)

        idx_res = compute_airfare_indexes(cleaned)
        # Average fare must NOT be contaminated by 0
        self.assertEqual(idx_res["overall_avg_fare"], 5000.0)
        self.assertEqual(idx_res["usable_observations"], 1)
        self.assertEqual(idx_res["total_observations"], 3)


class TestFareAPIRoutes(unittest.TestCase):
    """Verifies FastAPI REST API endpoint handler functions directly."""

    def test_get_fares_endpoint(self):
        res = main.get_fares_list(limit=5)
        self.assertIn("total", res)
        self.assertIn("data", res)
        self.assertLessEqual(len(res["data"]), 5)

    def test_get_fares_availability_endpoint(self):
        res = main.get_fares_availability_analytics()
        self.assertIn("availability_rate_pct", res)
        self.assertIn("sold_out_rate_pct", res)
        self.assertIn("cancellation_rate_pct", res)
        self.assertIn("routes_breakdown", res)
        self.assertGreater(res["total_monitored_inventory"], 0)

    def test_get_fares_quality_endpoint(self):
        res = main.get_fares_quality_monitoring()
        self.assertIn("total_quotes", res)
        self.assertIn("quality_flags_breakdown", res)
        self.assertIn("source_performance", res)
        self.assertGreater(res["total_quotes"], 0)

    def test_get_route_price_history_endpoint(self):
        res = main.get_route_price_history(route_code="DEL-BOM", days=10)
        self.assertEqual(res["route"], "DEL-BOM")
        self.assertIn("history", res)

    def test_get_fare_breakdown_endpoint(self):
        # Pick any observation from clean observations
        if main.CLEAN_FLIGHT_OBSERVATIONS:
            target_id = main.CLEAN_FLIGHT_OBSERVATIONS[0].get("id")
            res = main.get_fare_breakdown(target_id)
            self.assertEqual(res["id"], target_id)
            self.assertIn("cabin_class", res)
            self.assertIn("fare_family", res)
            self.assertIn("data_quality_status", res)

    def test_get_index_airfare_endpoint(self):
        res = main.get_airfare_index(cabin_class="ECONOMY")
        self.assertIn("current_index", res)
        self.assertIn("price_decomposition", res)
        self.assertIn("availability_rate_pct", res)


if __name__ == "__main__":
    unittest.main()
