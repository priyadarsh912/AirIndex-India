"""
AirIndex India - Data Generator Module (52+ Route Expansion)
Generates 30-day realistic fixture data and simulated benchmark datasets (modeled on DGCA fare structure) for SIH26056.
Covers 52 major Indian domestic flight corridors across 5 strategic clusters.
"""

import math
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Expanded 52 Domestic Indian Aviation Corridors with weights and distances
ROUTES_CONFIG = [
    # --- Cluster 1: Metro Trunk (10 Corridors) ---
    {"code": "DEL-BOM", "name": "Delhi to Mumbai", "distance_km": 1148, "weight": 0.080, "base_price": 4600, "cluster": "Metro Trunk"},
    {"code": "BOM-DEL", "name": "Mumbai to Delhi", "distance_km": 1148, "weight": 0.080, "base_price": 4650, "cluster": "Metro Trunk"},
    {"code": "DEL-BLR", "name": "Delhi to Bengaluru", "distance_km": 1740, "weight": 0.065, "base_price": 5400, "cluster": "Metro Trunk"},
    {"code": "BLR-DEL", "name": "Bengaluru to Delhi", "distance_km": 1740, "weight": 0.065, "base_price": 5450, "cluster": "Metro Trunk"},
    {"code": "BOM-BLR", "name": "Mumbai to Bengaluru", "distance_km": 842,  "weight": 0.050, "base_price": 3800, "cluster": "Metro Trunk"},
    {"code": "BLR-BOM", "name": "Bengaluru to Mumbai", "distance_km": 842,  "weight": 0.050, "base_price": 3850, "cluster": "Metro Trunk"},
    {"code": "DEL-CCU", "name": "Delhi to Kolkata", "distance_km": 1305, "weight": 0.045, "base_price": 4500, "cluster": "Metro Trunk"},
    {"code": "CCU-DEL", "name": "Kolkata to Delhi", "distance_km": 1305, "weight": 0.045, "base_price": 4550, "cluster": "Metro Trunk"},
    {"code": "BLR-HYD", "name": "Bengaluru to Hyderabad", "distance_km": 500, "weight": 0.040, "base_price": 2900, "cluster": "Metro Trunk"},
    {"code": "HYD-BLR", "name": "Hyderabad to Bengaluru", "distance_km": 500, "weight": 0.040, "base_price": 2950, "cluster": "Metro Trunk"},

    # --- Cluster 2: Metro to Tier 1/2 Connectors (14 Corridors) ---
    {"code": "MAA-DEL", "name": "Chennai to Delhi", "distance_km": 1760, "weight": 0.035, "base_price": 5300, "cluster": "Metro-Tier2 Link"},
    {"code": "DEL-MAA", "name": "Delhi to Chennai", "distance_km": 1760, "weight": 0.035, "base_price": 5350, "cluster": "Metro-Tier2 Link"},
    {"code": "DEL-PNQ", "name": "Delhi to Pune", "distance_km": 1170, "weight": 0.030, "base_price": 4400, "cluster": "Metro-Tier2 Link"},
    {"code": "PNQ-DEL", "name": "Pune to Delhi", "distance_km": 1170, "weight": 0.030, "base_price": 4450, "cluster": "Metro-Tier2 Link"},
    {"code": "BOM-AMD", "name": "Mumbai to Ahmedabad", "distance_km": 440,  "weight": 0.025, "base_price": 2800, "cluster": "Metro-Tier2 Link"},
    {"code": "AMD-BOM", "name": "Ahmedabad to Mumbai", "distance_km": 440,  "weight": 0.025, "base_price": 2850, "cluster": "Metro-Tier2 Link"},
    {"code": "DEL-AMD", "name": "Delhi to Ahmedabad", "distance_km": 775,  "weight": 0.025, "base_price": 3600, "cluster": "Metro-Tier2 Link"},
    {"code": "DEL-LKO", "name": "Delhi to Lucknow", "distance_km": 420,  "weight": 0.020, "base_price": 2700, "cluster": "Metro-Tier2 Link"},
    {"code": "LKO-DEL", "name": "Lucknow to Delhi", "distance_km": 420,  "weight": 0.020, "base_price": 2750, "cluster": "Metro-Tier2 Link"},
    {"code": "BOM-HYD", "name": "Mumbai to Hyderabad", "distance_km": 620,  "weight": 0.020, "base_price": 3200, "cluster": "Metro-Tier2 Link"},
    {"code": "HYD-BOM", "name": "Hyderabad to Mumbai", "distance_km": 620,  "weight": 0.020, "base_price": 3250, "cluster": "Metro-Tier2 Link"},
    {"code": "DEL-PAT", "name": "Delhi to Patna", "distance_km": 850,  "weight": 0.020, "base_price": 3900, "cluster": "Metro-Tier2 Link"},
    {"code": "BOM-PAT", "name": "Mumbai to Patna", "distance_km": 1460, "weight": 0.015, "base_price": 4900, "cluster": "Metro-Tier2 Link"},
    {"code": "BLR-PNQ", "name": "Bengaluru to Pune", "distance_km": 730,  "weight": 0.015, "base_price": 3500, "cluster": "Metro-Tier2 Link"},

    # --- Cluster 3: Regional & North-East Corridors (10 Corridors) ---
    {"code": "DEL-GAU", "name": "Delhi to Guwahati", "distance_km": 1460, "weight": 0.015, "base_price": 4800, "cluster": "Regional & NE"},
    {"code": "GAU-DEL", "name": "Guwahati to Delhi", "distance_km": 1460, "weight": 0.015, "base_price": 4850, "cluster": "Regional & NE"},
    {"code": "CCU-GAU", "name": "Kolkata to Guwahati", "distance_km": 520,  "weight": 0.012, "base_price": 3100, "cluster": "Regional & NE"},
    {"code": "DEL-IXB", "name": "Delhi to Bagdogra", "distance_km": 1130, "weight": 0.012, "base_price": 4300, "cluster": "Regional & NE"},
    {"code": "CCU-IXB", "name": "Kolkata to Bagdogra", "distance_km": 450,  "weight": 0.010, "base_price": 2800, "cluster": "Regional & NE"},
    {"code": "DEL-IXC", "name": "Delhi to Chandigarh", "distance_km": 235,  "weight": 0.010, "base_price": 2400, "cluster": "Regional & NE"},
    {"code": "MAA-TRZ", "name": "Chennai to Tiruchirappalli", "distance_km": 320, "weight": 0.008, "base_price": 2300, "cluster": "Regional & NE"},
    {"code": "BLR-COK", "name": "Bengaluru to Kochi", "distance_km": 365,  "weight": 0.012, "base_price": 2500, "cluster": "Regional & NE"},
    {"code": "COK-BLR", "name": "Kochi to Bengaluru", "distance_km": 365,  "weight": 0.012, "base_price": 2550, "cluster": "Regional & NE"},
    {"code": "HYD-VGA", "name": "Hyderabad to Vijayawada", "distance_km": 250, "weight": 0.008, "base_price": 2200, "cluster": "Regional & NE"},

    # --- Cluster 4: Leisure & Tourist Corridors (10 Corridors) ---
    {"code": "DEL-GOI", "name": "Delhi to Goa", "distance_km": 1515, "weight": 0.020, "base_price": 5100, "cluster": "Leisure & Tourist"},
    {"code": "GOI-DEL", "name": "Goa to Delhi", "distance_km": 1515, "weight": 0.020, "base_price": 5150, "cluster": "Leisure & Tourist"},
    {"code": "BOM-GOI", "name": "Mumbai to Goa", "distance_km": 425,  "weight": 0.018, "base_price": 2900, "cluster": "Leisure & Tourist"},
    {"code": "GOI-BOM", "name": "Goa to Mumbai", "distance_km": 425,  "weight": 0.018, "base_price": 2950, "cluster": "Leisure & Tourist"},
    {"code": "BLR-GOI", "name": "Bengaluru to Goa", "distance_km": 480,  "weight": 0.015, "base_price": 3100, "cluster": "Leisure & Tourist"},
    {"code": "DEL-SXR", "name": "Delhi to Srinagar", "distance_km": 650,  "weight": 0.015, "base_price": 4200, "cluster": "Leisure & Tourist"},
    {"code": "SXR-DEL", "name": "Srinagar to Delhi", "distance_km": 650,  "weight": 0.015, "base_price": 4250, "cluster": "Leisure & Tourist"},
    {"code": "DEL-IXL", "name": "Delhi to Leh", "distance_km": 610,  "weight": 0.010, "base_price": 5800, "cluster": "Leisure & Tourist"},
    {"code": "DEL-VNS", "name": "Delhi to Varanasi", "distance_km": 670,  "weight": 0.012, "base_price": 3400, "cluster": "Leisure & Tourist"},
    {"code": "BOM-VNS", "name": "Mumbai to Varanasi", "distance_km": 1250, "weight": 0.010, "base_price": 4500, "cluster": "Leisure & Tourist"},

    # --- Cluster 5: Emerging Industrial & Economic Hubs (8 Corridors) ---
    {"code": "BLR-IXE", "name": "Bengaluru to Mangaluru", "distance_km": 300, "weight": 0.008, "base_price": 2400, "cluster": "Emerging Hubs"},
    {"code": "HYD-RPR", "name": "Hyderabad to Raipur", "distance_km": 540,  "weight": 0.008, "base_price": 3100, "cluster": "Emerging Hubs"},
    {"code": "DEL-JAI", "name": "Delhi to Jaipur", "distance_km": 240,  "weight": 0.010, "base_price": 2300, "cluster": "Emerging Hubs"},
    {"code": "BOM-NAG", "name": "Mumbai to Nagpur", "distance_km": 680,  "weight": 0.009, "base_price": 3300, "cluster": "Emerging Hubs"},
    {"code": "BLR-VTZ", "name": "Bengaluru to Visakhapatnam", "distance_km": 790, "weight": 0.009, "base_price": 3600, "cluster": "Emerging Hubs"},
    {"code": "HYD-VTZ", "name": "Hyderabad to Visakhapatnam", "distance_km": 520, "weight": 0.009, "base_price": 3000, "cluster": "Emerging Hubs"},
    {"code": "BOM-IDR", "name": "Mumbai to Indore", "distance_km": 510,  "weight": 0.009, "base_price": 3100, "cluster": "Emerging Hubs"},
    {"code": "DEL-UDR", "name": "Delhi to Udaipur", "distance_km": 570,  "weight": 0.008, "base_price": 3500, "cluster": "Emerging Hubs"},
]

AIRLINES_CONFIG = [
    {"code": "6E", "name": "IndiGo", "market_share": 0.60, "multiplier": 1.00},
    {"code": "AI", "name": "Air India", "market_share": 0.22, "multiplier": 1.08},
    {"code": "IX", "name": "Air India Express", "market_share": 0.10, "multiplier": 0.94},
    {"code": "QP", "name": "Akasa Air", "market_share": 0.08, "multiplier": 0.91},
]

WINDOWS_CONFIG = [
    {"code": "T+1",  "days": 1,  "multiplier": 1.55, "availability_avg": 4},
    {"code": "T+7",  "days": 7,  "multiplier": 1.25, "availability_avg": 12},
    {"code": "T+15", "days": 15, "multiplier": 1.05, "availability_avg": 22},
    {"code": "T+30", "days": 30, "multiplier": 0.92, "availability_avg": 35},
    {"code": "T+45", "days": 45, "multiplier": 0.85, "availability_avg": 42},
]


def generate_fixture_dataset(days_back: int = 30) -> Dict[str, Any]:
    """Generates 30 days of realistic observations across all 52 routes."""
    random.seed(42)  # Reproducible high-quality baseline
    
    end_date = datetime(2026, 9, 4)
    start_date = end_date - timedelta(days=days_back - 1)
    
    raw_observations: List[Dict[str, Any]] = []
    dgca_benchmark_series: List[Dict[str, Any]] = []
    
    obs_id = 10001
    
    for d in range(days_back):
        curr_date = start_date + timedelta(days=d)
        date_str = curr_date.strftime("%Y-%m-%d")
        
        dow_factor = 1.12 if curr_date.weekday() in [4, 6] else (1.05 if curr_date.weekday() == 5 else 0.98)
        trend_factor = 1.0 + (0.12 * math.sin(d / 4.5)) + (0.08 if 18 <= d <= 24 else 0.0)
        
        daily_fares = []
        
        for route in ROUTES_CONFIG:
            for airline in AIRLINES_CONFIG:
                for window in WINDOWS_CONFIG:
                    # Generate observations per window (sample 1-2 per route to keep payload efficient for 52 routes)
                    num_obs = 1
                    for idx in range(num_obs):
                        flight_num = f"{airline['code']}-{random.randint(101, 999)}"
                        
                        target_fare = route['base_price'] * airline['multiplier'] * window['multiplier'] * dow_factor * trend_factor
                        variation = random.uniform(0.94, 1.06)
                        final_fare = round(target_fare * variation)
                        
                        base_fare = round(final_fare * 0.76)
                        taxes = round(final_fare * 0.18)
                        fees = final_fare - base_fare - taxes
                        
                        seats = max(0, int(random.gauss(window['availability_avg'], 3)))
                        status = "AVAILABLE" if seats > 0 else "AVAILABLE"
                        
                        is_simulated_outlier = False
                        if random.random() < 0.01:
                            final_fare = int(final_fare * random.choice([2.4, 0.25]))
                            base_fare = round(final_fare * 0.76)
                            taxes = round(final_fare * 0.18)
                            fees = final_fare - base_fare - taxes
                            is_simulated_outlier = True
                            
                        obs_record = {
                            "id": f"OBS-{obs_id}",
                            "timestamp": f"{date_str}T{random.randint(6, 22):02d}:{random.randint(0, 59):02d}:00Z",
                            "capture_date": date_str,
                            "travel_date": (curr_date + timedelta(days=window['days'])).strftime("%Y-%m-%d"),
                            "origin": route['code'].split("-")[0],
                            "destination": route['code'].split("-")[1],
                            "route": route['code'],
                            "cluster": route.get("cluster", "General"),
                            "airline": airline['name'],
                            "airline_code": airline['code'],
                            "flight_number": flight_num,
                            "source": random.choice(["Direct Airline API", "OTA Portal A", "OTA Portal B"]),
                            "booking_window": window['code'],
                            "cabin_class": "Economy",
                            "fare_class": "Standard Handbag",
                            "base_fare": base_fare,
                            "taxes": taxes,
                            "fees": fees,
                            "total_fare": final_fare,
                            "currency": "INR",
                            "seat_availability": seats,
                            "status": status,
                            "simulated_outlier": is_simulated_outlier,
                            "missing_field": False
                        }
                        
                        raw_observations.append(obs_record)
                        obs_id += 1
                        if not is_simulated_outlier and status == "AVAILABLE":
                            daily_fares.append(final_fare)
                            
        avg_day_fare = sum(daily_fares) / len(daily_fares) if daily_fares else 4200
        dgca_ref_index = round(100.0 * (avg_day_fare / 3900.0) * (0.98 + 0.04 * math.cos(d / 3.0)), 2)
        dgca_benchmark_series.append({
            "date": date_str,
            "dgca_average_fare": round(avg_day_fare * 0.97, 2),
            "dgca_index": dgca_ref_index
        })
        
    return {
        "raw_observations": raw_observations,
        "dgca_benchmark": dgca_benchmark_series,
        "routes": ROUTES_CONFIG,
        "airlines": AIRLINES_CONFIG,
        "windows": WINDOWS_CONFIG
    }


if __name__ == "__main__":
    data = generate_fixture_dataset(30)
    print(f"Generated {len(data['raw_observations'])} observations across {len(data['routes'])} routes.")
