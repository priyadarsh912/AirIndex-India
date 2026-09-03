"""
AirIndex India - Route Clustering Engine
Groups 52+ domestic corridors into 5 strategic clusters:
1. Metro Trunk
2. Metro-Tier2 Link
3. Regional & North-East
4. Leisure & Tourist
5. Emerging Hubs

Computes cluster-level price indexes, fare elasticities, and volatility metrics.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Any
from data_generator import ROUTES_CONFIG

CLUSTER_METADATA = {
    "Metro Trunk": {
        "description": "High-frequency heavy volume connectivity between India's top metros.",
        "icon": "Building2",
        "color": "#3B82F6",  # Blue
        "weight_share_pct": 45.0,
    },
    "Metro-Tier2 Link": {
        "description": "Primary economic links connecting tier-1 financial centers to tier-2 hubs.",
        "icon": "Share2",
        "color": "#10B981",  # Emerald
        "weight_share_pct": 25.0,
    },
    "Regional & NE": {
        "description": "Essential regional connectivity and UDAN North-East corridors.",
        "icon": "MapPin",
        "color": "#8B5CF6",  # Purple
        "weight_share_pct": 12.0,
    },
    "Leisure & Tourist": {
        "description": "High-demand seasonal leisure corridors (Goa, Srinagar, Leh, Varanasi).",
        "icon": "Sun",
        "color": "#F59E0B",  # Amber
        "weight_share_pct": 10.0,
    },
    "Emerging Hubs": {
        "description": "Rapidly growing industrial, IT, and manufacturing regional centers.",
        "icon": "TrendingUp",
        "color": "#EC4899",  # Pink
        "weight_share_pct": 8.0,
    },
}


def compute_route_clusters(observations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Computes cluster aggregations, route distributions, and comparative price indexes."""
    if not observations:
        return {}

    df = pd.DataFrame(observations)
    if "cluster" not in df.columns:
        # Fallback mapping from ROUTES_CONFIG if missing
        cluster_map = {r["code"]: r.get("cluster", "General") for r in ROUTES_CONFIG}
        df["cluster"] = df["route"].map(cluster_map).fillna("General")

    # Group by cluster
    clusters_summary = []
    
    for cluster_name, meta in CLUSTER_METADATA.items():
        sub_df = df[df["cluster"] == cluster_name]
        
        if not sub_df.empty:
            avg_fare = round(float(sub_df["total_fare"].mean()), 2)
            min_fare = round(float(sub_df["total_fare"].min()), 2)
            max_fare = round(float(sub_df["total_fare"].max()), 2)
            std_fare = float(sub_df["total_fare"].std()) if len(sub_df) > 1 else 0.0
            volatility_pct = round((std_fare / avg_fare) * 100.0, 1) if avg_fare > 0 else 0.0
            routes_in_cluster = sub_df["route"].nunique()
            obs_count = len(sub_df)
        else:
            avg_fare = 0.0
            min_fare = 0.0
            max_fare = 0.0
            volatility_pct = 0.0
            routes_in_cluster = 0
            obs_count = 0

        clusters_summary.append({
            "name": cluster_name,
            "description": meta["description"],
            "color": meta["color"],
            "weight_share_pct": meta["weight_share_pct"],
            "routes_count": routes_in_cluster,
            "total_observations": obs_count,
            "avg_fare_inr": avg_fare,
            "min_fare_inr": min_fare,
            "max_fare_inr": max_fare,
            "price_volatility_pct": volatility_pct,
        })

    # Cluster-wise Daily Index Trends
    trend_by_cluster = []
    if "capture_date" in df.columns:
        dates = sorted(df["capture_date"].unique())
        for d in dates:
            day_df = df[df["capture_date"] == d]
            row = {"date": d}
            for c_name in CLUSTER_METADATA.keys():
                c_sub = day_df[day_df["cluster"] == c_name]
                if not c_sub.empty:
                    row[c_name] = round(float(c_sub["total_fare"].mean()), 2)
                else:
                    row[c_name] = None
            trend_by_cluster.append(row)

    return {
        "clusters": clusters_summary,
        "daily_cluster_trend": trend_by_cluster,
        "total_clusters": len(clusters_summary),
        "total_routes_tracked": len(ROUTES_CONFIG)
    }


if __name__ == "__main__":
    from data_generator import generate_fixture_dataset
    data = generate_fixture_dataset(30)
    clusters = compute_route_clusters(data["raw_observations"])
    print("Computed Clusters:", len(clusters["clusters"]))
    for c in clusters["clusters"]:
        print(c["name"], "-> Avg Fare:", c["avg_fare_inr"], "| Routes:", c["routes_count"])
