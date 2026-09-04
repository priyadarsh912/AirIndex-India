"""
AirIndex India - Backend Verification Tests
"""

import unittest
from data_generator import generate_fixture_dataset
from quality_engine import process_data_quality
from index_engine import compute_airfare_indexes
from anomaly_engine import detect_airfare_anomalies
from backtest_engine import run_dgca_backtest

class TestAirIndexBackend(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.raw_data = generate_fixture_dataset(30)
        cls.cleaned_data, cls.quality_stats = process_data_quality(cls.raw_data["raw_observations"])
        cls.index_results = compute_airfare_indexes(cls.cleaned_data)
        cls.anomalies = detect_airfare_anomalies(cls.cleaned_data)
        cls.backtest = run_dgca_backtest(cls.index_results["daily_trend"], cls.raw_data["dgca_benchmark"])

    def test_fixture_generation(self):
        self.assertGreater(len(self.raw_data["raw_observations"]), 1000)
        self.assertEqual(len(self.raw_data["dgca_benchmark"]), 30)

    def test_data_quality(self):
        self.assertIn("usable_records", self.quality_stats)
        self.assertGreater(self.quality_stats["usable_records"], 0)
        self.assertGreater(self.quality_stats["avg_quality_score"], 80.0)

    def test_index_computation(self):
        self.assertGreater(self.index_results["current_index"], 50.0)
        self.assertEqual(len(self.index_results["daily_trend"]), 30)
        self.assertEqual(len(self.index_results["routes"]), 52)
        self.assertEqual(len(self.index_results["airlines"]), 4)

    def test_anomalies(self):
        self.assertIsInstance(self.anomalies, list)

    def test_dgca_backtest(self):
        self.assertGreater(self.backtest["correlation"], 0.70)
        self.assertLess(self.backtest["mape_pct"], 10.0)
        self.assertEqual(len(self.backtest["series"]), 30)

if __name__ == "__main__":
    unittest.main()
