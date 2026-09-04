import sys
sys.path.insert(0, '.')
from integrity_engine import run_integrity_engine

bad_records = [
    {'id': 'LIVE-IXI-SCRAPED-2906', 'route': 'HYD-VTZ', 'airline': 'IndiGo', 'flight_number': '6E-336', 'origin': 'HYD', 'destination': 'VTZ', 'total_fare': 4138, 'base_fare': 3145, 'taxes': 745, 'fees': 248, 'booking_window': 'T+1', 'status': 'AVAILABLE'},
    {'id': 'LIVE-IXI-SCRAPED-2907', 'route': 'HYD-VTZ', 'airline': 'IndiGo', 'flight_number': '6E-337', 'origin': 'HYD', 'destination': 'VTZ', 'total_fare': 3476, 'base_fare': 2642, 'taxes': 626, 'fees': 208, 'booking_window': 'T+7', 'status': 'AVAILABLE'},
    {'id': 'LIVE-IXI-SCRAPED-2909', 'route': 'HYD-VTZ', 'airline': 'IndiGo', 'flight_number': '6E-339', 'origin': 'HYD', 'destination': 'VTZ', 'total_fare': 2913, 'base_fare': 2214, 'taxes': 524, 'fees': 175, 'booking_window': 'T+30', 'status': 'AVAILABLE'},
    {'id': 'LIVE-IXI-1788462691292-899', 'route': 'DEL-BOM', 'airline': 'Air India', 'flight_number': 'IXI-869', 'origin': 'DEL', 'destination': 'BOM', 'total_fare': 1449, 'base_fare': 1101, 'taxes': 261, 'fees': 87, 'booking_window': 'T+1', 'status': 'AVAILABLE'},
]

corrected, report = run_integrity_engine(bad_records)
print("=== INTEGRITY REPORT ===")
print("Total:", report["total_observations"])
print("Synthetic Flights Replaced:", report["synthetic_flights_replaced"])
print("Fare Components Fixed:", report["fare_components_fixed"])
print("Data Integrity pct:", report["data_integrity_pct"])
print()
for rec in corrected:
    print("ID:", rec["id"])
    print("  Route:", rec["route"])
    orig = rec.get("flight_number_original", rec["flight_number"])
    print("  Flight (before):", orig)
    print("  Flight (after):", rec["flight_number"])
    print("  Status:", rec.get("integrity_status"))
    print("  Registry:", rec.get("registry_validation"))
    for issue in (rec.get("integrity_issues") or []):
        print("  ISSUE:", issue)
    print()
