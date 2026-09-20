"""
Unit tests for AirScope Source Compliance and Ethical Governance Layer.
Tests RFC 9309 path evaluation, Terms of Service review gates, rate limiting,
circuit breakers, audit logging, and compliance REST endpoints.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from compliance_registry import registry, SourceComplianceRecord
from compliance_gateway import gateway, ComplianceDecision
from main import app, get_compliance_registry, get_compliance_events, get_compliance_summary, test_path_compliance


class TestSourceCompliance(unittest.TestCase):

    def setUp(self):
        # Ensure clean state
        registry.load_from_disk()

    def test_01_registry_loads_real_sources(self):
        """Verify registry contains domestic carriers and OTAs with authentic domain policies."""
        sources = registry.list_sources()
        self.assertGreaterEqual(len(sources), 5)
        source_ids = [s.source_id for s in sources]
        self.assertIn("MMT", source_ids)
        self.assertIn("6E", source_ids)
        self.assertIn("AI", source_ids)
        self.assertIn("IXI", source_ids)
        self.assertIn("QP", source_ids)

    def test_02_allowed_path_evaluation(self):
        """Verify compliant public search paths pass the gateway."""
        dec = gateway.evaluate_request(
            source_id="MMT",
            url_or_path="/flight/search",
            consume_rate_limit=False
        )
        self.assertTrue(dec.allowed)
        self.assertEqual(dec.final_decision, "ALLOW")
        self.assertEqual(dec.robots_decision, "ALLOWED")

    def test_03_disallowed_path_evaluation(self):
        """Verify paths restricted by robots.txt rules are blocked."""
        dec = gateway.evaluate_request(
            source_id="MMT",
            url_or_path="/api/internal/secrets",
            consume_rate_limit=False
        )
        self.assertFalse(dec.allowed)
        self.assertEqual(dec.final_decision, "BLOCK")
        self.assertEqual(dec.robots_decision, "DISALLOWED")
        self.assertIn("ROBOTS_DISALLOWED", dec.reason)

    def test_04_payment_account_path_blocked(self):
        """Verify checkout/payment paths are strictly blocked."""
        dec = gateway.evaluate_request(
            source_id="IXI",
            url_or_path="/booking/pay/session",
            consume_rate_limit=False
        )
        self.assertFalse(dec.allowed)
        self.assertEqual(dec.final_decision, "BLOCK")
        self.assertIn("ROBOTS_DISALLOWED", dec.reason)

    def test_05_restricted_source_blocked(self):
        """Verify sources marked as RESTRICTED (e.g. SpiceJet SG) are halted."""
        dec = gateway.evaluate_request(
            source_id="SG",
            url_or_path="/flight-search",
            consume_rate_limit=False
        )
        self.assertFalse(dec.allowed)
        self.assertEqual(dec.final_decision, "BLOCK")
        self.assertTrue("RESTRICTED" in dec.reason)

    def test_06_unregistered_domain_failsafe(self):
        """Verify conservative government fail-safe halts unknown domains."""
        dec = gateway.evaluate_request(
            source_id="UNKNOWN_AIRLINE",
            url_or_path="https://random-sketchy-flights.com/fares",
            consume_rate_limit=False
        )
        self.assertFalse(dec.allowed)
        self.assertEqual(dec.final_decision, "BLOCK")
        self.assertIn("UNKNOWN_SOURCE_POLICY_UNRESOLVED", dec.reason)

    def test_07_rate_limiter_cooldown(self):
        """Verify cooldown seconds are enforced between rapid consecutive requests."""
        # Request 1: should consume token
        dec1 = gateway.evaluate_request(source_id="6E", url_or_path="/flight-search", consume_rate_limit=True)
        self.assertTrue(dec1.allowed)

        # Immediate Request 2: should be blocked by cooldown
        dec2 = gateway.evaluate_request(source_id="6E", url_or_path="/flight-search", consume_rate_limit=True)
        self.assertFalse(dec2.allowed)
        self.assertIn("RATE_LIMIT_COOLDOWN", dec2.reason)
        self.assertIsNotNone(dec2.retry_after_seconds)

    def test_08_circuit_breaker_trips_on_429(self):
        """Verify receiving 429 / CAPTCHA trips circuit breaker and pauses source."""
        src_id = "AI"
        src = registry.get_source(src_id)
        original_state = src.circuit_breaker_state

        try:
            # Simulate receiving 429 Too Many Requests
            gateway.record_outcome(source_id=src_id, status_code=429, is_captcha=True, error_message="Challenge")
            src_updated = registry.get_source(src_id)
            self.assertEqual(src_updated.circuit_breaker_state, "OPEN")
            self.assertEqual(src_updated.collection_status, "RESTRICTED")

            # Subsequent request should be halted by circuit breaker
            dec = gateway.evaluate_request(source_id=src_id, url_or_path="/search", consume_rate_limit=False)
            self.assertFalse(dec.allowed)
            self.assertIn("CIRCUIT_BREAKER_OPEN", dec.reason)
        finally:
            # Restore
            registry.update_circuit_breaker(src_id, "CLOSED", 0)
            registry.update_source_status(src_id, "ACTIVE", "Restored after test")

    def test_09_audit_logging(self):
        """Verify every decision generates an immutable compliance event."""
        initial_events = len(gateway.events_log)
        gateway.evaluate_request(source_id="MMT", url_or_path="/flights/test-audit", consume_rate_limit=False)
        self.assertEqual(len(gateway.events_log), initial_events + 1)
        latest = gateway.events_log[-1]
        self.assertEqual(latest["source_id"], "MMT")
        self.assertIn("event_id", latest)
        self.assertIn("timestamp", latest)

    def test_10_api_endpoints(self):
        """Verify REST API handlers return structured compliance data."""
        # Registry endpoint
        reg_res = get_compliance_registry()
        self.assertEqual(reg_res["status"], "SUCCESS")
        self.assertGreaterEqual(reg_res["total_sources"], 5)

        # Summary endpoint
        summary = get_compliance_summary()
        self.assertIn("compliance_pass_rate_pct", summary)
        self.assertIn("total_monitored_sources", summary)

        # Path checker endpoint
        chk_res = test_path_compliance({"source_id": "MMT", "url_or_path": "/flight/search"})
        self.assertEqual(chk_res["status"], "SUCCESS")
        self.assertTrue(chk_res["evaluation"]["allowed"])

        # Disallowed path test via API
        chk_blocked = test_path_compliance({"source_id": "MMT", "url_or_path": "/account/private"})
        self.assertFalse(chk_blocked["evaluation"]["allowed"])


if __name__ == "__main__":
    unittest.main()
