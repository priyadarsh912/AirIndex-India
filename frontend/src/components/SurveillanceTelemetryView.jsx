// frontend/src/components/SurveillanceTelemetryView.jsx
import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../App';

export default function SurveillanceTelemetryView() {
  const [telemetryData, setTelemetryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/integrity/audit?severity=${severityFilter}&page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setTelemetryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch surveillance telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [severityFilter, page]);

  const telemetry = telemetryData?.telemetry || {};
  const drifts = telemetryData?.flight_route_drifts || [];
  const quarantinedList = telemetryData?.quarantined_pagination?.records || [];
  const contaminationRate = telemetry.contamination_rate_pct || 0.0;
  const status = telemetry.contamination_status || 'NORMAL';

  return (
    <div className="space-y-6">
      {/* Top Banner / System Telemetry Status */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[24px]">shield_with_heart</span>
              <h2 className="font-headline text-lg font-bold text-text-primary">
                Administrative Surveillance & Anti-Contamination Telemetry
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Real-time audit gateway enforcing Master Flight Registry isolation, Isolation Forest pricing thresholds, and zero cross-pollination.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              status === 'CRITICAL' ? 'bg-red-100 text-red-700 border border-red-200' :
              status === 'WARNING' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
              'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
              Gateway Status: {status}
            </span>
            <button
              onClick={fetchTelemetry}
              className="p-1.5 rounded-lg border border-border-hairline bg-surface-canvas text-text-muted hover:text-text-primary text-xs flex items-center"
              title="Refresh Telemetry"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>

        {/* Core KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-surface-canvas border border-border-hairline">
            <span className="text-xs text-text-muted font-medium">Contamination Rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`font-headline text-2xl font-black ${
                contaminationRate > 7.0 ? 'text-metric-negative' :
                contaminationRate > 3.5 ? 'text-amber-600' : 'text-primary'
              }`}>
                {contaminationRate}%
              </span>
              <span className="text-[11px] text-text-muted">Threshold: &lt;3.5%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${contaminationRate > 7.0 ? 'bg-red-600' : contaminationRate > 3.5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, contaminationRate * 10)}%` }}
              ></div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-canvas border border-border-hairline">
            <span className="text-xs text-text-muted font-medium">Clean Verified Pool</span>
            <div className="font-headline text-2xl font-black text-metric-positive mt-1">
              {(telemetry.clean_records_count || 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-text-muted">Downstream index ingestion</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-canvas border border-border-hairline">
            <span className="text-xs text-text-muted font-medium">Quarantined Records</span>
            <div className="font-headline text-2xl font-black text-metric-negative mt-1">
              {(telemetry.quarantined_records_count || 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-text-muted">Isolated from all public APIs</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-canvas border border-border-hairline">
            <span className="text-xs text-text-muted font-medium">Flight-Route Drifts</span>
            <div className="font-headline text-2xl font-black text-secondary mt-1">
              {telemetry.flight_route_drift_count || 0}
            </div>
            <span className="text-[11px] text-text-muted">Flagged cross-corridor flights</span>
          </div>
        </div>
      </div>

      {/* Flight-Route Drift Surveillance Panel */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border-hairline">
          <div>
            <h3 className="font-headline text-base font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">alt_route</span>
              Flight-Route Drift Monitor (24-Hour Window)
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Detects flights exhibiting multiple distinct (Origin, Destination) pairs. Stops 6E-339 from migrating into unexpected corridors.
            </p>
          </div>
        </div>

        {drifts.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-muted">
            <span className="material-symbols-outlined text-emerald-600 text-[32px]">verified</span>
            <p className="mt-1 font-semibold text-text-primary">No Unscheduled Route Drift Detected</p>
            <p>All monitored flights strictly adhere to their registered corridors.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border-hairline">
            {drifts.map((d, i) => (
              <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold px-2 py-1 bg-surface-canvas border border-border-hairline rounded text-primary">
                    {d.flight_number}
                  </span>
                  <span className="text-text-primary font-medium">
                    Observed on {d.routes_count} distinct corridors:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {d.observed_routes.map(r => (
                      <span
                        key={r}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r === 'HYD-VTZ' && d.flight_number === '6E-339'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-surface-subtle text-text-secondary border border-border-hairline'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold self-start sm:self-auto">
                  Gateway Isolated
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quarantined Records Ledger & Healing Suggestions */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border-hairline">
          <div>
            <h3 className="font-headline text-base font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-metric-negative text-[20px]">block</span>
              Quarantine & Audit Store Ledger
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Excluded records with rejection rationale, ML feature vectors, and self-healing recommendations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Severity:</span>
            {['ALL', 'CRITICAL', 'WARNING'].map(sev => (
              <button
                key={sev}
                onClick={() => { setSeverityFilter(sev); setPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  severityFilter === sev
                    ? 'bg-primary-container text-white shadow-sm'
                    : 'bg-surface-canvas text-text-muted hover:text-text-primary border border-border-hairline'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-xs text-text-muted">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            Loading Quarantine Ledger...
          </div>
        ) : quarantinedList.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted">
            <span className="material-symbols-outlined text-emerald-600 text-[36px]">check_circle</span>
            <p className="mt-1 font-bold text-text-primary">Quarantine Queue Empty</p>
            <p>No records currently flagged under the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-hairline text-text-muted font-semibold bg-surface-canvas">
                  <th className="p-3">Record ID</th>
                  <th className="p-3">Flight / Carrier</th>
                  <th className="p-3">Scraped Route</th>
                  <th className="p-3">Fare / Tax Ratio</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">Rejection Reasons</th>
                  <th className="p-3">Self-Healing Suggestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline">
                {quarantinedList.map((q, idx) => (
                  <tr key={q.id || idx} className="hover:bg-surface-canvas/60 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-text-muted">
                      {q.id || `Q-${idx}`}
                    </td>
                    <td className="p-3 font-semibold text-text-primary">
                      {q.flight_number}
                      <span className="block text-[10px] text-text-muted font-normal">{q.airline}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-metric-negative">
                      {q.route || `${q.origin}-${q.destination}`}
                    </td>
                    <td className="p-3 font-mono">
                      ₹{q.total_fare}
                      <span className="block text-[10px] text-text-muted">
                        Tax: {q.anti_contamination_features?.tax_ratio ? (q.anti_contamination_features.tax_ratio * 100).toFixed(1) : '--'}%
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">
                        {q.confidence_score !== undefined ? q.confidence_score : 30}%
                      </span>
                    </td>
                    <td className="p-3 max-w-xs text-text-muted text-[11px] leading-relaxed">
                      {(q.quarantine_reasons || []).map((r, ri) => (
                        <div key={ri} className="text-red-600 font-medium">
                          • {r}
                        </div>
                      ))}
                    </td>
                    <td className="p-3">
                      {q.self_healing_suggested_route ? (
                        <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                          Re-bind to: {q.self_healing_suggested_route}
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-muted">Manual Review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
