"""
AirIndex India - FastAPI Service (SIH26056)
Production-Grade Zero-Contamination Architecture & Reactive Analytics Engine.
Exposes institutional RESTful API v1 & v2 endpoints for MoSPI / RBI data consumption.
Supports 52+ domestic routes, corridor clustering, live scraping, and anti-contamination auditing.
"""

import asyncio
import os
import sys
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

# Ensure backend directory is in Python path when executed from root or subfolder
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from anomaly_engine import detect_airfare_anomalies
from backtest_engine import run_dgca_backtest
from clustering_engine import compute_route_clusters
from data_generator import AIRLINES_CONFIG, ROUTES_CONFIG, WINDOWS_CONFIG, generate_fixture_dataset, get_server_today
from data_loader import get_latest_scrape_metadata, load_scraped_observations, merge_scraped_with_fixture
from index_engine import compute_airfare_indexes
from integrity_engine import (
    GLOBAL_ANTI_CONTAMINATION_ENGINE,
    detect_cross_route_price_contamination,
    partition_observations,
    run_integrity_engine,
)
from quality_engine import process_data_quality
from scrape_flights import run_scraping_job

app = FastAPI(
    title="AirScope Institutional API",
    description="Real-Time Airfare Price Index & Algorithmic Surveillance Engine (MoSPI / DIID - SIH26056)",
    version="2.0.0",
)

# Enable CORS for cross-origin requests from any frontend port or host
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
#  PYDANTIC RESPONSE CONTRACTS (V2 API)
# ─────────────────────────────────────────────────────────────────────────────

class DailyTrendPoint(BaseModel):
    date: str
    full_date: str
    weighted_index: float
    jevons_index: float
    fisher_index: float
    avg_fare: float
    observation_count: int

class HistoryResponse(BaseModel):
    query_filters: dict
    total_points: int
    daily_trend: List[DailyTrendPoint]


# ─────────────────────────────────────────────────────────────────────────────
#  GLOBAL DATASET CACHE & PARTITIONED STORES
# ─────────────────────────────────────────────────────────────────────────────

FIXTURE_DATA = generate_fixture_dataset(30)
SCRAPED_DATA = load_scraped_observations()
COMBINED_RAW = merge_scraped_with_fixture(FIXTURE_DATA["raw_observations"], SCRAPED_DATA)

# Partition observations: Strict separation of Clean vs Quarantined records
CLEAN_FLIGHT_OBSERVATIONS, QUARANTINED_FLIGHT_OBSERVATIONS, TELEMETRY_AUDIT = partition_observations(COMBINED_RAW)

# Run data quality & index calculations strictly on clean partitioned observations
CLEANED_DATA, QUALITY_STATS = process_data_quality(CLEAN_FLIGHT_OBSERVATIONS)
INDEX_RESULTS = compute_airfare_indexes(CLEANED_DATA)
ANOMALIES_RESULTS = detect_airfare_anomalies(CLEANED_DATA)
CLUSTER_RESULTS = compute_route_clusters(CLEANED_DATA)
BACKTEST_RESULTS = run_dgca_backtest(INDEX_RESULTS.get("daily_trend", []), FIXTURE_DATA["dgca_benchmark"])

SCRAPE_IN_PROGRESS = False
LAST_SCRAPE_STATUS = get_latest_scrape_metadata()


def sync_to_frontend():
    """Sync latest scraped observations to frontend/src/data/scrapedObservations.json."""
    import json
    frontend_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "frontend",
        "src",
        "data",
        "scrapedObservations.json",
    )
    if os.path.exists(os.path.dirname(frontend_path)):
        try:
            with open(frontend_path, "w", encoding="utf-8") as f:
                json.dump(SCRAPED_DATA, f, indent=2)
            print(f"[Sync] Saved {len(SCRAPED_DATA)} observations to frontend/src/data/scrapedObservations.json")
        except Exception as e:
            print(f"Warning: Failed to sync scraped observations to frontend: {e}")


def refresh_pipeline_data():
    """Recalculate pipeline state across all 52 routes and clusters when new scraped observations arrive."""
    global SCRAPED_DATA, COMBINED_RAW, CLEAN_FLIGHT_OBSERVATIONS, QUARANTINED_FLIGHT_OBSERVATIONS, TELEMETRY_AUDIT
    global CLEANED_DATA, QUALITY_STATS, INDEX_RESULTS, ANOMALIES_RESULTS, CLUSTER_RESULTS, BACKTEST_RESULTS, LAST_SCRAPE_STATUS

    SCRAPED_DATA = load_scraped_observations()
    sync_to_frontend()
    COMBINED_RAW = merge_scraped_with_fixture(FIXTURE_DATA["raw_observations"], SCRAPED_DATA)

    CLEAN_FLIGHT_OBSERVATIONS, QUARANTINED_FLIGHT_OBSERVATIONS, TELEMETRY_AUDIT = partition_observations(COMBINED_RAW)
    CLEANED_DATA, QUALITY_STATS = process_data_quality(CLEAN_FLIGHT_OBSERVATIONS)
    INDEX_RESULTS = compute_airfare_indexes(CLEANED_DATA)
    ANOMALIES_RESULTS = detect_airfare_anomalies(CLEANED_DATA)
    CLUSTER_RESULTS = compute_route_clusters(CLEANED_DATA)
    BACKTEST_RESULTS = run_dgca_backtest(INDEX_RESULTS.get("daily_trend", []), FIXTURE_DATA["dgca_benchmark"])
    LAST_SCRAPE_STATUS = get_latest_scrape_metadata()


def query_clean_store(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    route: Optional[str] = None,
    airline: Optional[str] = None,
    window: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Queries clean data store with strict isolation predicates.
    Guarantees that quarantined records (e.g. 6E-339 on HYD-VTZ) never cross-pollinate.
    """
    records = [
        o for o in CLEAN_FLIGHT_OBSERVATIONS
        if o.get("validation_status") == "VERIFIED" and o.get("is_usable", True)
    ]

    if route and route != "ALL":
        records = [o for o in records if o.get("route") == route]
    if airline and airline != "ALL":
        records = [o for o in records if o.get("airline") == airline]
    if window and window != "ALL":
        records = [o for o in records if o.get("booking_window") == window]
    if start_date:
        s_str = start_date.strftime("%Y-%m-%d")
        records = [o for o in records if (o.get("capture_date") or o.get("travel_date", "")) >= s_str]
    if end_date:
        e_str = end_date.strftime("%Y-%m-%d")
        records = [o for o in records if (o.get("capture_date") or o.get("travel_date", "")) <= e_str]

    return records


def aggregate_econometric_series(
    records: List[Dict[str, Any]],
    frequency: str = "Daily",
) -> List[DailyTrendPoint]:
    """
    Computes real-time econometric series directly from live filtered observations.
    Computes Weighted Base-100, Jevons geometric, and Fisher ideal index with sample count.
    """
    if not records:
        return []

    idx_res = compute_airfare_indexes(records, frequency=frequency)
    raw_trend = idx_res.get("daily_trend", [])

    # Count observations per date for live sample sizing
    counts_by_date = {}
    for r in records:
        d = r.get("capture_date", "")
        counts_by_date[d] = counts_by_date.get(d, 0) + 1

    trend_points: List[DailyTrendPoint] = []
    for item in raw_trend:
        dt_label = item.get("date", "")
        sample_count = counts_by_date.get(dt_label, item.get("observation_count", len(records) // max(len(raw_trend), 1)))
        trend_points.append(
            DailyTrendPoint(
                date=dt_label,
                full_date=item.get("full_date", dt_label),
                weighted_index=round(float(item.get("weighted_index", 100.0)), 1),
                jevons_index=round(float(item.get("jevons_index", 100.0)), 1),
                fisher_index=round(float(item.get("fisher_index", 100.0)), 1),
                avg_fare=round(float(item.get("avg_fare", 5000.0)), 2),
                observation_count=max(1, int(sample_count)),
            )
        )

    return trend_points


# ─────────────────────────────────────────────────────────────────────────────
#  ROOT & SYSTEM STATUS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {
        "title": "AirScope India — Real-Time Airfare Price Index Platform",
        "organization": "Ministry of Statistics & Programme Implementation (MoSPI)",
        "department": "Data Informatics & Innovation Division (DIID)",
        "version": "2.0.0",
        "status": "ONLINE",
        "architecture": "Zero-Contamination Dual-Phase Gateway",
        "tracked_routes_count": len(ROUTES_CONFIG),
        "clean_observations": len(CLEAN_FLIGHT_OBSERVATIONS),
        "quarantined_observations": len(QUARANTINED_FLIGHT_OBSERVATIONS),
        "contamination_rate_pct": TELEMETRY_AUDIT["contamination_rate_pct"],
        "documentation": "/docs",
    }


# ─────────────────────────────────────────────────────────────────────────────
#  PRODUCTION V2 REST API SPECIFICATION
# ─────────────────────────────────────────────────────────────────────────────

def compute_current_day_index_response(
    corridor: Optional[str] = None,
    airline: Optional[str] = None,
    window: Optional[str] = None,
    tz: str = "Asia/Kolkata",
    target_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Dynamically determines today's calendar date at request time based on the specified timezone.
    Strictly queries observations for the current calendar day.
    Guarantees that it NEVER defaults to the last modified/updated date of older records.
    Returns a structured empty/fallback state when no data exists for the current day.
    """
    resolved_date = target_date if target_date is not None else get_server_today(tz)
    today_str = resolved_date.strftime("%Y-%m-%d")

    # Strictly filter clean records matching the current calendar day
    records_today = [
        o for o in query_clean_store(
            route=corridor if corridor != "ALL" else None,
            airline=airline if airline != "ALL" else None,
            window=window if window != "ALL" else None,
            start_date=resolved_date,
            end_date=resolved_date,
        )
        if (o.get("capture_date") or o.get("travel_date", "")) == today_str
    ]

    # Return explicit empty / fallback state if no records exist for the current calendar day
    if not records_today:
        return {
            "data_available": False,
            "calendar_date": today_str,
            "timezone": tz,
            "index_name": "APIx (Airfare Price Index India)",
            "current_index": None,
            "base_period": "2026-01 (100.0)",
            "last_updated": None,
            "change_24h_pct": None,
            "change_7d_pct": None,
            "overall_avg_fare_inr": None,
            "total_observations": 0,
            "usable_observations": 0,
            "tracked_routes_count": len(ROUTES_CONFIG),
            "tracked_airlines_count": len(AIRLINES_CONFIG),
            "message": f"No flight observations recorded for current calendar day ({today_str}) in {tz} timezone.",
        }

    # Data exists strictly for today: compute real-time index
    idx_res = compute_airfare_indexes(records_today)
    today_index = idx_res.get("current_index", 100.0)

    # Compute 24h change vs yesterday
    yesterday = resolved_date - timedelta(days=1)
    yesterday_str = yesterday.strftime("%Y-%m-%d")
    records_yesterday = [
        o for o in query_clean_store(
            route=corridor if corridor != "ALL" else None,
            airline=airline if airline != "ALL" else None,
            window=window if window != "ALL" else None,
            start_date=yesterday,
            end_date=yesterday,
        )
        if (o.get("capture_date") or o.get("travel_date", "")) == yesterday_str
    ]
    change_24h = None
    if records_yesterday:
        y_idx_res = compute_airfare_indexes(records_yesterday)
        y_idx = y_idx_res.get("current_index", 100.0)
        if y_idx and y_idx > 0:
            change_24h = round(((today_index - y_idx) / y_idx) * 100.0, 2)

    # Compute 7d change vs week ago
    week_ago = resolved_date - timedelta(days=7)
    week_ago_str = week_ago.strftime("%Y-%m-%d")
    records_week_ago = [
        o for o in query_clean_store(
            route=corridor if corridor != "ALL" else None,
            airline=airline if airline != "ALL" else None,
            window=window if window != "ALL" else None,
            start_date=week_ago,
            end_date=week_ago,
        )
        if (o.get("capture_date") or o.get("travel_date", "")) == week_ago_str
    ]
    change_7d = None
    if records_week_ago:
        w_idx_res = compute_airfare_indexes(records_week_ago)
        w_idx = w_idx_res.get("current_index", 100.0)
        if w_idx and w_idx > 0:
            change_7d = round(((today_index - w_idx) / w_idx) * 100.0, 2)

    return {
        "data_available": True,
        "calendar_date": today_str,
        "timezone": tz,
        "index_name": "APIx (Airfare Price Index India)",
        "current_index": today_index,
        "base_period": idx_res.get("base_period", "2026-01 (100.0)"),
        "last_updated": f"{today_str} (Live {tz})",
        "change_24h_pct": change_24h if change_24h is not None else 0.0,
        "change_7d_pct": change_7d if change_7d is not None else 0.0,
        "overall_avg_fare_inr": idx_res.get("overall_avg_fare", 0),
        "total_observations": len(records_today),
        "usable_observations": idx_res.get("usable_observations", len(records_today)),
        "tracked_routes_count": len(ROUTES_CONFIG),
        "tracked_airlines_count": len(AIRLINES_CONFIG),
        "message": f"Displaying verified observations for {today_str} ({tz}).",
    }


@app.get("/api/v2/index/history", response_model=HistoryResponse)
async def get_index_history_v2(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    route: Optional[str] = Query(None, description="Filtered corridor, e.g. DEL-BOM"),
    airline: Optional[str] = Query(None, description="Filtered carrier, e.g. IndiGo"),
    window: Optional[str] = Query(None, description="Booking tier: T+1, T+7, T+15, T+30, T+45"),
    frequency: str = Query("Daily", pattern="^(Daily|Weekly|Monthly)$"),
    tz: str = Query("Asia/Kolkata", description="Timezone name"),
):
    """
    Computes real-time econometric index time series directly from clean observations.
    Anchors dynamically to today's date in target timezone when no custom dates are specified.
    """
    today = get_server_today(tz)
    resolved_end = end_date or today
    resolved_start = start_date or (resolved_end - timedelta(days=29))

    records = query_clean_store(
        start_date=resolved_start,
        end_date=resolved_end,
        route=route if route != "ALL" else None,
        airline=airline if airline != "ALL" else None,
        window=window if window != "ALL" else None,
    )

    s_str = resolved_start.strftime("%Y-%m-%d")
    e_str = resolved_end.strftime("%Y-%m-%d")
    records = [
        o for o in records
        if s_str <= (o.get("capture_date") or o.get("travel_date", "")) <= e_str
    ]

    if not records:
        return HistoryResponse(
            query_filters={
                "start_date": s_str,
                "end_date": e_str,
                "route": route,
                "airline": airline,
                "window": window,
                "frequency": frequency,
                "tz": tz,
            },
            total_points=0,
            daily_trend=[],
        )

    daily_trend = aggregate_econometric_series(records, frequency=frequency)

    return HistoryResponse(
        query_filters={
            "start_date": s_str,
            "end_date": e_str,
            "route": route,
            "airline": airline,
            "window": window,
            "frequency": frequency,
            "tz": tz,
        },
        total_points=len(daily_trend),
        daily_trend=daily_trend,
    )


@app.get("/api/v2/index/current")
async def get_current_index_v2(
    corridor: Optional[str] = Query(None, description="Corridor, e.g. DEL-BOM"),
    airline: Optional[str] = Query(None, description="Carrier name"),
    window: Optional[str] = Query(None, description="Booking tier"),
    tz: str = Query("Asia/Kolkata", description="Timezone name e.g. Asia/Kolkata, UTC, America/New_York"),
    target_date: Optional[date] = Query(None, description="Explicit calendar date (YYYY-MM-DD), defaults dynamically to today in timezone"),
):
    """
    Real-time headline index & aggregated KPIs derived strictly from verified clean observations of the current calendar day.
    Does NOT default to older dates; returns empty/fallback state when no data exists for current day.
    """
    return compute_current_day_index_response(
        corridor=corridor,
        airline=airline,
        window=window,
        tz=tz,
        target_date=target_date,
    )


@app.get("/api/v2/routes/matrix")
async def get_routes_matrix_v2(
    cluster: Optional[str] = Query(None, description="Cluster name"),
    search: Optional[str] = Query(None, description="Search term"),
    min_fare: Optional[float] = Query(None, description="Minimum fare filter"),
    max_fare: Optional[float] = Query(None, description="Maximum fare filter"),
):
    """
    Reactive corridor matrix & price relatives computed from clean observations.
    """
    routes = INDEX_RESULTS.get("routes", [])

    if cluster and cluster != "ALL":
        cluster_route_codes = [r["code"] for r in ROUTES_CONFIG if r.get("cluster") == cluster]
        routes = [r for r in routes if r["route"] in cluster_route_codes]

    if search:
        s = search.lower()
        routes = [r for r in routes if s in r["route"].lower() or s in r.get("name", "").lower()]

    if min_fare is not None:
        routes = [r for r in routes if r.get("current_fare", 0) >= min_fare]
    if max_fare is not None:
        routes = [r for r in routes if r.get("current_fare", 0) <= max_fare]

    return {
        "total_corridors": len(routes),
        "corridors": routes,
    }


@app.get("/api/v2/elasticity/curve")
async def get_elasticity_curve_v2(
    route: Optional[str] = Query(None, description="Corridor, e.g. DEL-BOM"),
    airline: Optional[str] = Query(None, description="Carrier, e.g. IndiGo"),
):
    """
    Advance booking pricing curve from verified clean records.
    """
    records = query_clean_store(
        route=route if route != "ALL" else None,
        airline=airline if airline != "ALL" else None,
    )
    idx_res = compute_airfare_indexes(records) if records else INDEX_RESULTS
    return {
        "corridor": route or "ALL",
        "carrier": airline or "ALL",
        "curve": idx_res.get("elasticity", []),
    }


@app.get("/api/v2/observations")
async def get_observations_v2(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    route: Optional[str] = Query(None),
    airline: Optional[str] = Query(None),
    window: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    tz: str = Query("Asia/Kolkata", description="Timezone name"),
    current_day_only: bool = Query(True, description="When true and no dates provided, strictly filter by current calendar day"),
):
    """
    Clean observational ledger with pagination. Excludes all quarantined contamination records.
    By default on initial page load, strictly queries for the current calendar day in the target timezone.
    """
    today = get_server_today(tz)
    today_str = today.strftime("%Y-%m-%d")

    is_today_filtered = False
    if start_date is None and end_date is None and current_day_only:
        start_date = today
        end_date = today
        is_today_filtered = True

    records = query_clean_store(
        start_date=start_date,
        end_date=end_date,
        route=route if route != "ALL" else None,
        airline=airline if airline != "ALL" else None,
        window=window if window != "ALL" else None,
    )

    if is_today_filtered:
        records = [o for o in records if (o.get("capture_date") or o.get("travel_date", "")) == today_str]

    total_matched = len(records)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    return {
        "calendar_date": today_str if is_today_filtered else (str(start_date) if start_date else None),
        "timezone": tz,
        "is_current_day_filter": is_today_filtered,
        "total": total_matched,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_matched + page_size - 1) // page_size if total_matched > 0 else 0,
        "data": records[start_idx:end_idx],
        "message": (
            f"Showing {total_matched} verified observations for current day ({today_str}) in {tz}."
            if total_matched > 0
            else f"No flight observations recorded for current calendar day ({today_str}) in {tz} timezone."
        ) if is_today_filtered else f"Matched {total_matched} records.",
    }


@app.get("/api/v2/integrity/audit")
async def get_integrity_audit_v2(
    severity: Optional[str] = Query(None, description="Filter severity: CRITICAL, WARNING, ALL"),
    page: int = Query(1, ge=1),
):
    """
    Real-time quarantine & contamination telemetry dashboard endpoint.
    Provides administrative surveillance, drift tracking, and self-healing recommendations.
    """
    quarantined = QUARANTINED_FLIGHT_OBSERVATIONS

    if severity and severity != "ALL":
        if severity == "CRITICAL":
            quarantined = [q for q in quarantined if any("CRITICAL" in r for r in q.get("quarantine_reasons", []))]
        elif severity == "WARNING":
            quarantined = [q for q in quarantined if not any("CRITICAL" in r for r in q.get("quarantine_reasons", []))]

    limit = 20
    start_idx = (page - 1) * limit
    paginated = quarantined[start_idx : start_idx + limit]

    return {
        "telemetry": {
            "engine_version": TELEMETRY_AUDIT.get("engine_version", "2.0.0"),
            "timestamp": TELEMETRY_AUDIT.get("timestamp"),
            "total_scraped_observations": TELEMETRY_AUDIT.get("total_scraped_observations", 0),
            "clean_records_count": TELEMETRY_AUDIT.get("clean_records_count", 0),
            "quarantined_records_count": len(QUARANTINED_FLIGHT_OBSERVATIONS),
            "contamination_rate_pct": TELEMETRY_AUDIT.get("contamination_rate_pct", 0.0),
            "contamination_status": TELEMETRY_AUDIT.get("contamination_status", "NORMAL"),
            "flight_route_drift_count": TELEMETRY_AUDIT.get("flight_route_drift_count", 0),
            "top_rejection_reasons": TELEMETRY_AUDIT.get("top_rejection_reasons", []),
        },
        "flight_route_drifts": TELEMETRY_AUDIT.get("flight_route_drifts", []),
        "quarantined_pagination": {
            "page": page,
            "limit": limit,
            "total_quarantined": len(quarantined),
            "total_pages": (len(quarantined) + limit - 1) // limit,
            "records": paginated,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
#  V1 BACKWARD COMPATIBLE API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/index/current")
def get_current_index(
    tz: str = Query("Asia/Kolkata", description="Timezone name"),
    target_date: Optional[date] = Query(None, description="Explicit target date"),
):
    return compute_current_day_index_response(tz=tz, target_date=target_date)


@app.get("/api/index/history")
def get_index_history(
    route: Optional[str] = None,
    airline: Optional[str] = None,
    window: Optional[str] = None,
    frequency: Optional[str] = "Daily",
):
    filtered_obs = query_clean_store(
        route=route if route != "ALL" else None,
        airline=airline if airline != "ALL" else None,
        window=window if window != "ALL" else None,
    )

    idx_res = compute_airfare_indexes(filtered_obs, frequency=frequency or "Daily") if filtered_obs else INDEX_RESULTS
    trend = idx_res.get("daily_trend", [])

    return {
        "filter_applied": {
            "route": route or "ALL",
            "airline": airline or "ALL",
            "window": window or "ALL",
            "frequency": frequency or "Daily",
        },
        "stats": {
            "current_index": idx_res.get("current_index"),
            "change_24h": idx_res.get("change_24h"),
            "change_7d": idx_res.get("change_7d"),
            "overall_avg_fare": idx_res.get("overall_avg_fare"),
            "usable_observations": len(filtered_obs),
        },
        "history": trend,
        "routes": idx_res.get("routes", []),
        "airlines": idx_res.get("airlines", []),
        "elasticity": idx_res.get("elasticity", []),
    }


@app.get("/api/routes")
def get_routes_summary(cluster: Optional[str] = None):
    routes = INDEX_RESULTS.get("routes", [])
    if cluster and cluster != "ALL":
        cluster_route_codes = [r["code"] for r in ROUTES_CONFIG if r.get("cluster") == cluster]
        routes = [r for r in routes if r["route"] in cluster_route_codes]

    return {
        "total_routes": len(routes),
        "routes": routes,
        "configurations": ROUTES_CONFIG,
    }


@app.get("/api/clusters")
def get_clusters_summary():
    return CLUSTER_RESULTS


@app.get("/api/airlines")
def get_airlines_summary():
    return {
        "airlines": INDEX_RESULTS.get("airlines", []),
        "configurations": AIRLINES_CONFIG,
    }


@app.get("/api/elasticity")
def get_booking_window_elasticity():
    return {
        "booking_windows": INDEX_RESULTS.get("elasticity", []),
        "configurations": WINDOWS_CONFIG,
    }


@app.get("/api/anomalies")
def get_anomalies():
    return {
        "total_anomalies_detected": len(ANOMALIES_RESULTS),
        "high_severity_count": len([a for a in ANOMALIES_RESULTS if a["severity"] == "HIGH"]),
        "anomalies": ANOMALIES_RESULTS,
    }


@app.get("/api/explainability")
def get_index_explainability():
    routes_summary = INDEX_RESULTS.get("routes", [])
    sorted_by_change = sorted(routes_summary, key=lambda x: x["change_24h"], reverse=True)
    top_positive = sorted_by_change[0] if sorted_by_change else None
    top_negative = sorted_by_change[-1] if sorted_by_change else None

    contributions = []
    for r in routes_summary:
        contrib_pts = round((r["change_24h"] * r["weight"]), 2)
        contributions.append({
            "route": r["route"],
            "name": r["name"],
            "change_24h_pct": r["change_24h"],
            "weight_pct": round(r["weight"] * 100, 1),
            "contribution_points": contrib_pts,
        })

    return {
        "latest_index": INDEX_RESULTS.get("current_index"),
        "index_change_24h_pct": INDEX_RESULTS.get("change_24h"),
        "primary_driver_corridor": top_positive["name"] if top_positive else "DEL-BOM",
        "primary_driver_impact_pct": top_positive["change_24h"] if top_positive else 0.0,
        "stabilizing_corridor": top_negative["name"] if top_negative else "DEL-CCU",
        "route_contributions": contributions,
    }


@app.get("/api/backtest")
def get_dgca_backtest():
    return BACKTEST_RESULTS


@app.get("/api/observations")
def get_raw_observations(
    search: Optional[str] = None,
    route: Optional[str] = None,
    airline: Optional[str] = None,
    window: Optional[str] = None,
    quality_min: Optional[int] = 0,
    page: int = 1,
    limit: int = 50,
    tz: str = "Asia/Kolkata",
    current_day_only: bool = True,
):
    today = get_server_today(tz)
    today_str = today.strftime("%Y-%m-%d")

    obs = CLEAN_FLIGHT_OBSERVATIONS
    if current_day_only:
        obs = [o for o in obs if (o.get("capture_date") or o.get("travel_date", "")) == today_str]

    if search:
        s = search.lower()
        obs = [
            o for o in obs
            if s in o.get("flight_number", "").lower()
            or s in o.get("route", "").lower()
            or s in o.get("airline", "").lower()
            or s in o.get("source", "").lower()
        ]
    if route and route != "ALL":
        obs = [o for o in obs if o.get("route") == route]
    if airline and airline != "ALL":
        obs = [o for o in obs if o.get("airline") == airline]
    if window and window != "ALL":
        obs = [o for o in obs if o.get("booking_window") == window]
    if quality_min:
        obs = [o for o in obs if o.get("quality_score", 0) >= quality_min]

    total_matched = len(obs)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit

    return {
        "calendar_date": today_str if current_day_only else None,
        "timezone": tz,
        "total": total_matched,
        "page": page,
        "limit": limit,
        "total_pages": (total_matched + limit - 1) // limit if total_matched > 0 else 0,
        "data": obs[start_idx:end_idx],
    }


async def _async_scrape_task(routes: List[str], sources: List[str], cluster: Optional[str] = None):
    global SCRAPE_IN_PROGRESS
    SCRAPE_IN_PROGRESS = True
    try:
        await run_scraping_job(sources=sources, routes=routes, windows=["T+1", "T+7"], cluster=cluster)
        refresh_pipeline_data()
    except Exception as e:
        print(f"Async scrape task error: {e}")
    finally:
        SCRAPE_IN_PROGRESS = False


@app.api_route("/api/scrape/trigger", methods=["GET", "POST"])
async def trigger_live_scrape(
    background_tasks: BackgroundTasks,
    routes: Optional[List[str]] = Query(default=["all"]),
    sources: Optional[List[str]] = Query(default=["all"]),
    cluster: Optional[str] = Query(default=None),
):
    global SCRAPE_IN_PROGRESS
    if SCRAPE_IN_PROGRESS:
        return {
            "status": "BUSY",
            "message": "Scrape task already running in background.",
            "in_progress": True,
        }

    target_routes = routes or ["all"]
    background_tasks.add_task(_async_scrape_task, target_routes, sources, cluster)
    return {
        "status": "ACCEPTED",
        "message": f"Scrape task launched across {len(ROUTES_CONFIG) if 'all' in target_routes else len(target_routes)} corridors"
        + (f" (Cluster: {cluster})" if cluster else ""),
        "in_progress": True,
    }


@app.get("/api/scrape/status")
def get_scrape_status():
    meta = get_latest_scrape_metadata()
    status_str = "running" if SCRAPE_IN_PROGRESS else "completed" if meta.get("status") == "AVAILABLE" else "idle"
    return {
        "status": status_str,
        "in_progress": SCRAPE_IN_PROGRESS,
        "total_live_scraped_observations": len(SCRAPED_DATA),
        "latest_scrape_metadata": meta,
        "sources_active": ["MakeMyTrip (Playwright)", "Ixigo (Playwright)"],
    }


@app.get("/api/health")
def get_pipeline_health():
    return {
        "status": "HEALTHY",
        "tracked_routes_count": len(ROUTES_CONFIG),
        "connectors": [
            {"source": "MakeMyTrip (OTA)", "type": "Playwright Scraper", "status": "IMPLEMENTED", "records_scraped": len(SCRAPED_DATA), "robots_txt": "COMPLIANT"},
            {"source": "Ixigo (OTA)", "type": "Playwright Scraper", "status": "IMPLEMENTED", "records_scraped": len(SCRAPED_DATA), "robots_txt": "COMPLIANT"},
        ],
        "quality_statistics": QUALITY_STATS,
        "integrity_telemetry": {
            "clean_records": len(CLEAN_FLIGHT_OBSERVATIONS),
            "quarantined_records": len(QUARANTINED_FLIGHT_OBSERVATIONS),
            "contamination_rate_pct": TELEMETRY_AUDIT["contamination_rate_pct"],
            "status": TELEMETRY_AUDIT["contamination_status"],
        },
        "rate_limiting": "ACTIVE (3.0s per request + Jitter)",
        "live_scraped_records": len(SCRAPED_DATA),
        "last_execution": INDEX_RESULTS.get("last_updated"),
    }


@app.get("/api/integrity")
def get_integrity_report():
    """Returns data integrity report from the Statistical Integrity Engine."""
    return {
        "engine": "AirIndex Anti-Contamination Engine v2.0",
        "description": "Dual-Phase Gateway: Master Flight Registry cross-check, Isolation Forest pricing anomaly detection, and clean store isolation.",
        "report": TELEMETRY_AUDIT,
        "registry_size": 60,
        "validated_observations": len(COMBINED_RAW),
        "clean_records_count": len(CLEAN_FLIGHT_OBSERVATIONS),
        "quarantined_records_count": len(QUARANTINED_FLIGHT_OBSERVATIONS),
        "integrity_pct": round(100.0 - TELEMETRY_AUDIT["contamination_rate_pct"], 2),
        "top_issues": TELEMETRY_AUDIT.get("quarantined_sample", [])[:10],
    }


@app.get("/api/methodology")
def get_methodology_spec():
    return {
        "index_type": "Weighted Base-100 Airfare Price Index (APIx)",
        "base_period": "January 2026 = 100.0",
        "formulas": {
            "route_price_relative": "P_{r,t} = (Fare_{r,t} / BaseFare_{r,0}) * 100",
            "weighted_index": "APIx_t = SUM(P_{r,t} * Weight_r) / SUM(Weight_r)",
            "jevons_index": "J_t = 100 * (PRODUCT(Fare_{r,t} / BaseFare_{r,0}))^(1/N)",
            "isolation_forest_score": "CompositeConfidence = 0.60 * RuleRegistry + 0.40 * IsolationForest",
        },
        "basket_weights": {r["code"]: r["weight"] for r in ROUTES_CONFIG},
        "advance_windows": [w["code"] for w in WINDOWS_CONFIG],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
