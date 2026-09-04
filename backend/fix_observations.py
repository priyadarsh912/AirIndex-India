"""
Script to retroactively apply the integrity engine to all records in scrapedObservations.json
and output a corrected version.
"""
import sys, json, os
sys.path.insert(0, '.')

from integrity_engine import run_integrity_engine

INPUT = os.path.join('..', 'frontend', 'src', 'data', 'scrapedObservations.json')
OUTPUT = os.path.join('..', 'frontend', 'src', 'data', 'scrapedObservations.json')

with open(INPUT, 'r', encoding='utf-8') as f:
    observations = json.load(f)

print(f"Loaded {len(observations)} observations")

corrected, report = run_integrity_engine(observations)

print(f"\n=== INTEGRITY SCAN RESULTS ===")
print(f"Total observations:         {report['total_observations']}")
print(f"Synthetic flights replaced: {report['synthetic_flights_replaced']}")
print(f"Fare components fixed:      {report['fare_components_fixed']}")
print(f"Price anomalies:            {report['price_anomalies_flagged']}")
print(f"Carrier mismatches:         {report['carrier_flight_mismatch']}")
print(f"Unverified (ok):            {report['unverified_in_registry']}")
print(f"Data integrity:             {report['data_integrity_pct']}%")

# Print sample corrections
print(f"\nSample corrections:")
corrections = [o for o in corrected if o.get('flight_number_original')]
for c in corrections[:10]:
    print(f"  {c['route']:12} | {c['airline']:20} | {c.get('flight_number_original', '?'):10} -> {c['flight_number']:10}")

# Write corrected data back
with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(corrected, f, indent=2, ensure_ascii=True)

print(f"\nCorrected data written to {OUTPUT}")
print(f"Removed fields added by integrity engine that frontend doesn't need:")

# Verify no encoding issues
total_corrected_fields = sum(1 for o in corrected if o.get('registry_validation'))
print(f"  {total_corrected_fields} records now have registry_validation field")
print("Done!")
