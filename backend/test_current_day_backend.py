"""
Test Suite: Strict Current Calendar Day Ingestion & Query Logic
Validates:
1. Dynamic timezone-aware determination of 'today' at request time.
2. Strict date filtering ensuring zero mixing with older records.
3. Structured empty/fallback state when no records exist for target day.
4. Zero fallback to stale last modified/updated record dates.
"""

import sys
import os
import sys
import os
import json
import urllib.request
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import compute_current_day_index_response, get_server_today

BASE_URL = "http://localhost:8000"

def fetch_json(endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "TestClient/1.0"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def test_dynamic_today_determination():
    print("\n--- TEST 1: Dynamic Server Today Determination ---")
    today_ist = get_server_today("Asia/Kolkata")
    today_utc = get_server_today("UTC")
    today_ny = get_server_today("America/New_York")
    
    print(f"IST Today: {today_ist} | UTC Today: {today_utc} | NY Today: {today_ny}")
    assert isinstance(today_ist, date), "get_server_today must return a datetime.date object"
    assert today_ist.year >= 2026, "Expected year >= 2026"
    print("PASS: Dynamic today correctly determined across timezones.")

def test_current_day_index_strict_filtering():
    print("\n--- TEST 2: Strict Current Calendar Day Index Computation ---")
    res = compute_current_day_index_response(tz="Asia/Kolkata")
    
    assert res["data_available"] is True, "Expected data_available to be True for current day fixture"
    assert res["calendar_date"] == get_server_today("Asia/Kolkata").strftime("%Y-%m-%d"), "calendar_date must match today's date"
    assert res["current_index"] is not None and res["current_index"] > 0, "current_index must be computed"
    assert res["total_observations"] > 0, "total_observations must reflect today's records"
    assert res["timezone"] == "Asia/Kolkata"
    print(f"PASS: Current day ({res['calendar_date']}) index computed: {res['current_index']} ({res['total_observations']} observations)")

def test_empty_fallback_state_on_missing_data():
    print("\n--- TEST 3: Strict Empty/Fallback State When No Data Exists ---")
    future_date = date(2099, 12, 31)
    res = compute_current_day_index_response(target_date=future_date, tz="Asia/Kolkata")
    
    assert res["data_available"] is False, "data_available must be False when no observations exist"
    assert res["calendar_date"] == "2099-12-31", "calendar_date must preserve requested target date"
    assert res["current_index"] is None, "current_index must be None, NOT defaulting to older records!"
    assert res["change_24h_pct"] is None, "change_24h_pct must be None"
    assert res["change_7d_pct"] is None, "change_7d_pct must be None"
    assert res["overall_avg_fare_inr"] is None, "overall_avg_fare_inr must be None"
    assert res["total_observations"] == 0, "total_observations must be 0"
    assert res["usable_observations"] == 0, "usable_observations must be 0"
    assert "No flight observations recorded" in res["message"]
    print("PASS: Structured fallback response returned without defaulting to older records.")

def test_api_endpoints():
    print("\n--- TEST 4: Live HTTP Endpoint Verification (v1 & v2) ---")
    
    # 1. /api/v2/index/current (Default page load)
    data_v2 = fetch_json("/api/v2/index/current?tz=Asia/Kolkata")
    assert data_v2["data_available"] is True
    assert data_v2["calendar_date"] == str(get_server_today("Asia/Kolkata"))
    assert data_v2["current_index"] > 0
    print(f"PASS: /api/v2/index/current -> {data_v2['calendar_date']} (Index: {data_v2['current_index']})")

    # 2. /api/v2/index/current with missing date -> empty state
    data_v2_empty = fetch_json("/api/v2/index/current?target_date=2099-01-01&tz=Asia/Kolkata")
    assert data_v2_empty["data_available"] is False
    assert data_v2_empty["current_index"] is None
    assert data_v2_empty["total_observations"] == 0
    print("PASS: /api/v2/index/current with missing date returns data_available=False and current_index=null")

    # 3. /api/v2/observations default behavior (strictly today)
    data_obs = fetch_json("/api/v2/observations?page_size=5&tz=Asia/Kolkata")
    assert data_obs["is_current_day_filter"] is True
    assert data_obs["calendar_date"] == str(get_server_today("Asia/Kolkata"))
    for item in data_obs["data"]:
        assert item["capture_date"] == str(get_server_today("Asia/Kolkata"))
    print(f"PASS: /api/v2/observations strictly filtered by current calendar day ({data_obs['calendar_date']})")

    # 4. /api/v2/index/history default anchoring
    data_hist = fetch_json("/api/v2/index/history?tz=Asia/Kolkata")
    assert data_hist["query_filters"]["end_date"] == str(get_server_today("Asia/Kolkata"))
    print(f"PASS: /api/v2/index/history dynamically anchored up to today ({data_hist['query_filters']['end_date']})")

    # 5. /api/index/current (v1 backward compatibility)
    data_v1 = fetch_json("/api/index/current?tz=Asia/Kolkata")
    assert data_v1["data_available"] is True
    assert data_v1["calendar_date"] == str(get_server_today("Asia/Kolkata"))
    print(f"PASS: /api/index/current backward compatibility verified.")

if __name__ == "__main__":
    test_dynamic_today_determination()
    test_current_day_index_strict_filtering()
    test_empty_fallback_state_on_missing_data()
    test_api_endpoints()
    print("\nALL CURRENT-DAY INGESTION & QUERY TESTS PASSED SUCCESSFULLY! [OK]")
