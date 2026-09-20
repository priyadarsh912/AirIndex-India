"""
AirIndex India - Backend Verification Tests
"""

import unittest
from data_generator import generate_fixture_dataset
from quality_engine import process_data_quality
from index_engine import compute_airfare_indexes, aggregate_trend_by_frequency
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


class TestAggregation(unittest.TestCase):
    """
    Verify that aggregate_trend_by_frequency performs real calendar-based
    arithmetic mean aggregation with no hardcoded/fictional data.
    """

    def _make_daily_indexes(self, num_days=21, start_date="2026-08-01"):
        """Build a synthetic daily_indexes list spanning num_days."""
        from datetime import datetime, timedelta
        base_dt = datetime.strptime(start_date, "%Y-%m-%d")
        items = []
        for d in range(num_days):
            dt = base_dt + timedelta(days=d)
            # Deterministic values that vary per day so averages are verifiable
            w_idx = 100.0 + d * 1.5
            items.append({
                "date": dt.strftime("%Y-%m-%d"),
                "full_date": dt.strftime("%Y-%m-%d"),
                "weighted_index": round(w_idx, 2),
                "jevons_index": round(w_idx - 0.5, 2),
                "fisher_index": round(w_idx + 0.3, 2),
                "paasche_index": round(w_idx + 0.1, 2),
                "avg_fare": round(4000 + d * 50, 2),
                "observation_count": 100 + d,
            })
        return items

    def test_daily_passthrough(self):
        """Daily frequency returns input unchanged."""
        daily = self._make_daily_indexes(7)
        result = aggregate_trend_by_frequency(daily, "Daily")
        self.assertEqual(result, daily)

    def test_empty_input(self):
        """Empty list returns empty for any frequency."""
        self.assertEqual(aggregate_trend_by_frequency([], "Weekly"), [])
        self.assertEqual(aggregate_trend_by_frequency([], "Monthly"), [])

    def test_weekly_bucket_count(self):
        """21 days starting Mon Aug 01 should yield exactly 3 full ISO weeks."""
        daily = self._make_daily_indexes(21, start_date="2026-08-03")  # Mon Aug 3
        result = aggregate_trend_by_frequency(daily, "Weekly")
        self.assertEqual(len(result), 3, f"Expected 3 weekly buckets, got {len(result)}")

    def test_weekly_mean_correctness(self):
        """Weekly weighted_index must equal arithmetic mean of its constituent daily values."""
        daily = self._make_daily_indexes(14, start_date="2026-08-03")  # 2 full weeks
        result = aggregate_trend_by_frequency(daily, "Weekly")
        self.assertEqual(len(result), 2)

        # Week 1: days 0-6, weighted_index = 100.0, 101.5, 103.0, 104.5, 106.0, 107.5, 109.0
        week1_vals = [100.0 + i * 1.5 for i in range(7)]
        expected_w1_mean = round(sum(week1_vals) / 7, 2)
        self.assertAlmostEqual(result[0]["weighted_index"], expected_w1_mean, places=1,
                               msg="Week 1 weighted_index should be arithmetic mean of daily values")

        # Week 2: days 7-13, weighted_index = 110.5, 112.0, 113.5, 115.0, 116.5, 118.0, 119.5
        week2_vals = [100.0 + i * 1.5 for i in range(7, 14)]
        expected_w2_mean = round(sum(week2_vals) / 7, 2)
        self.assertAlmostEqual(result[1]["weighted_index"], expected_w2_mean, places=1,
                               msg="Week 2 weighted_index should be arithmetic mean of daily values")

    def test_weekly_observation_count_is_sum(self):
        """Weekly observation_count must be the SUM (not mean) of daily observation counts."""
        daily = self._make_daily_indexes(7, start_date="2026-08-03")
        result = aggregate_trend_by_frequency(daily, "Weekly")
        self.assertEqual(len(result), 1)

        expected_sum = sum(100 + i for i in range(7))  # 100+101+102+103+104+105+106 = 721
        self.assertEqual(result[0]["observation_count"], expected_sum,
                         f"observation_count should be sum={expected_sum}, got {result[0]['observation_count']}")

    def test_weekly_label_format(self):
        """Weekly labels should follow 'W<n> (<Mon DD>-<Mon DD>)' format."""
        import re
        daily = self._make_daily_indexes(7, start_date="2026-08-03")
        result = aggregate_trend_by_frequency(daily, "Weekly")
        label = result[0]["date"]
        self.assertRegex(label, r"^W\d+ \([A-Z][a-z]{2} \d{2}-[A-Z][a-z]{2} \d{2}\)$",
                         f"Label format incorrect: {label}")

    def test_monthly_bucket_count(self):
        """62 days spanning Jul+Aug+partial Sep should yield 3 monthly buckets."""
        daily = self._make_daily_indexes(63, start_date="2026-07-01")
        result = aggregate_trend_by_frequency(daily, "Monthly")
        self.assertEqual(len(result), 3, f"Expected 3 monthly buckets, got {len(result)}")

    def test_monthly_mean_correctness(self):
        """Monthly weighted_index must equal arithmetic mean of daily values in that month."""
        # July has 31 days
        daily = self._make_daily_indexes(31, start_date="2026-07-01")
        result = aggregate_trend_by_frequency(daily, "Monthly")
        self.assertEqual(len(result), 1)

        expected_mean = round(sum(100.0 + i * 1.5 for i in range(31)) / 31, 2)
        self.assertAlmostEqual(result[0]["weighted_index"], expected_mean, places=1,
                               msg="Monthly weighted_index should be arithmetic mean of daily values")

    def test_no_hardcoded_labels(self):
        """Verify no legacy hardcoded labels like 'Independence Day' or 'MoSPI' appear."""
        daily = self._make_daily_indexes(90, start_date="2026-07-01")
        weekly = aggregate_trend_by_frequency(daily, "Weekly")
        monthly = aggregate_trend_by_frequency(daily, "Monthly")

        for item in weekly + monthly:
            for field in ["date", "full_date"]:
                val = item.get(field, "")
                self.assertNotIn("Independence Day", val, f"Hardcoded label found in {field}: {val}")
                self.assertNotIn("MoSPI", val, f"Hardcoded label found in {field}: {val}")
                self.assertNotIn("Diwali", val, f"Hardcoded label found in {field}: {val}")
                self.assertNotIn("monsoon", val.lower(), f"Hardcoded label found in {field}: {val}")

    def test_partial_week_included(self):
        """A partial week (fewer than 7 days) should still appear as a bucket."""
        # 10 days = 1 full week + 3 day partial week
        daily = self._make_daily_indexes(10, start_date="2026-08-03")  # Mon
        result = aggregate_trend_by_frequency(daily, "Weekly")
        self.assertEqual(len(result), 2, "Partial week should be included")

    def test_weekly_aggregation_mathematically_derived(self):
        """
        Builds a small fake daily_indexes list spanning 2 different weeks with known
        weighted_index values, calls aggregate_trend_by_frequency(..., 'Weekly'), and
        asserts returned weekly weighted_index for each week equals the actual mean of
        that week's input values within floating point tolerance.
        """
        # Week 1: 2026-08-03 (Monday) to 2026-08-05 (Wednesday) -> ISO week (2026, 32)
        # Week 2: 2026-08-10 (Monday) to 2026-08-11 (Tuesday) -> ISO week (2026, 33)
        fake_daily = [
            # Week 1 entries with known weighted_index values
            {
                "date": "2026-08-03",
                "weighted_index": 102.4,
                "jevons_index": 101.9,
                "fisher_index": 102.6,
                "paasche_index": 102.8,
                "avg_fare": 4100.0,
                "observation_count": 120,
            },
            {
                "date": "2026-08-04",
                "weighted_index": 108.6,
                "jevons_index": 108.1,
                "fisher_index": 108.7,
                "paasche_index": 108.9,
                "avg_fare": 4350.0,
                "observation_count": 150,
            },
            {
                "date": "2026-08-05",
                "weighted_index": 114.2,
                "jevons_index": 113.8,
                "fisher_index": 114.4,
                "paasche_index": 114.6,
                "avg_fare": 4580.0,
                "observation_count": 180,
            },
            # Week 2 entries with known weighted_index values
            {
                "date": "2026-08-10",
                "weighted_index": 121.5,
                "jevons_index": 120.9,
                "fisher_index": 121.8,
                "paasche_index": 122.0,
                "avg_fare": 4900.0,
                "observation_count": 210,
            },
            {
                "date": "2026-08-11",
                "weighted_index": 129.5,
                "jevons_index": 128.7,
                "fisher_index": 129.8,
                "paasche_index": 130.1,
                "avg_fare": 5220.0,
                "observation_count": 240,
            },
        ]

        result = aggregate_trend_by_frequency(fake_daily, frequency="Weekly")

        # Must return exactly 2 weekly buckets corresponding to the 2 real weeks of data
        self.assertEqual(len(result), 2)

        # Expected Week 1 mean: (102.4 + 108.6 + 114.2) / 3 = 108.40
        expected_w1_mean = (102.4 + 108.6 + 114.2) / 3.0
        self.assertAlmostEqual(result[0]["weighted_index"], expected_w1_mean, places=2,
                               msg="Week 1 weighted_index must equal the arithmetic mean of its daily inputs")
        self.assertEqual(result[0]["observation_count"], 120 + 150 + 180)

        # Expected Week 2 mean: (121.5 + 129.5) / 2 = 125.50
        expected_w2_mean = (121.5 + 129.5) / 2.0
        self.assertAlmostEqual(result[1]["weighted_index"], expected_w2_mean, places=2,
                               msg="Week 2 weighted_index must equal the arithmetic mean of its daily inputs")
        self.assertEqual(result[1]["observation_count"], 210 + 240)


if __name__ == "__main__":
    unittest.main()


