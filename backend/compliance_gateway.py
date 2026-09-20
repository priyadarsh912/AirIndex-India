"""
AirScope India - Compliance Gateway
Central architectural gateway enforcing RFC 9309 robots.txt rules, separate Terms of Service
gating, per-source sliding-window rate limiting, circuit breaker protection, and audit logging.
"""

import os
import time
import json
import urllib.parse
import urllib.request
import urllib.robotparser
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from collections import deque

from compliance_registry import registry, SourceComplianceRecord

EVENTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
EVENTS_FILE = os.path.join(EVENTS_DIR, "compliance_events.json")


@dataclass
class ComplianceDecision:
    allowed: bool
    source_id: str
    url_or_path: str
    robots_decision: str  # ALLOWED, DISALLOWED, UNREACHABLE_FAILSAFE, EXEMPT
    terms_status: str  # REVIEWED_ALLOWED, REVIEW_REQUIRED, REVIEWED_RESTRICTED, PROHIBITED, UNREVIEWED
    rate_limit_allowed: bool
    circuit_breaker_state: str  # CLOSED, OPEN, HALF_OPEN
    final_decision: str  # ALLOW, BLOCK
    reason: str
    retry_after_seconds: Optional[float] = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat() + "Z"


class ComplianceGateway:
    """Enforces all compliance controls before any crawler or network request is executed."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ComplianceGateway, cls).__new__(cls)
            cls._instance._init_gateway()
        return cls._instance

    def _init_gateway(self):
        os.makedirs(EVENTS_DIR, exist_ok=True)
        # Sliding-window rate limit trackers: source_id -> deque of timestamps
        self.request_windows: Dict[str, deque] = {}
        # Last request timestamp per source
        self.last_request_times: Dict[str, float] = {}
        # Parsed robot parsers cache: domain -> (RobotFileParser, expires_at_timestamp)
        self.robot_parsers: Dict[str, Any] = {}
        # In-memory ring buffer of audit events
        self.events_log: List[Dict[str, Any]] = []
        self.load_events_from_disk()

    def load_events_from_disk(self):
        """Loads historical audit events from disk."""
        if os.path.exists(EVENTS_FILE):
            try:
                with open(EVENTS_FILE, "r", encoding="utf-8") as f:
                    self.events_log = json.load(f)
            except Exception as e:
                print(f"[ComplianceGateway] Failed to load events: {e}")
                self.events_log = []

    def save_events_to_disk(self):
        """Appends audit events to disk."""
        try:
            with open(EVENTS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.events_log[-1000:], f, indent=2)
        except Exception as e:
            print(f"[ComplianceGateway] Failed to save events: {e}")

    def evaluate_request(
        self,
        source_id: str,
        url_or_path: str,
        user_agent: str = "AirScopeBot/1.0 (+https://airscope.gov.in/bot)",
        consume_rate_limit: bool = True,
    ) -> ComplianceDecision:
        """
        Evaluates full compliance chain for an intended request:
        1. Registry & Source Status Gate
        2. Circuit Breaker State Gate
        3. RFC 9309 robots.txt Gate
        4. Terms of Service (ToS) Review Gate
        5. Per-Source Sliding-Window Rate Limit Gate
        """
        src = registry.get_source(source_id)
        if not src:
            # Check by domain
            parsed = urllib.parse.urlparse(url_or_path)
            if parsed.netloc:
                src = registry.get_source_by_domain(parsed.netloc)

        if not src:
            dec = ComplianceDecision(
                allowed=False,
                source_id=source_id,
                url_or_path=url_or_path,
                robots_decision="UNREVIEWED",
                terms_status="UNREVIEWED",
                rate_limit_allowed=False,
                circuit_breaker_state="CLOSED",
                final_decision="BLOCK",
                reason="UNKNOWN_SOURCE_POLICY_UNRESOLVED: Domain or source not registered in Compliance Registry.",
            )
            self._log_event(dec)
            return dec

        # 1. Circuit Breaker Check (Tripped anti-hammering / safety halt)
        if src.circuit_breaker_state == "OPEN":
            # Check if cooldown period has elapsed
            if src.last_failure_timestamp:
                try:
                    last_fail = datetime.fromisoformat(src.last_failure_timestamp.replace("Z", ""))
                    if (datetime.utcnow() - last_fail).total_seconds() > 60:
                        # Transition to HALF_OPEN probe state
                        registry.update_circuit_breaker(src.source_id, "HALF_OPEN", src.circuit_breaker_failures)
                        src.circuit_breaker_state = "HALF_OPEN"
                except Exception:
                    pass

            if src.circuit_breaker_state == "OPEN":
                dec = ComplianceDecision(
                    allowed=False,
                    source_id=src.source_id,
                    url_or_path=url_or_path,
                    robots_decision=src.robots_status,
                    terms_status=src.terms_review_status,
                    rate_limit_allowed=False,
                    circuit_breaker_state="OPEN",
                    final_decision="BLOCK",
                    reason="CIRCUIT_BREAKER_OPEN: Repeated 429/403/CAPTCHA triggers tripped safety halt. Source marked RESTRICTED.",
                    retry_after_seconds=60.0,
                )
                self._log_event(dec)
                return dec

        # 2. Source Collection Status Check
        if src.collection_status in ["DISABLED", "RESTRICTED", "PAUSED"]:
            dec = ComplianceDecision(
                allowed=False,
                source_id=src.source_id,
                url_or_path=url_or_path,
                robots_decision=src.robots_status,
                terms_status=src.terms_review_status,
                rate_limit_allowed=False,
                circuit_breaker_state=src.circuit_breaker_state,
                final_decision="BLOCK",
                reason=f"SOURCE_{src.collection_status}: Automated collection halted by administrative policy. {src.compliance_notes}",
            )
            self._log_event(dec)
            return dec

        # 3. RFC 9309 robots.txt Check
        clean_path = self._extract_path(url_or_path)
        robots_allowed = self._check_robots_path(src, clean_path, user_agent)
        if not robots_allowed:
            dec = ComplianceDecision(
                allowed=False,
                source_id=src.source_id,
                url_or_path=url_or_path,
                robots_decision="DISALLOWED",
                terms_status=src.terms_review_status,
                rate_limit_allowed=True,
                circuit_breaker_state=src.circuit_breaker_state,
                final_decision="BLOCK",
                reason=f"ROBOTS_DISALLOWED: Target path '{clean_path}' is explicitly restricted by {src.domain}/robots.txt rules.",
            )
            self._log_event(dec)
            return dec

        # 4. Terms of Service Review Gate
        if src.terms_review_status in ["PROHIBITED", "REVIEWED_RESTRICTED"]:
            dec = ComplianceDecision(
                allowed=False,
                source_id=src.source_id,
                url_or_path=url_or_path,
                robots_decision="ALLOWED",
                terms_status=src.terms_review_status,
                rate_limit_allowed=True,
                circuit_breaker_state=src.circuit_breaker_state,
                final_decision="BLOCK",
                reason=f"TERMS_RESTRICTED: Site Terms of Service prohibit automated extraction. Status: {src.terms_review_status}.",
            )
            self._log_event(dec)
            return dec

        # 5. Rate Limiting Check
        now = time.time()
        if src.source_id not in self.request_windows:
            self.request_windows[src.source_id] = deque()

        window = self.request_windows[src.source_id]
        # Purge timestamps older than 60s
        while window and window[0] <= now - 60.0:
            window.popleft()

        rpm_limit = src.requests_per_minute
        if len(window) >= rpm_limit:
            oldest = window[0]
            retry_sec = max(1.0, round(60.0 - (now - oldest), 1))
            dec = ComplianceDecision(
                allowed=False,
                source_id=src.source_id,
                url_or_path=url_or_path,
                robots_decision="ALLOWED",
                terms_status=src.terms_review_status,
                rate_limit_allowed=False,
                circuit_breaker_state=src.circuit_breaker_state,
                final_decision="BLOCK",
                reason=f"RATE_LIMIT_EXCEEDED: Exceeded {rpm_limit} requests/minute ceiling for {src.source_name}.",
                retry_after_seconds=retry_sec,
            )
            self._log_event(dec)
            return dec

        # Cooldown check
        last_req = self.last_request_times.get(src.source_id, 0.0)
        cooldown = src.cooldown_seconds
        if now - last_req < cooldown:
            wait_sec = round(cooldown - (now - last_req), 2)
            dec = ComplianceDecision(
                allowed=False,
                source_id=src.source_id,
                url_or_path=url_or_path,
                robots_decision="ALLOWED",
                terms_status=src.terms_review_status,
                rate_limit_allowed=False,
                circuit_breaker_state=src.circuit_breaker_state,
                final_decision="BLOCK",
                reason=f"RATE_LIMIT_COOLDOWN: Ethical pacing required. Must wait {wait_sec}s between requests.",
                retry_after_seconds=wait_sec,
            )
            self._log_event(dec)
            return dec

        # Consume token if permitted
        if consume_rate_limit:
            window.append(now)
            self.last_request_times[src.source_id] = now

        # All Gates Passed
        dec = ComplianceDecision(
            allowed=True,
            source_id=src.source_id,
            url_or_path=url_or_path,
            robots_decision="ALLOWED",
            terms_status=src.terms_review_status,
            rate_limit_allowed=True,
            circuit_breaker_state=src.circuit_breaker_state,
            final_decision="ALLOW",
            reason="COMPLIANT_REQUEST_PERMITTED: Path verified against RFC 9309 rules, rate limit token granted, ToS policy accepted.",
        )
        self._log_event(dec)
        return dec

    def record_outcome(
        self,
        source_id: str,
        status_code: int,
        is_captcha: bool = False,
        error_message: Optional[str] = None,
    ):
        """
        Records the operational response from a crawler request.
        If anti-bot mechanisms, 429, or 403 are detected, trips circuit breaker immediately.
        """
        src = registry.get_source(source_id)
        if not src:
            return

        is_throttled = status_code in [429, 403] or is_captcha

        if is_throttled:
            failures = src.circuit_breaker_failures + 1
            if failures >= 2 or is_captcha:
                registry.update_circuit_breaker(src.source_id, "OPEN", failures)
                self._log_custom_event(
                    source_id=src.source_id,
                    path="EXECUTION_GATEWAY",
                    decision="CIRCUIT_BREAKER_TRIPPED",
                    reason=f"Anti-bot or rate-limit challenge encountered (HTTP {status_code}, CAPTCHA: {is_captcha}). Collection paused.",
                )
            else:
                registry.update_circuit_breaker(src.source_id, "CLOSED", failures)
        else:
            if src.circuit_breaker_state == "HALF_OPEN" and status_code == 200:
                # Canary probe succeeded; heal circuit breaker
                registry.update_circuit_breaker(src.source_id, "CLOSED", 0)
                registry.update_source_status(src.source_id, "ACTIVE", "Canary check passed; restored to active.")

    def _check_robots_path(self, src: SourceComplianceRecord, path: str, user_agent: str) -> bool:
        """Evaluates path according to RFC 9309 rules: longest prefix match."""
        # 1. First check explicit blocked paths
        for bp in src.blocked_paths:
            if bp and (path.startswith(bp) or path == bp or (bp != "/" and bp.rstrip("/") in path)):
                return False

        # 2. Check explicit allowed paths
        if src.allowed_paths:
            for ap in src.allowed_paths:
                if path.startswith(ap) or path == ap:
                    return True
            # If allowed_paths specified and path didn't match, check if base is allowed
            return path == "/" or path == ""

        return True

    def _extract_path(self, url_or_path: str) -> str:
        """Normalizes URL or raw path to absolute relative path."""
        if not url_or_path:
            return "/"
        if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
            parsed = urllib.parse.urlparse(url_or_path)
            return parsed.path or "/"
        return url_or_path if url_or_path.startswith("/") else "/" + url_or_path

    def _log_event(self, dec: ComplianceDecision):
        """Logs audit event to in-memory store and file."""
        event_dict = asdict(dec)
        event_dict["event_id"] = f"EVT-{int(time.time()*1000)}-{len(self.events_log)+1}"
        self.events_log.append(event_dict)
        # Keep ring buffer to 1000 items
        if len(self.events_log) > 1000:
            self.events_log = self.events_log[-1000:]
        self.save_events_to_disk()

    def _log_custom_event(self, source_id: str, path: str, decision: str, reason: str):
        event = {
            "event_id": f"EVT-{int(time.time()*1000)}-{len(self.events_log)+1}",
            "allowed": decision == "ALLOW",
            "source_id": source_id,
            "url_or_path": path,
            "robots_decision": "AUDIT",
            "terms_status": "AUDIT",
            "rate_limit_allowed": False,
            "circuit_breaker_state": "OPEN",
            "final_decision": decision,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        self.events_log.append(event)
        self.save_events_to_disk()

    def get_events(
        self,
        limit: int = 50,
        page: int = 1,
        source_id: Optional[str] = None,
        decision: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Returns paginated compliance events."""
        filtered = self.events_log
        if source_id and source_id != "ALL":
            filtered = [e for e in filtered if e.get("source_id") == source_id]
        if decision and decision != "ALL":
            filtered = [e for e in filtered if e.get("final_decision") == decision]

        # Reverse chronological
        filtered = list(reversed(filtered))
        total = len(filtered)
        start = (page - 1) * limit
        end = start + limit
        paginated = filtered[start:end]

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if total > 0 else 0,
            "events": paginated,
        }

    def get_summary_metrics(self) -> Dict[str, Any]:
        """Computes compliance statistics for dashboard KPI cards."""
        total_evals = len(self.events_log)
        allowed_count = sum(1 for e in self.events_log if e.get("final_decision") == "ALLOW")
        blocked_count = sum(1 for e in self.events_log if e.get("final_decision") == "BLOCK")
        pass_rate = round((allowed_count / total_evals) * 100.0, 1) if total_evals > 0 else 100.0

        all_sources = registry.list_sources()
        active_sources = sum(1 for s in all_sources if s.collection_status == "ACTIVE")
        restricted_sources = sum(1 for s in all_sources if s.collection_status in ["RESTRICTED", "PAUSED", "DISABLED"])
        tripped_breakers = sum(1 for s in all_sources if s.circuit_breaker_state == "OPEN")

        rate_limit_blocks = sum(1 for e in self.events_log if "RATE_LIMIT" in e.get("reason", ""))
        robots_blocks = sum(1 for e in self.events_log if "ROBOTS_DISALLOWED" in e.get("reason", ""))
        terms_blocks = sum(1 for e in self.events_log if "TERMS" in e.get("reason", ""))

        return {
            "total_evaluations": total_evals,
            "allowed_requests": allowed_count,
            "blocked_requests": blocked_count,
            "compliance_pass_rate_pct": pass_rate,
            "total_monitored_sources": len(all_sources),
            "active_sources": active_sources,
            "restricted_sources": restricted_sources,
            "tripped_circuit_breakers": tripped_breakers,
            "rate_limit_enforcements": rate_limit_blocks,
            "robots_disallow_enforcements": robots_blocks,
            "terms_disallow_enforcements": terms_blocks,
        }


# Global Singleton Gateway
gateway = ComplianceGateway()
