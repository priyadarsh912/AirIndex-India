#!/usr/bin/env python3
"""
AirIndex India - Corridor Runner
================================
Scrapes ALL corridors for T+0 .. T+30 every 3 hours (IST slots 00,03,06,...,21), survives
crashes / power cuts / reboots, and publishes website-ready JSON.

    python backend/scraper/corridor_runner.py --once        # one full sweep now, then exit
    python backend/scraper/corridor_runner.py --daemon      # keep running, one sweep per 3-hour slot

Single route (unchanged):  python backend/scraper/google_flights.py --origin IXB --destination IXC --days 2

How "even if the system is off" works
-------------------------------------
A program cannot run while the machine is off. What this does:
  * State is checkpointed to disk (atomically) after every few searches. If the process dies mid-sweep,
    the next start RESUMES the same slot and only scrapes what is missing.
  * On start-up it compares the last completed slot with the current one. Missed slots are recorded in
    `gaps` (state.json + latest_run.json) and a sweep for the current slot starts immediately.
    Google only shows CURRENT prices, so a missed slot cannot be back-filled - it is logged as a gap.
  * Uploads that failed (Supabase offline) stay queued and are retried on the next run.
  * For real 24x7 collection run it on an always-on host (VPS / Render / Railway worker), or let the OS
    start it: Windows Task Scheduler ("Run task as soon as possible after a scheduled start is missed")
    or cron `0 */3 * * *  ... --once`.

Outputs
-------
  <data-dir>/state.json                  checkpoint, gaps, upload queue
  <data-dir>/runs/<slot>.jsonl           every raw record of that sweep (full fare structure)
  <web-dir>/index.json                   all corridors: summary + link to detail file
  <web-dir>/corridors/<ORG>-<DST>.json   per corridor: by travel date, every flight (compact)
  <web-dir>/history/<ORG>-<DST>.json    min/median fare per lead-day for each run (for trend charts)
  <web-dir>/latest_run.json              status of the most recent sweep + recent gaps
"""

import os
import re
import sys
import json
import time
import random
import signal
import logging
import argparse
import threading
import statistics
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

HERE = Path(__file__).resolve().parent
try:
    import google_flights as gf
except ImportError:  # imported as a package
    from backend.scraper import google_flights as gf

IST = gf.IST
ROOT_DIR = HERE.parent.parent
DEFAULT_DATA_DIR = ROOT_DIR / "data" / "scraper"
DEFAULT_WEB_DIR = ROOT_DIR / "frontend" / "public" / "data" / "airindex"
DEFAULT_CORRIDORS = HERE / "corridors.json"
SLOT_HOURS = 3
HISTORY_KEEP = 240            # runs kept per corridor history (= 30 days of 3-hour runs)
UPLOAD_BATCH = 500
BLOCKING_ISSUES = {"price_unavailable", "fare_out_of_band", "price_outlier",
                   "route_mismatch", "date_mismatch", "arrival_before_departure"}

log = logging.getLogger("airscope.scraper.runner")
STOP = threading.Event()      # set by Ctrl-C / SIGTERM


# --------------------------------------------------------------------------------------
# Small utilities
# --------------------------------------------------------------------------------------
def atomic_write_json(path: Path, obj: Any) -> None:
    """Write to a temp file then rename, so a power cut can never leave half a JSON file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), default=str)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def read_json(path: Path, default: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def now_ist() -> datetime:
    return datetime.now(IST)


# ---- 3-hour slots (aligned to IST clock: 00:00, 03:00, ... 21:00) ----
def slot_start(dt: datetime) -> datetime:
    dt = dt.astimezone(IST)
    return dt.replace(hour=dt.hour // SLOT_HOURS * SLOT_HOURS, minute=0, second=0, microsecond=0)


def slot_id(dt: datetime) -> str:
    return slot_start(dt).strftime("%Y%m%dT%H%M")


def slot_dt(sid: str) -> datetime:
    return datetime.strptime(sid, "%Y%m%dT%H%M").replace(tzinfo=IST)


def next_slot_start(dt: datetime) -> datetime:
    return slot_start(dt) + timedelta(hours=SLOT_HOURS)


def missed_slots(last_completed: Optional[str], now: datetime) -> List[str]:
    """Slots strictly between the last completed one and the current one."""
    if not last_completed:
        return []
    out, cur = [], slot_dt(last_completed) + timedelta(hours=SLOT_HOURS)
    limit = slot_start(now)
    while cur < limit:
        out.append(cur.strftime("%Y%m%dT%H%M"))
        cur += timedelta(hours=SLOT_HOURS)
    return out


# --------------------------------------------------------------------------------------
# Corridors
# --------------------------------------------------------------------------------------
_IATA = re.compile(r"^[A-Z]{3}$")


def _parse_pair(x: Any) -> Optional[Tuple[str, str]]:
    if isinstance(x, dict):
        o, d = x.get("origin"), x.get("destination")
    elif isinstance(x, (list, tuple)) and len(x) == 2:
        o, d = x
    else:
        parts = [p for p in re.split(r"[\s,>\-:/]+", str(x).strip().upper()) if p]
        if len(parts) != 2:
            return None
        o, d = parts
    o, d = str(o or "").strip().upper(), str(d or "").strip().upper()
    return (o, d) if _IATA.match(o) and _IATA.match(d) and o != d else None


def load_corridors(path: Path) -> List[Dict[str, str]]:
    """
    corridors.json: ["DEL-BOM", "IXB-IXC", {"origin": "BLR", "destination": "HYD"}, ...]
    or a .txt/.csv with one pair per line ("DEL-BOM", "DEL BOM", "DEL,BOM"). Lines starting with # ignored.
    """
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        data = json.loads(text)
        data = data.get("corridors", []) if isinstance(data, dict) else data
    else:
        data = [ln for ln in text.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    out, seen = [], set()
    for x in data:
        pair = _parse_pair(x)
        if pair is None:
            log.warning(f"Ignoring invalid corridor entry: {x!r}")
            continue
        if pair in seen:
            continue
        seen.add(pair)
        out.append({"id": f"{pair[0]}-{pair[1]}", "origin": pair[0], "destination": pair[1]})
    return out


# --------------------------------------------------------------------------------------
# Lock (cross-platform, heartbeat based - no PID probing, which is unsafe on Windows)
# --------------------------------------------------------------------------------------
class Lock:
    STALE_AFTER = 900  # seconds without heartbeat -> previous owner is considered dead

    def __init__(self, path: Path):
        self.path = path

    def acquire(self) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists() and time.time() - self.path.stat().st_mtime < self.STALE_AFTER:
            return False
        self.path.write_text(f"{os.getpid()} {now_ist().isoformat()}", encoding="utf-8")
        return True

    def touch(self) -> None:
        try:
            os.utime(self.path, None)
        except OSError:
            pass

    def release(self) -> None:
        try:
            self.path.unlink()
        except OSError:
            pass


# --------------------------------------------------------------------------------------
# State
# --------------------------------------------------------------------------------------
class State:
    DEFAULT = {"last_completed_slot": None, "last_completed_at": None, "last_attempted_slot": None,
               "current": None, "pending_uploads": [], "gaps": []}

    def __init__(self, path: Path):
        self.path = path
        self.data = {**self.DEFAULT, **read_json(path, {})}

    def save(self) -> None:
        atomic_write_json(self.path, self.data)

    def add_gap(self, slots: List[str]) -> None:
        if not slots:
            return
        self.data["gaps"].append({
            "missed_slots": slots, "detected_at": now_ist().isoformat(),
            "note": "Scraper was not running; Google shows current prices only, so these slots cannot be back-filled."})
        self.data["gaps"] = self.data["gaps"][-200:]
        self.save()


# --------------------------------------------------------------------------------------
# Failure governor: pause on repeated failures (likely Google rate limit), abort after too many
# --------------------------------------------------------------------------------------
class Governor:
    def __init__(self, deadline: float, fail_threshold: int = 3, cooldown_s: int = 120, max_cooldowns: int = 5):
        self.deadline, self.fail_threshold = deadline, fail_threshold
        self.cooldown_s, self.max_cooldowns = cooldown_s, max_cooldowns
        self._lock = threading.Lock()
        self._consec = 0
        self._pause_until = 0.0
        self.cooldowns = 0
        self.aborted = False

    def should_stop(self) -> bool:
        return STOP.is_set() or self.aborted or time.time() > self.deadline

    def wait_if_paused(self) -> None:
        while not self.should_stop() and time.time() < self._pause_until:
            time.sleep(1)

    def report_rate_limit(self, cooldown_seconds: int = 30) -> None:
        with self._lock:
            if time.time() >= self._pause_until:
                self._pause_until = time.time() + cooldown_seconds
                log.warning(f"[Anti Rate-Limit Engine] Google rate-limit/CAPTCHA detected by worker. Pausing all threads for {cooldown_seconds}s to clear IP rate bucket...")

    def report(self, ok: bool) -> None:
        with self._lock:
            if ok:
                self._consec = 0
                return
            self._consec += 1
            if self._consec >= self.fail_threshold:
                self._consec = 0
                self.cooldowns += 1
                if self.cooldowns > self.max_cooldowns:
                    self.aborted = True
                    log.error("Too many consecutive failures - aborting sweep (progress is saved; next run resumes).")
                else:
                    self._pause_until = time.time() + self.cooldown_s
                    log.warning(f"{self.fail_threshold} failures in a row (rate limit?). Cooling down {self.cooldown_s}s "
                                f"({self.cooldowns}/{self.max_cooldowns}).")


# --------------------------------------------------------------------------------------
# Website JSON
# --------------------------------------------------------------------------------------
def _fare(r: Dict[str, Any]) -> float:
    return r["total_fare"] if r.get("total_fare") is not None else float("inf")


def _usable(r: Dict[str, Any]) -> bool:
    return r.get("total_fare") is not None and not (set(r.get("validation_issues") or []) & BLOCKING_ISSUES)


def compact_flight(r: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "flight_number": r["flight_number"],
        "full_flight_number": r["full_flight_number"],
        "airline": r["airline"],
        "dep": r["departure_time"],
        "arr": r["arrival_time"],
        "arrives_next_day": r["arrives_next_day"],
        "stops": r["stops"],
        "layovers": r["layover_airports"],
        "duration_min": r["duration_minutes"],
        "base_fare": r["base_fare"],
        "taxes": r["taxes"],
        "final_fare": r["total_fare"],
        "fare_breakdown": r["fare_breakdown_type"],   # "estimated": only final_fare comes from Google
        "seats": r["seat_availability"],
        "validation": r["registry_validation"],
    }


def build_corridor_doc(corr: Dict[str, str], rows: List[Dict[str, Any]], slot: str,
                       prev: Optional[Dict[str, Any]], today: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Returns (corridor document, history entry for this run)."""
    today_d = datetime.strptime(today, "%Y-%m-%d").date()
    by_date: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_date[r["travel_date"]].append(r)

    entries: Dict[str, Dict[str, Any]] = {}
    for tdate, rs in by_date.items():
        rs.sort(key=lambda r: (r["departure_datetime"], _fare(r)))
        usable = [r for r in rs if _usable(r)]
        fares = [r["total_fare"] for r in usable]
        cheapest = min(usable, key=_fare) if usable else None
        entries[tdate] = {
            "travel_date": tdate, "run_slot": slot, "stale": False,
            "flights_count": len(rs), "priced_count": len(usable),
            "min_fare": min(fares) if fares else None,
            "median_fare": statistics.median(fares) if fares else None,
            "max_fare": max(fares) if fares else None,
            "cheapest": compact_flight(cheapest) if cheapest else None,
            "flights": [compact_flight(r) for r in rs],
        }
    fresh_dates = set(entries)

    # keep still-valid dates from an earlier run when this run failed to fetch them
    for e in (prev or {}).get("by_date", []):
        if e["travel_date"] not in entries and e["travel_date"] >= today:
            entries[e["travel_date"]] = {**e, "stale": True}

    ordered = sorted(entries.values(), key=lambda e: e["travel_date"])
    for e in ordered:
        e["lead_day"] = (datetime.strptime(e["travel_date"], "%Y-%m-%d").date() - today_d).days
    mins = [e for e in ordered if e["min_fare"] is not None]
    summary = {
        "dates_covered": len(ordered),
        "dates_stale": sum(1 for e in ordered if e["stale"]),
        "flights_total": sum(e["flights_count"] for e in ordered),
        "min_fare": min((e["min_fare"] for e in mins), default=None),
        "median_fare": statistics.median([e["median_fare"] for e in mins]) if mins else None,
        "max_fare": max((e["max_fare"] for e in mins), default=None),
        "cheapest_date": min(mins, key=lambda e: e["min_fare"])["travel_date"] if mins else None,
    }
    doc = {
        "corridor": corr["id"], "origin": corr["origin"], "destination": corr["destination"],
        "currency": "INR", "run_slot": slot, "generated_at": now_ist().isoformat(),
        "fare_note": "final_fare is the Google Flights price; base_fare/taxes are estimates.",
        "summary": summary, "by_date": ordered,
    }
    hist = {
        "slot": slot, "at": now_ist().isoformat(),
        "min": {str(e["lead_day"]): e["min_fare"] for e in ordered if e["travel_date"] in fresh_dates and e["min_fare"] is not None},
        "median": {str(e["lead_day"]): e["median_fare"] for e in ordered if e["travel_date"] in fresh_dates and e["median_fare"] is not None},
    }
    return doc, hist


def publish_website(web_dir: Path, corridors: List[Dict[str, str]], rows: List[Dict[str, Any]],
                    slot: str, expected: int) -> int:
    today = gf.today_ist().isoformat()
    by_corr: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_corr[f"{r['origin']}-{r['destination']}"].append(r)

    updated = 0
    for corr in corridors:
        crows = by_corr.get(corr["id"])
        if not crows:
            continue  # nothing new: keep the previous file untouched
        f = web_dir / "corridors" / f"{corr['id']}.json"
        doc, hist = build_corridor_doc(corr, crows, slot, read_json(f, None), today)
        atomic_write_json(f, doc)
        hf = web_dir / "history" / f"{corr['id']}.json"
        h = read_json(hf, {"corridor": corr["id"], "runs": []})
        h["runs"] = (h.get("runs", []) + [hist])[-HISTORY_KEEP:]
        atomic_write_json(hf, h)
        updated += 1

    index = []
    for corr in corridors:
        d = read_json(web_dir / "corridors" / f"{corr['id']}.json", None)
        if d:
            index.append({"corridor": corr["id"], "origin": corr["origin"], "destination": corr["destination"],
                          "run_slot": d["run_slot"], "generated_at": d["generated_at"], **d["summary"],
                          "file": f"corridors/{corr['id']}.json"})
    atomic_write_json(web_dir / "index.json", {
        "generated_at": now_ist().isoformat(), "run_slot": slot, "currency": "INR",
        "expected_corridors": expected, "corridors_configured": len(corridors),
        "corridors_with_data": len(index), "corridors": index})
    return updated


# --------------------------------------------------------------------------------------
# Upload (Supabase) with retry queue
# --------------------------------------------------------------------------------------
def upload_rows(rows: List[Dict[str, Any]]) -> Optional[bool]:
    """True = uploaded, False = failed (retry later), None = no DB client configured."""
    try:
        try:
            from backend.db_client import save_observations_to_supabase
        except ImportError:
            from db_client import save_observations_to_supabase
    except ImportError:
        return None
    try:
        for i in range(0, len(rows), UPLOAD_BATCH):
            if not save_observations_to_supabase(rows[i:i + UPLOAD_BATCH]):
                return False
        return True
    except Exception as e:
        log.warning(f"Upload error: {e}")
        return False


def read_run_rows(path: Path) -> List[Dict[str, Any]]:
    rows: Dict[str, Dict[str, Any]] = {}
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        for n, ln in enumerate(f):
            try:
                r = json.loads(ln)
            except ValueError:
                continue  # half-written last line after a crash
            rows[r.get("id") or f"_{n}"] = r  # de-dupe: a crash between write and checkpoint re-scrapes a few searches
    return list(rows.values())


def retry_pending_uploads(state: State, runs_dir: Path) -> None:
    for sid in list(state.data["pending_uploads"]):
        rows = [r for r in read_run_rows(runs_dir / f"{sid}.jsonl") if r.get("total_fare") is not None]
        res = upload_rows(rows) if rows else True
        if res is False:
            log.warning(f"Upload for slot {sid} still failing; will retry later.")
        else:
            state.data["pending_uploads"].remove(sid)
            log.info(f"Queued upload for slot {sid} done.")
    state.save()


def cleanup_runs(runs_dir: Path, pending: List[str], keep_days: int) -> None:
    cutoff = time.time() - keep_days * 86400
    for p in runs_dir.glob("*.jsonl"):
        if p.stem not in pending and p.stat().st_mtime < cutoff:
            p.unlink(missing_ok=True)


# --------------------------------------------------------------------------------------
# The sweep
# --------------------------------------------------------------------------------------
def run_sweep(cfg: argparse.Namespace, corridors: List[Dict[str, str]], state: State, lock: Lock,
              now: datetime) -> Dict[str, Any]:
    slot = slot_id(now)
    data_dir, web_dir = Path(cfg.data_dir), Path(cfg.web_dir)
    runs_dir = data_dir / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    run_file = runs_dir / f"{slot}.jsonl"

    # ---- resume or start fresh ----
    cur = state.data.get("current")
    if cur and cur.get("status") == "running" and cur.get("slot") != slot:
        log.warning(f"Previous sweep {cur['slot']} was interrupted; keeping its rows and queuing upload.")
        if cur["slot"] not in state.data["pending_uploads"]:
            state.data["pending_uploads"].append(cur["slot"])
        cur = None
    if cur and cur.get("slot") == slot and cur.get("status") in ("running", "partial"):
        done = set(cur.get("done", []))
        started_at = cur["started_at"]
        log.info(f"Resuming slot {slot}: {len(done)} searches already done.")
    else:
        done, started_at = set(), now_ist().isoformat()
        if run_file.exists():
            run_file.unlink()
    state.data["current"] = {"slot": slot, "status": "running", "started_at": started_at, "done": sorted(done)}
    state.data["last_attempted_slot"] = slot
    state.save()

    # ---- task list: nearest dates first, shuffled within a date to spread load ----
    today = gf.today_ist()
    tasks: List[Tuple[Dict[str, str], int, str]] = []
    for lead in range(cfg.days_max + 1):
        tdate = (today + timedelta(days=lead)).isoformat()
        group = [(c, lead, tdate) for c in corridors]
        random.shuffle(group)
        tasks.extend(group)
    total = len(tasks)
    key_of = lambda t: f"{t[0]['id']}|{t[2]}"
    pending = [t for t in tasks if key_of(t) not in done]

    gov = Governor(deadline=time.time() + cfg.time_budget_min * 60)
    stats = {"ok": 0, "empty": 0, "failed": 0, "skipped": 0, "rows": 0}
    last_errors: Dict[str, str] = {}

    def work(t):
        c, lead, tdate = t
        gov.wait_if_paused()
        if gov.should_stop():
            return "skipped", t, None, None
        time.sleep(random.uniform(cfg.delay_min, cfg.delay_max))
        try:
            recs = gf.scrape_route(c["origin"], c["destination"], tdate, cabin=cfg.cabin, currency="INR",
                                   lead_days=lead, samples=cfg.samples, max_retries=cfg.retries,
                                   include_suspect=True, run_slot=slot)
            return "ok", t, recs, None
        except Exception as e:  # noqa: BLE001
            return "error", t, None, str(e)

    def run_pass(batch: List[Tuple[Dict[str, str], int, str]], label: str) -> None:
        if not batch:
            return
        log.info(f"[{slot}] {label}: {len(batch)} searches, {cfg.workers} workers")
        n = 0
        with ThreadPoolExecutor(max_workers=cfg.workers) as ex, open(run_file, "a", encoding="utf-8") as fh:
            futures = [ex.submit(work, t) for t in batch]
            try:
                for fut in as_completed(futures):
                    status, t, recs, err = fut.result()
                    k = key_of(t)
                    if status == "ok":
                        gov.report(True)
                        for r in recs:
                            fh.write(json.dumps(r, default=str) + "\n")
                        fh.flush()
                        done.add(k)
                        last_errors.pop(k, None)
                        stats["ok" if recs else "empty"] += 1
                        stats["rows"] += len(recs)
                    elif status == "error":
                        gov.report(False)
                        last_errors[k] = err or ""
                        err_low = (err or "").lower()
                        if "rate-limit" in err_low or "captcha" in err_low or "429" in err_low or "sorry" in err_low:
                            gov.report_rate_limit(30)
                        log.warning(f"FAILED {k}: {err}")
                    else:
                        stats["skipped"] += 1
                    n += 1
                    if n % 25 == 0:
                        state.data["current"]["done"] = sorted(done)
                        state.save()
                        lock.touch()
                        log.info(f"[{slot}] progress {len(done)}/{total} done, {stats['rows']} rows")
            except KeyboardInterrupt:
                STOP.set()
                raise
            finally:
                state.data["current"]["done"] = sorted(done)
                state.save()

    try:
        run_pass(pending, "pass 1")
        retry = [t for t in tasks if key_of(t) not in done]
        if retry and not gov.should_stop():
            log.info(f"[{slot}] retrying {len(retry)} failed/missed searches after a short pause")
            time.sleep(min(60, cfg.time_budget_min))
            run_pass(retry, "pass 2 (retry)")
    except KeyboardInterrupt:
        log.warning("Interrupted - progress saved; run again to resume this slot.")
        raise

    remaining = [t for t in tasks if key_of(t) not in done]
    status = "complete" if not remaining else "partial"

    # ---- publish + upload ----
    rows = read_run_rows(run_file)
    updated = publish_website(web_dir, corridors, rows, slot, cfg.expected_corridors)
    state.data["current"].update({"status": status, "finished_at": now_ist().isoformat(), "done": sorted(done)})
    if status == "complete":
        state.data["last_completed_slot"] = slot
        state.data["last_completed_at"] = now_ist().isoformat()

    priced = [r for r in rows if r.get("total_fare") is not None]
    if not cfg.no_upload and priced:
        res = upload_rows(priced)
        if res is False and slot not in state.data["pending_uploads"]:
            state.data["pending_uploads"].append(slot)
            log.warning(f"Upload failed - slot {slot} queued for retry.")
        elif res is True:
            log.info(f"Uploaded {len(priced)} rows.")
    state.save()

    summary = {
        "slot": slot, "status": status, "started_at": started_at, "finished_at": now_ist().isoformat(),
        "searches_total": total, "searches_done": len(done), "searches_missing": len(remaining),
        "rows": len(rows), "corridors_updated": updated, "corridors_configured": len(corridors),
        "cooldowns": gov.cooldowns, "aborted": gov.aborted,
        "sample_errors": dict(list(last_errors.items())[:10]),
        "recent_gaps": state.data["gaps"][-5:],
    }
    atomic_write_json(web_dir / "latest_run.json", summary)
    cleanup_runs(runs_dir, state.data["pending_uploads"], cfg.keep_days)
    log.info(f"[{slot}] {status.upper()}: {len(done)}/{total} searches, {len(rows)} rows, {updated} corridors published")
    return summary


# --------------------------------------------------------------------------------------
# Modes
# --------------------------------------------------------------------------------------
def sleep_until(target: datetime, lock: Lock) -> None:
    while not STOP.is_set():
        remaining = (target - now_ist()).total_seconds()
        if remaining <= 0:
            return
        lock.touch()
        STOP.wait(min(30, remaining))


def run_once(cfg, corridors, state, lock) -> int:
    now = now_ist()
    if state.data["last_completed_slot"] == slot_id(now) and not cfg.force:
        log.info(f"Slot {slot_id(now)} already completed. Use --force to run again.")
        return 0
    state.add_gap(missed_slots(state.data["last_completed_slot"], now))
    retry_pending_uploads(state, Path(cfg.data_dir) / "runs")
    s = run_sweep(cfg, corridors, state, lock, now)
    return 0 if s["status"] == "complete" else 1


def run_daemon(cfg, corridors, state, lock) -> int:
    log.info("Daemon started. One sweep per 3-hour IST slot; Ctrl-C to stop.")
    while not STOP.is_set():
        now = now_ist()
        cur = slot_id(now)
        if state.data["last_completed_slot"] != cur and state.data["last_attempted_slot"] != cur:
            state.add_gap(missed_slots(state.data["last_completed_slot"], now))
            retry_pending_uploads(state, Path(cfg.data_dir) / "runs")
            try:
                run_sweep(cfg, corridors, state, lock, now)
            except KeyboardInterrupt:
                break
            except Exception:  # noqa: BLE001  never let one bad sweep kill the daemon
                log.exception("Sweep crashed; will try again next slot (or on restart it resumes).")
        else:
            retry_pending_uploads(state, Path(cfg.data_dir) / "runs")
        nxt = next_slot_start(now_ist())
        log.info(f"Next slot starts {nxt.strftime('%Y-%m-%d %H:%M IST')}")
        sleep_until(nxt, lock)
    return 0


def setup_logging(data_dir: Path) -> None:
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.INFO)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    root.addHandler(sh)
    (data_dir / "logs").mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(data_dir / "logs" / "runner.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)


def main() -> int:
    ap = argparse.ArgumentParser(description="AirIndex India - all-corridor scraper (T+0..T+30, every 3 hours)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--once", action="store_true", help="one sweep for the current slot, then exit (default)")
    mode.add_argument("--daemon", action="store_true", help="run forever, one sweep per 3-hour slot")
    ap.add_argument("--corridors", default=str(DEFAULT_CORRIDORS), help="corridors.json / .txt / .csv")
    ap.add_argument("--expected-corridors", type=int, default=52)
    ap.add_argument("--strict-count", action="store_true", help="refuse to run unless corridor count == expected")
    ap.add_argument("--days-max", type=int, default=30, help="scrape T+0 .. T+N (default 30)")
    ap.add_argument("--cabin", default="ECONOMY", choices=["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
    ap.add_argument("--workers", type=int, default=2, help="parallel searches (keep low to avoid Google blocks)")
    ap.add_argument("--delay-min", type=float, default=2.0)
    ap.add_argument("--delay-max", type=float, default=4.0)
    ap.add_argument("--samples", type=int, default=1)
    ap.add_argument("--retries", type=int, default=2)
    ap.add_argument("--time-budget-min", type=float, default=165, help="stop a sweep after N minutes (must be < 180)")
    ap.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    ap.add_argument("--web-dir", default=str(DEFAULT_WEB_DIR))
    ap.add_argument("--keep-days", type=int, default=14, help="days of raw run files kept locally")
    ap.add_argument("--limit-corridors", type=int, default=0, help="testing: only the first N corridors")
    ap.add_argument("--no-upload", action="store_true", help="skip Supabase upload")
    ap.add_argument("--force", action="store_true", help="--once: run even if this slot already completed")
    cfg = ap.parse_args()

    data_dir = Path(cfg.data_dir)
    setup_logging(data_dir)
    for sig in (signal.SIGINT, getattr(signal, "SIGTERM", None)):
        if sig is not None:
            try:
                signal.signal(sig, lambda *_: STOP.set())
            except (ValueError, OSError):
                pass

    path = Path(cfg.corridors)
    if not path.exists():
        log.error(f"Corridor file not found: {path}")
        return 2
    corridors = load_corridors(path)
    if cfg.limit_corridors:
        corridors = corridors[:cfg.limit_corridors]
    if not corridors:
        log.error("No valid corridors loaded.")
        return 2
    if len(corridors) != cfg.expected_corridors and not cfg.limit_corridors:
        msg = f"{len(corridors)} corridors loaded but {cfg.expected_corridors} expected - add the missing ones to {path.name}"
        if cfg.strict_count:
            log.error(msg)
            return 2
        log.warning(msg)
    log.info(f"{len(corridors)} corridors x {cfg.days_max + 1} dates = {len(corridors) * (cfg.days_max + 1)} searches per sweep")

    lock = Lock(data_dir / "runner.lock")
    if not lock.acquire():
        log.error("Another runner is active (lock heartbeat < 15 min old). Exiting.")
        return 3
    state = State(data_dir / "state.json")
    try:
        return run_daemon(cfg, corridors, state, lock) if cfg.daemon else run_once(cfg, corridors, state, lock)
    except KeyboardInterrupt:
        return 130
    finally:
        lock.release()


if __name__ == "__main__":
    sys.exit(main())
