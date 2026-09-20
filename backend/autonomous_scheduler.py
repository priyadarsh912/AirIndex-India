"""
AirIndex India - Autonomous Multi-Interval Scraper & Econometric Retraining Engine
Executes automated scraping 5-6 times daily across all 52 domestic corridors,
filters observations through anti-contamination and data quality gates,
retrains econometric index models, and persists verified quotes to Supabase.
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutonomousScheduler")

# Timezone and Daily Schedule Configuration (IST: UTC+5:30)
SCHEDULE_INTERVAL_HOURS = 4  # 6 runs per day (every 4 hours)
DEFAULT_SCHEDULED_HOURS_IST = [2, 6, 10, 14, 18, 22]  # 6 strategic daily collection windows


class AutonomousScheduler:
    def __init__(self):
        self.is_running = False
        self.current_state = "IDLE"  # IDLE, SCRAPING, FILTERING, TRAINING, PERSISTING, COMPLETED, ERROR
        self.last_run_timestamp: Optional[str] = None
        self.last_run_date: Optional[str] = None
        self.last_run_stats: Dict[str, Any] = {}
        self.runs_today_count: int = 0
        self.next_run_timestamp: Optional[str] = None
        self.total_records_today: int = 0
        self.error_log: List[Dict[str, Any]] = []
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive telemetry of the autonomous scheduler."""
        now = datetime.now()
        today_str = now.strftime("%Y-%m-%d")

        # Reset daily counter if calendar day changed
        if self.last_run_date and self.last_run_date != today_str:
            self.runs_today_count = 0
            self.total_records_today = 0

        return {
            "is_active": self.is_running,
            "state": self.current_state,
            "schedule": f"6 times daily (every {SCHEDULE_INTERVAL_HOURS} hours: {', '.join(f'{h:02d}:00' for h in DEFAULT_SCHEDULED_HOURS_IST)} IST)",
            "runs_per_day": len(DEFAULT_SCHEDULED_HOURS_IST),
            "runs_today": self.runs_today_count,
            "total_records_today": self.total_records_today,
            "last_run_timestamp": self.last_run_timestamp,
            "last_run_date": self.last_run_date,
            "next_run_timestamp": self.next_run_timestamp,
            "last_run_stats": self.last_run_stats,
            "error_count": len(self.error_log),
            "recent_errors": self.error_log[-5:] if self.error_log else [],
        }

    def _compute_next_run(self) -> datetime:
        """Calculates the next upcoming scheduled run slot."""
        now = datetime.now()
        current_hour = now.hour

        # Find the next scheduled hour today
        for h in sorted(DEFAULT_SCHEDULED_HOURS_IST):
            if h > current_hour or (h == current_hour and now.minute < 2):
                next_dt = now.replace(hour=h, minute=0, second=0, microsecond=0)
                if next_dt > now:
                    return next_dt

        # Otherwise next run is the first slot tomorrow
        tomorrow = now + timedelta(days=1)
        first_hour = min(DEFAULT_SCHEDULED_HOURS_IST)
        return tomorrow.replace(hour=first_hour, minute=0, second=0, microsecond=0)

    async def run_pipeline_cycle(self, forced: bool = False) -> Dict[str, Any]:
        """
        Executes a complete 4-stage pipeline cycle:
        1. SCRAPE: Collects quotes across all 52 corridors from OTAs & Master Registry
        2. FILTER: Partitions clean vs quarantined and audits quality scores
        3. TRAIN: Retrains econometric index series, elasticity, clusters, and anomalies
        4. PERSIST: Bulk upserts to Supabase and syncs frontend JSON
        """
        async with self._lock:
            start_time = datetime.now()
            today_str = start_time.strftime("%Y-%m-%d")
            cycle_id = f"CYCLE-{start_time.strftime('%Y%m%d_%H%M%S')}"

            logger.info(f"[{cycle_id}] Initiating autonomous scraping and econometric training cycle (forced={forced})...")
            self.current_state = "SCRAPING"

            cycle_report = {
                "cycle_id": cycle_id,
                "start_time": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "date": today_str,
                "stages": {},
                "success": False,
            }

            try:
                # ── STAGE 1: SCRAPING ACROSS ALL 52 CORRIDORS ──────────────────
                logger.info(f"[{cycle_id}] Stage 1: Harvesting quotes for all 52 domestic corridors...")
                from scrape_flights import run_scraping_job
                scrape_stats = await run_scraping_job(
                    sources=["all"],
                    routes=["all"],
                    windows=["T+1", "T+7", "T+15", "T+30", "T+45"],
                    dry_run=False,
                )
                cycle_report["stages"]["scraping"] = {
                    "records_harvested": scrape_stats.get("total_records", 0),
                    "corridors_covered": len(scrape_stats.get("corridors_scraped", [])),
                    "harvest_method": scrape_stats.get("harvest_method", "HYBRID"),
                    "file_saved": scrape_stats.get("file_saved"),
                    "supabase_persisted": scrape_stats.get("supabase_persisted", False),
                }

                # ── STAGE 2: FILTERING & ANTI-CONTAMINATION AUDITING ───────────
                self.current_state = "FILTERING"
                logger.info(f"[{cycle_id}] Stage 2: Filtering observations through anti-contamination gates...")

                from data_loader import load_scraped_observations, merge_scraped_with_fixture
                import main as app_main

                fresh_scraped = load_scraped_observations()
                combined = merge_scraped_with_fixture(app_main.FIXTURE_DATA["raw_observations"], fresh_scraped)

                from integrity_engine import partition_observations
                clean_obs, quarantined_obs, telemetry_audit = partition_observations(combined)

                from quality_engine import process_data_quality
                cleaned_data, quality_stats = process_data_quality(clean_obs)

                cycle_report["stages"]["filtering"] = {
                    "total_observations": len(combined),
                    "clean_records": len(clean_obs),
                    "quarantined_records": len(quarantined_obs),
                    "contamination_rate_pct": telemetry_audit.get("contamination_rate_pct", 0.0),
                    "clean_verified_records": len(cleaned_data),
                }

                # ── STAGE 3: MODEL RETRAINING & ECONOMETRIC EXECUTION ──────────
                self.current_state = "TRAINING"
                logger.info(f"[{cycle_id}] Stage 3: Retraining index series, elasticity curves, and anomaly baselines...")

                from index_engine import compute_airfare_indexes
                from anomaly_engine import detect_airfare_anomalies
                from clustering_engine import compute_route_clusters
                from backtest_engine import run_dgca_backtest

                index_results = compute_airfare_indexes(cleaned_data)
                anomalies_results = detect_airfare_anomalies(cleaned_data)
                cluster_results = compute_route_clusters(cleaned_data)
                backtest_results = run_dgca_backtest(index_results.get("daily_trend", []), app_main.FIXTURE_DATA["dgca_benchmark"])

                # Update live backend pipeline state
                app_main.SCRAPED_DATA = fresh_scraped
                app_main.COMBINED_RAW = combined
                app_main.CLEAN_FLIGHT_OBSERVATIONS = clean_obs
                app_main.QUARANTINED_FLIGHT_OBSERVATIONS = quarantined_obs
                app_main.TELEMETRY_AUDIT = telemetry_audit
                app_main.VERIFIED_USABLE_OBSERVATIONS = [
                    o for o in clean_obs
                    if o.get("validation_status") == "VERIFIED" and o.get("is_usable", True)
                ]
                app_main.CLEANED_DATA = cleaned_data
                app_main.QUALITY_STATS = quality_stats
                app_main.INDEX_RESULTS = index_results
                app_main.ANOMALIES_RESULTS = anomalies_results
                app_main.CLUSTER_RESULTS = cluster_results
                app_main.BACKTEST_RESULTS = backtest_results

                # Recalculate PSD Laspeyres Basket weights
                try:
                    from psd_basket_manager import basket_manager
                    basket_manager.calculate_route_weights(cleaned_data)
                    logger.info("[PSD Basket] Route weights successfully re-calibrated.")
                except Exception as b_err:
                    logger.warning(f"Could not recompute PSD basket weights: {b_err}")

                # Flush high-speed query LRU caches so website serves new calculations instantly
                app_main.clear_index_caches()

                cycle_report["stages"]["training"] = {
                    "status": "COMPLETED",
                    "daily_trend_points": len(index_results.get("daily_trend", [])),
                    "anomalies_detected": len(anomalies_results) if isinstance(anomalies_results, list) else len(anomalies_results.get("anomalies", [])),
                    "clusters_computed": len(cluster_results.get("clusters", [])),
                    "caches_flushed": True,
                }


                # ── STAGE 4: SUPABASE CONFIRMATION & TELEMETRY UPDATE ──────────
                self.current_state = "PERSISTING"
                cycle_report["stages"]["persistence"] = {
                    "supabase_table": "flight_observations",
                    "supabase_status": "UPSERTED" if scrape_stats.get("supabase_persisted") else "LOCAL_BACKUP",
                    "frontend_synced": True,
                }

                # Finalize telemetry
                end_time = datetime.now()
                duration_seconds = (end_time - start_time).total_seconds()
                cycle_report["end_time"] = end_time.strftime("%Y-%m-%d %H:%M:%S")
                cycle_report["duration_seconds"] = duration_seconds
                cycle_report["success"] = True

                self.last_run_timestamp = end_time.strftime("%Y-%m-%d %H:%M:%S")
                self.last_run_date = today_str
                self.last_run_stats = cycle_report
                self.runs_today_count += 1
                self.total_records_today += scrape_stats.get("total_records", 0)
                self.current_state = "COMPLETED"

                logger.info(f"[{cycle_id}] Successfully finished autonomous cycle in {duration_seconds:.1f}s. Total records: {scrape_stats.get('total_records', 0)}")
                return cycle_report

            except Exception as exc:
                err_msg = f"Pipeline cycle failed at stage '{self.current_state}': {str(exc)}"
                logger.error(f"[{cycle_id}] {err_msg}", exc_info=True)
                self.current_state = "ERROR"
                cycle_report["error"] = err_msg
                cycle_report["success"] = False
                self.error_log.append({
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "cycle_id": cycle_id,
                    "error": str(exc),
                })
                return cycle_report

    async def _loop(self):
        """Continuous background loop running scheduled jobs at configured intervals."""
        logger.info("[Scheduler Loop] Starting background loop. Checking if today's scrape is needed...")

        # 1. On startup: Check if today has already been scraped
        today_str = datetime.now().strftime("%Y-%m-%d")
        needs_today_scrape = True

        from data_loader import load_scraped_observations
        existing_scrapes = load_scraped_observations()
        today_records = [o for o in existing_scrapes if (o.get("capture_date") or o.get("timestamp", ""))[:10] == today_str]

        if len(today_records) >= 50:
            logger.info(f"[Scheduler Loop] Found {len(today_records)} records already scraped for today ({today_str}).")
            needs_today_scrape = False
        else:
            logger.info(f"[Scheduler Loop] Today's scrape ({today_str}) not detected or incomplete ({len(today_records)} records). Triggering immediate scrape cycle...")

        if needs_today_scrape:
            try:
                await self.run_pipeline_cycle(forced=True)
            except Exception as e:
                logger.error(f"[Scheduler Loop] Error during startup scrape: {e}")

        # 2. Main scheduled loop
        while self.is_running:
            try:
                next_run_dt = self._compute_next_run()
                self.next_run_timestamp = next_run_dt.strftime("%Y-%m-%d %H:%M:%S")
                wait_seconds = max(1.0, (next_run_dt - datetime.now()).total_seconds())

                logger.info(f"[Scheduler Loop] Next scheduled run at {self.next_run_timestamp} (sleeping {wait_seconds / 60:.1f} mins)...")
                await asyncio.sleep(wait_seconds)

                if not self.is_running:
                    break

                logger.info("[Scheduler Loop] Scheduled timer fired. Initiating scrape cycle...")
                await self.run_pipeline_cycle(forced=False)

            except asyncio.CancelledError:
                logger.info("[Scheduler Loop] Task cancelled.")
                break
            except Exception as e:
                logger.error(f"[Scheduler Loop] Unexpected loop error: {e}")
                await asyncio.sleep(60)

    def start(self):
        """Starts the autonomous background scheduling worker."""
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Autonomous Scraper & Retraining Engine started.")

    def stop(self):
        """Gracefully stops the scheduler worker."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Autonomous Scraper & Retraining Engine stopped.")


# Global Singleton Instance
scheduler = AutonomousScheduler()
