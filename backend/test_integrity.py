import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from integrity_engine import GLOBAL_ANTI_CONTAMINATION_ENGINE, partition_observations, run_integrity_engine
from models.flight_envelope import FlightIdentityKey, FlightPricing
from datetime import date

def test_anti_contamination():
    print("=== TEST 1: Flight 6E-339 on HYD-VTZ (Contamination Test) ===")
    is_clean, conf, reasons, features = GLOBAL_ANTI_CONTAMINATION_ENGINE.evaluate_observation(
        flight_number='6E-339',
        origin='HYD',
        destination='VTZ',
        departure_date=date(2026, 9, 20),
        base_fare=2214,
        taxes=524,
        total_fare=2913
    )
    assert not is_clean, "6E-339 on HYD-VTZ must be flagged as contaminated (is_clean=False)!"
    assert conf < 85.0, f"Confidence score ({conf}) must be < 85.0 for contaminated flight!"
    assert any("CRITICAL_IDENTITY_MISMATCH" in r for r in reasons), f"Reasons must cite identity mismatch: {reasons}"
    print(f"PASS: 6E-339 on HYD-VTZ quarantined. Confidence: {conf}%, Reasons: {reasons[0]}")

    print("\n=== TEST 2: Flight 6E-339 on DEL-BOM (Legitimate Route Test) ===")
    is_clean_legit, conf_legit, reasons_legit, _ = GLOBAL_ANTI_CONTAMINATION_ENGINE.evaluate_observation(
        flight_number='6E-339',
        origin='DEL',
        destination='BOM',
        departure_date=date(2026, 9, 20),
        base_fare=5000,
        taxes=900,
        total_fare=6300
    )
    assert is_clean_legit, "6E-339 on DEL-BOM must be recognized as legitimate (is_clean=True)!"
    assert conf_legit >= 85.0, f"Confidence score ({conf_legit}) must be >= 85.0!"
    assert len(reasons_legit) == 0, f"Expected 0 violations on legitimate route, got: {reasons_legit}"
    print(f"PASS: 6E-339 on DEL-BOM verified. Confidence: {conf_legit}%")

    print("\n=== TEST 3: Envelope Arithmetic Boundary Validation ===")
    try:
        p = FlightPricing(
            base_fare=4000,
            statutory_taxes=800,
            user_development_fee=200,
            fuel_charge=300,
            total_price=9000, # Drifted sum: 5300 != 9000
            currency="INR"
        )
        assert False, "Arithmetic mismatch must trigger ValidationError!"
    except Exception as e:
        print(f"PASS: Caught arithmetic integrity violation ({type(e).__name__})")

    print("\n=== TEST 4: Data Store Partitioning (Clean vs Quarantined) ===")
    batch = [
        {'id': 'REC-1', 'route': 'HYD-VTZ', 'airline': 'IndiGo', 'flight_number': '6E-339', 'origin': 'HYD', 'destination': 'VTZ', 'total_fare': 2913, 'base_fare': 2214, 'taxes': 524, 'fees': 175},
        {'id': 'REC-2', 'route': 'DEL-BOM', 'airline': 'IndiGo', 'flight_number': '6E-339', 'origin': 'DEL', 'destination': 'BOM', 'total_fare': 5900, 'base_fare': 4700, 'taxes': 900, 'fees': 300},
        {'id': 'REC-3', 'route': 'DEL-BOM', 'airline': 'Air India', 'flight_number': 'AI-101', 'origin': 'DEL', 'destination': 'BOM', 'total_fare': 6200, 'base_fare': 5000, 'taxes': 900, 'fees': 300},
        {'id': 'REC-4', 'route': 'DEL-BOM', 'airline': 'IndiGo', 'flight_number': 'XX-999', 'origin': 'DEL', 'destination': 'BOM', 'total_fare': 5000, 'base_fare': 4000, 'taxes': 700, 'fees': 300},
    ]
    clean, quarantined, telemetry = partition_observations(batch)
    assert len(clean) == 2, f"Expected 2 clean records, got {len(clean)}"
    assert len(quarantined) == 2, f"Expected 2 quarantined records, got {len(quarantined)}"
    assert quarantined[0]['flight_number'] == '6E-339'
    assert quarantined[0]['self_healing_suggested_route'] == 'DEL-BOM'
    print(f"PASS: Batch partitioned into {len(clean)} clean and {len(quarantined)} quarantined records.")
    print(f"PASS: Self-healing suggestion for 6E-339: {quarantined[0]['self_healing_suggested_route']}")

    print("\nAll Anti-Contamination & Integrity Tests PASSED successfully!")

if __name__ == "__main__":
    test_anti_contamination()
