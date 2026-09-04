// Static 52-Corridor & Cluster Fallback Dataset for AirIndex India (Vercel Frontend Resilience)

export const DEFAULT_CLUSTERS = [
  {
    name: "Metro Trunk",
    routes_count: 10,
    color: "#3B82F6",
    avg_fare_inr: 5120,
    volatility_score: 18.4,
    cluster_index: 131.2,
    description: "High-density Golden Quadrilateral trunk corridors connecting top metros with high corporate traffic."
  },
  {
    name: "Metro-Tier2 Link",
    routes_count: 14,
    color: "#10B981",
    avg_fare_inr: 4450,
    volatility_score: 14.2,
    cluster_index: 124.5,
    description: "State capital links connecting financial metros with emerging high-growth manufacturing and IT hubs."
  },
  {
    name: "Regional & NE",
    routes_count: 10,
    color: "#8B5CF6",
    avg_fare_inr: 3980,
    volatility_score: 11.8,
    cluster_index: 118.9,
    description: "Subsidized and regional UDAN corridors providing vital connectivity across North-East and southern Tier-3 cities."
  },
  {
    name: "Leisure & Tourist",
    routes_count: 10,
    color: "#F59E0B",
    avg_fare_inr: 5840,
    volatility_score: 29.6,
    cluster_index: 142.1,
    description: "Seasonal holiday corridors exhibiting pronounced weekend and festival dynamic surge sensitivity."
  },
  {
    name: "Emerging Hubs",
    routes_count: 8,
    color: "#EC4899",
    avg_fare_inr: 3620,
    volatility_score: 12.5,
    cluster_index: 115.4,
    description: "Fast-growing tier-2 industrial clusters showing strong double-digit annual passenger volume expansion."
  }
];

export const DEFAULT_52_ROUTES = [
  {"route": "DEL-BOM", "name": "Delhi to Mumbai", "cluster": "Metro Trunk", "current_fare": 5450, "base_fare": 4600, "change_24h": 8.7, "weight": 0.080, "price_relative": 118.5},
  {"route": "BOM-DEL", "name": "Mumbai to Delhi", "cluster": "Metro Trunk", "current_fare": 5390, "base_fare": 4650, "change_24h": 6.8, "weight": 0.080, "price_relative": 115.9},
  {"route": "DEL-BLR", "name": "Delhi to Bengaluru", "cluster": "Metro Trunk", "current_fare": 5980, "base_fare": 5400, "change_24h": 5.2, "weight": 0.065, "price_relative": 110.7},
  {"route": "BLR-DEL", "name": "Bengaluru to Delhi", "cluster": "Metro Trunk", "current_fare": 6050, "base_fare": 5450, "change_24h": 5.8, "weight": 0.065, "price_relative": 111.0},
  {"route": "BOM-BLR", "name": "Mumbai to Bengaluru", "cluster": "Metro Trunk", "current_fare": 4120, "base_fare": 3800, "change_24h": 2.1, "weight": 0.050, "price_relative": 108.4},
  {"route": "BLR-BOM", "name": "Bengaluru to Mumbai", "cluster": "Metro Trunk", "current_fare": 4180, "base_fare": 3850, "change_24h": 3.4, "weight": 0.050, "price_relative": 108.6},
  {"route": "DEL-CCU", "name": "Delhi to Kolkata", "cluster": "Metro Trunk", "current_fare": 4440, "base_fare": 4500, "change_24h": -1.4, "weight": 0.045, "price_relative": 98.7},
  {"route": "CCU-DEL", "name": "Kolkata to Delhi", "cluster": "Metro Trunk", "current_fare": 4520, "base_fare": 4550, "change_24h": 0.8, "weight": 0.045, "price_relative": 99.3},
  {"route": "BLR-HYD", "name": "Bengaluru to Hyderabad", "cluster": "Metro Trunk", "current_fare": 3280, "base_fare": 2900, "change_24h": 6.3, "weight": 0.040, "price_relative": 113.1},
  {"route": "HYD-BLR", "name": "Hyderabad to Bengaluru", "cluster": "Metro Trunk", "current_fare": 3310, "base_fare": 2950, "change_24h": 5.9, "weight": 0.040, "price_relative": 112.2},
  {"route": "MAA-DEL", "name": "Chennai to Delhi", "cluster": "Metro-Tier2 Link", "current_fare": 5720, "base_fare": 5300, "change_24h": 3.9, "weight": 0.035, "price_relative": 107.9},
  {"route": "DEL-MAA", "name": "Delhi to Chennai", "cluster": "Metro-Tier2 Link", "current_fare": 5790, "base_fare": 5350, "change_24h": 4.1, "weight": 0.035, "price_relative": 108.2},
  {"route": "DEL-PNQ", "name": "Delhi to Pune", "cluster": "Metro-Tier2 Link", "current_fare": 4720, "base_fare": 4400, "change_24h": 4.8, "weight": 0.030, "price_relative": 107.3},
  {"route": "PNQ-DEL", "name": "Pune to Delhi", "cluster": "Metro-Tier2 Link", "current_fare": 4780, "base_fare": 4450, "change_24h": 5.1, "weight": 0.030, "price_relative": 107.4},
  {"route": "BOM-AMD", "name": "Mumbai to Ahmedabad", "cluster": "Metro-Tier2 Link", "current_fare": 3120, "base_fare": 2800, "change_24h": 2.4, "weight": 0.025, "price_relative": 111.4},
  {"route": "AMD-BOM", "name": "Ahmedabad to Mumbai", "cluster": "Metro-Tier2 Link", "current_fare": 3160, "base_fare": 2850, "change_24h": 2.6, "weight": 0.025, "price_relative": 110.9},
  {"route": "DEL-AMD", "name": "Delhi to Ahmedabad", "cluster": "Metro-Tier2 Link", "current_fare": 3920, "base_fare": 3600, "change_24h": 3.2, "weight": 0.025, "price_relative": 108.9},
  {"route": "DEL-LKO", "name": "Delhi to Lucknow", "cluster": "Metro-Tier2 Link", "current_fare": 2980, "base_fare": 2700, "change_24h": 2.9, "weight": 0.020, "price_relative": 110.4},
  {"route": "LKO-DEL", "name": "Lucknow to Delhi", "cluster": "Metro-Tier2 Link", "current_fare": 3020, "base_fare": 2750, "change_24h": 3.1, "weight": 0.020, "price_relative": 109.8},
  {"route": "BOM-HYD", "name": "Mumbai to Hyderabad", "cluster": "Metro-Tier2 Link", "current_fare": 3490, "base_fare": 3200, "change_24h": 2.7, "weight": 0.020, "price_relative": 109.1},
  {"route": "HYD-BOM", "name": "Hyderabad to Mumbai", "cluster": "Metro-Tier2 Link", "current_fare": 3520, "base_fare": 3250, "change_24h": 2.5, "weight": 0.020, "price_relative": 108.3},
  {"route": "DEL-PAT", "name": "Delhi to Patna", "cluster": "Metro-Tier2 Link", "current_fare": 4350, "base_fare": 3900, "change_24h": 4.3, "weight": 0.020, "price_relative": 111.5},
  {"route": "BOM-PAT", "name": "Mumbai to Patna", "cluster": "Metro-Tier2 Link", "current_fare": 5420, "base_fare": 4900, "change_24h": 3.8, "weight": 0.015, "price_relative": 110.6},
  {"route": "BLR-PNQ", "name": "Bengaluru to Pune", "cluster": "Metro-Tier2 Link", "current_fare": 3850, "base_fare": 3500, "change_24h": 3.0, "weight": 0.015, "price_relative": 110.0},
  {"route": "DEL-GAU", "name": "Delhi to Guwahati", "cluster": "Regional & NE", "current_fare": 5120, "base_fare": 4800, "change_24h": 2.1, "weight": 0.015, "price_relative": 106.7},
  {"route": "GAU-DEL", "name": "Guwahati to Delhi", "cluster": "Regional & NE", "current_fare": 5190, "base_fare": 4850, "change_24h": 2.3, "weight": 0.015, "price_relative": 107.0},
  {"route": "CCU-GAU", "name": "Kolkata to Guwahati", "cluster": "Regional & NE", "current_fare": 3320, "base_fare": 3100, "change_24h": 1.5, "weight": 0.012, "price_relative": 107.1},
  {"route": "DEL-IXB", "name": "Delhi to Bagdogra", "cluster": "Regional & NE", "current_fare": 4650, "base_fare": 4300, "change_24h": 2.8, "weight": 0.012, "price_relative": 108.1},
  {"route": "CCU-IXB", "name": "Kolkata to Bagdogra", "cluster": "Regional & NE", "current_fare": 2980, "base_fare": 2800, "change_24h": 1.9, "weight": 0.010, "price_relative": 106.4},
  {"route": "DEL-IXC", "name": "Delhi to Chandigarh", "cluster": "Regional & NE", "current_fare": 2610, "base_fare": 2400, "change_24h": 1.2, "weight": 0.010, "price_relative": 108.8},
  {"route": "MAA-TRZ", "name": "Chennai to Tiruchirappalli", "cluster": "Regional & NE", "current_fare": 2450, "base_fare": 2300, "change_24h": 1.4, "weight": 0.008, "price_relative": 106.5},
  {"route": "BLR-COK", "name": "Bengaluru to Kochi", "cluster": "Regional & NE", "current_fare": 2740, "base_fare": 2500, "change_24h": 2.0, "weight": 0.012, "price_relative": 109.6},
  {"route": "COK-BLR", "name": "Kochi to Bengaluru", "cluster": "Regional & NE", "current_fare": 2790, "base_fare": 2550, "change_24h": 2.2, "weight": 0.012, "price_relative": 109.4},
  {"route": "HYD-VGA", "name": "Hyderabad to Vijayawada", "cluster": "Regional & NE", "current_fare": 2380, "base_fare": 2200, "change_24h": 1.6, "weight": 0.008, "price_relative": 108.2},
  {"route": "DEL-GOI", "name": "Delhi to Goa", "cluster": "Leisure & Tourist", "current_fare": 6250, "base_fare": 5100, "change_24h": 12.4, "weight": 0.020, "price_relative": 122.5},
  {"route": "GOI-DEL", "name": "Goa to Delhi", "cluster": "Leisure & Tourist", "current_fare": 6320, "base_fare": 5150, "change_24h": 11.8, "weight": 0.020, "price_relative": 122.7},
  {"route": "BOM-GOI", "name": "Mumbai to Goa", "cluster": "Leisure & Tourist", "current_fare": 3680, "base_fare": 2900, "change_24h": 14.1, "weight": 0.018, "price_relative": 126.9},
  {"route": "GOI-BOM", "name": "Goa to Mumbai", "cluster": "Leisure & Tourist", "current_fare": 3720, "base_fare": 2950, "change_24h": 13.6, "weight": 0.018, "price_relative": 126.1},
  {"route": "BLR-GOI", "name": "Bengaluru to Goa", "cluster": "Leisure & Tourist", "current_fare": 3890, "base_fare": 3100, "change_24h": 12.2, "weight": 0.015, "price_relative": 125.5},
  {"route": "DEL-SXR", "name": "Delhi to Srinagar", "cluster": "Leisure & Tourist", "current_fare": 5420, "base_fare": 4200, "change_24h": 16.5, "weight": 0.015, "price_relative": 129.0},
  {"route": "SXR-DEL", "name": "Srinagar to Delhi", "cluster": "Leisure & Tourist", "current_fare": 5490, "base_fare": 4250, "change_24h": 15.8, "weight": 0.015, "price_relative": 129.2},
  {"route": "DEL-IXL", "name": "Delhi to Leh", "cluster": "Leisure & Tourist", "current_fare": 7650, "base_fare": 5800, "change_24h": 18.2, "weight": 0.010, "price_relative": 131.9},
  {"route": "DEL-VNS", "name": "Delhi to Varanasi", "cluster": "Leisure & Tourist", "current_fare": 4120, "base_fare": 3400, "change_24h": 7.4, "weight": 0.012, "price_relative": 121.2},
  {"route": "BOM-VNS", "name": "Mumbai to Varanasi", "cluster": "Leisure & Tourist", "current_fare": 5350, "base_fare": 4500, "change_24h": 6.8, "weight": 0.010, "price_relative": 118.9},
  {"route": "BLR-IXE", "name": "Bengaluru to Mangaluru", "cluster": "Emerging Hubs", "current_fare": 2650, "base_fare": 2400, "change_24h": 2.1, "weight": 0.008, "price_relative": 110.4},
  {"route": "HYD-RPR", "name": "Hyderabad to Raipur", "cluster": "Emerging Hubs", "current_fare": 3420, "base_fare": 3100, "change_24h": 2.8, "weight": 0.008, "price_relative": 110.3},
  {"route": "DEL-JAI", "name": "Delhi to Jaipur", "cluster": "Emerging Hubs", "current_fare": 2510, "base_fare": 2300, "change_24h": 1.8, "weight": 0.010, "price_relative": 109.1},
  {"route": "BOM-NAG", "name": "Mumbai to Nagpur", "cluster": "Emerging Hubs", "current_fare": 3680, "base_fare": 3300, "change_24h": 3.1, "weight": 0.009, "price_relative": 111.5},
  {"route": "BLR-VTZ", "name": "Bengaluru to Visakhapatnam", "cluster": "Emerging Hubs", "current_fare": 3980, "base_fare": 3600, "change_24h": 2.5, "weight": 0.009, "price_relative": 110.6},
  {"route": "HYD-VTZ", "name": "Hyderabad to Visakhapatnam", "cluster": "Emerging Hubs", "current_fare": 3310, "base_fare": 3000, "change_24h": 2.2, "weight": 0.009, "price_relative": 110.3},
  {"route": "BOM-IDR", "name": "Mumbai to Indore", "cluster": "Emerging Hubs", "current_fare": 3450, "base_fare": 3100, "change_24h": 2.7, "weight": 0.009, "price_relative": 111.3},
  {"route": "DEL-UDR", "name": "Delhi to Udaipur", "cluster": "Emerging Hubs", "current_fare": 3880, "base_fare": 3500, "change_24h": 3.4, "weight": 0.008, "price_relative": 110.9}
];

export const DEFAULT_30_DAY_TREND = (() => {
  // Rolling 30-day window ending on current system date (2026-09-04)
  const endDate = new Date('2026-09-04T00:00:00Z');
  // Daily market variations representing realistic weekday/weekend travel spikes and dynamic pricing
  const dayVariations = [
    -1.8, -0.9, 1.4, 3.1, 2.5, -0.8, -1.5,
    -1.1, 0.4, 2.2, 3.8, 1.9, -0.4, -1.2,
    -0.6, 1.1, 2.8, 4.2, 2.1, -0.7, -1.4,
    -0.2, 1.8, 3.5, 4.8, 3.2, 0.6, -0.5, 1.2, 2.4
  ];

  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (29 - i));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const variation = dayVariations[i] ?? 0;
    const base = 124.5 + variation + (i * 0.12);
    const avgFare = Math.round(4950 + (variation * 48) + (i * 12));

    return {
      date: dateStr,
      full_date: dateStr,
      weighted_index: parseFloat(base.toFixed(1)),
      jevons_index: parseFloat((base - 1.2).toFixed(1)),
      fisher_index: parseFloat((base - 0.6).toFixed(1)),
      avg_fare: avgFare
    };
  });
})();
