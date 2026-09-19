"""
Test suite for Selenium 30-Day Scraper and Backtest Analytics Engine
"""

import os
import sys
import unittest
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from selenium_scraper import run_30day_selenium_backtest_scrape
from backtest_analytics import compute_30day_airfare_index, load_30day_dataset


class TestSeleniumBacktest(unittest.TestCase):

    def test_01_scraper_pipeline(self):
        print("\n--- Testing 30-Day Selenium Scraper Pipeline ---")
        observations, summary = run_30day_selenium_backtest_scrape(origin="DEL", destination="BOM")
        self.assertEqual(summary["status"], "SUCCESS")
        self.assertEqual(len(observations), 120)  # 4 airlines x 30 days
        self.assertTrue(os.path.exists(summary["csv_path"]))
        print(f"Scrape completed successfully: {len(observations)} records saved to CSV.")

    def test_02_load_dataset(self):
        print("\n--- Testing Load 30-Day Dataset ---")
        df = load_30day_dataset()
        self.assertFalse(df.empty)
        self.assertIn("total_fare", df.columns)
        print(f"Loaded dataset containing {len(df)} rows.")

    def test_03_index_analytics_computation(self):
        print("\n--- Testing Index Analytics Engine ---")
        res = compute_30day_airfare_index()
        self.assertEqual(res["status"], "SUCCESS")
        self.assertIn("metrics", res)
        self.assertIn("time_series", res)
        self.assertGreaterEqual(len(res["time_series"]), 25)
        metrics = res["metrics"]
        print(f"Pearson r: {metrics['pearson_correlation']}, MAPE: {metrics['mape_pct']}%, RMSE: {metrics['rmse']}")
        self.assertGreater(metrics["pearson_correlation"], 0.5)


if __name__ == "__main__":
    unittest.main()
