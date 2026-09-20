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

    def test_paasche_and_fisher_properties(self):
        """
        Verify real Paasche and Fisher index properties:
        1. paasche_idx is computed independently from observation volumes (not a fixed algebraic transformation of Laspeyres)
        2. fisher_idx falls between laspeyres and paasche (or equals them)
        3. when route observation volumes are uniform across routes with equal base weights, paasche_idx equals laspeyres_idx
        """
        import numpy as np
        daily_trend = self.index_results.get("daily_trend", [])
        self.assertGreater(len(daily_trend), 0)

        # 1. Independent computation check
        ratios = []
        old_sine_diffs = []
        for i, pt in enumerate(daily_trend):
            lasp = pt["weighted_index"]
            paas = pt.get("paasche_index", lasp)
            fish = pt["fisher_index"]
            
            # Ratio between Paasche and Laspeyres
            ratios.append(round(paas / lasp, 4))
            
            # Verify NOT using the old fixed sine wave formula: lasp * (1.0 + 0.012 * sin(i))
            expected_old_paas = round(lasp * (1.0 + 0.012 * np.sin(i)), 2)
            old_sine_diffs.append(abs(paas - expected_old_paas))

            # 2. Fisher Index must fall between Laspeyres and Paasche (within 0.02 rounding tolerance)
            lower_bound = min(lasp, paas) - 0.02
            upper_bound = max(lasp, paas) + 0.02
            self.assertGreaterEqual(fish, lower_bound, f"Fisher index {fish} below lower bound {lower_bound} on day {pt['date']}")
            self.assertLessEqual(fish, upper_bound, f"Fisher index {fish} above upper bound {upper_bound} on day {pt['date']}")

        # Ratios vary across days according to actual observation volumes (not a static constant)
        self.assertGreater(len(set(ratios)), 1, "Paasche/Laspeyres ratios should vary across days based on empirical observation volume")
        # Ensure it differs significantly from the old fake sine wave
        self.assertGreater(sum(old_sine_diffs), 0.5, "Paasche index should not match legacy sine wave simulation")

        # 3. Uniform observation volume sanity check:
        # Routes DEL-BOM and BOM-DEL have identical base weights (0.080) and base prices
        # When both have identical observation counts, current weights (0.5, 0.5) equal base weights (0.5, 0.5)
        # Therefore, Paasche must equal Laspeyres exactly
        uniform_obs = []
        for _ in range(10):
            uniform_obs.append({
                "capture_date": "2026-09-01",
                "route": "DEL-BOM",
                "total_fare": 5000.0,
                "is_usable": True,
                "availability_status": "AVAILABLE",
                "status": "AVAILABLE"
            })
            uniform_obs.append({
                "capture_date": "2026-09-01",
                "route": "BOM-DEL",
                "total_fare": 5500.0,
                "is_usable": True,
                "availability_status": "AVAILABLE",
                "status": "AVAILABLE"
            })

        uniform_res = compute_airfare_indexes(uniform_obs)
        trend_u = uniform_res.get("daily_trend", [])
        self.assertEqual(len(trend_u), 1)
        u_lasp = trend_u[0]["weighted_index"]
        u_paas = trend_u[0]["paasche_index"]
        u_fish = trend_u[0]["fisher_index"]
        self.assertAlmostEqual(u_paas, u_lasp, places=2, msg="With uniform observation volumes and equal base weights, Paasche must equal Laspeyres")
        self.assertAlmostEqual(u_fish, u_lasp, places=2, msg="Fisher must equal Laspeyres when Paasche equals Laspeyres")


if __name__ == "__main__":
    unittest.main()
