import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, TrendingUp, TrendingDown, Info, Activity, Database,
  Search, Eye, Zap
} from 'lucide-react';
import { API_BASE_URL } from '../config';

/**
 * DataIntegrityView – AI/ML Integrity Engine Monitor
 * Displays real-time data integrity metrics, misattributed flight corrections,
 * carrier prefix mismatches, fare arithmetic fixes, and price contamination alerts.
 */
export default function DataIntegrityView({ observations = [] }) {
  const [integrityData, setIntegrityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIssueType, setSelectedIssueType] = useState('ALL');
  const [search, setSearch] = useState('');

  // Compute local integrity metrics from the observations prop
  const localMetrics = React.useMemo(() => {
    if (!observations || observations.length === 0) return null;

    const total = observations.length;
    const verified = observations.filter(o => o.integrity_status === 'VERIFIED').length;
    const corrected = observations.filter(o => o.integrity_status === 'CORRECTED').length;
    const misattributed = observations.filter(o => o.integrity_status === 'MISATTRIBUTED').length;
    const carrierMismatch = observations.filter(o => o.integrity_status === 'CARRIER_MISMATCH').length;
    const autoCorrected = observations.filter(o => o.registry_validation === 'AUTO_CORRECTED').length;
    const unverified = observations.filter(o => o.registry_validation === 'UNVERIFIED').length;
    const priceAnomalies = observations.filter(o => o.is_price_anomaly === true).length;
    const quarantined = observations.filter(o => o.integrity_quarantined === true).length;
    const integrityPct = total > 0 ? ((total - misattributed - carrierMismatch) / total * 100).toFixed(1) : '100.0';

    // Routes with most issues
    const issuesByRoute = {};
    observations.forEach(o => {
      if (o.integrity_issues && o.integrity_issues.length > 0) {
        if (!issuesByRoute[o.route]) issuesByRoute[o.route] = 0;
        issuesByRoute[o.route] += o.integrity_issues.length;
      }
    });
    const routeIssueRanking = Object.entries(issuesByRoute)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    // Issue records for table
    const issueRecords = observations.filter(o =>
      o.integrity_issues && o.integrity_issues.length > 0
    ).map(o => ({
      id: o.id,
      route: o.route,
      airline: o.airline,
      flight_before: o.flight_number_original || o.flight_number,
      flight_after: o.flight_number,
      was_corrected: !!o.flight_number_original,
      integrity_status: o.integrity_status,
      registry_validation: o.registry_validation,
      issues: o.integrity_issues || [],
      total_fare: o.total_fare,
      booking_window: o.booking_window,
    }));

    return {
      total, verified, corrected, misattributed, carrierMismatch,
      autoCorrected, unverified, priceAnomalies, quarantined,
      integrityPct, routeIssueRanking, issueRecords
    };
  }, [observations]);

  const fetchFromAPI = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrity`);
      if (res.ok) {
        const data = await res.json();
        setIntegrityData(data);
      }
    } catch (e) {
      // API unavailable – rely on local metrics
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFromAPI();
  }, []);

  const metrics = localMetrics;
  const integrityPct = metrics ? parseFloat(metrics.integrityPct) : 100;
  const isHealthy = integrityPct >= 90;
  const isWarning = integrityPct >= 75 && integrityPct < 90;
  const isCritical = integrityPct < 75;

  const statusColor = isHealthy
    ? 'text-emerald-400 border-emerald-500'
    : isWarning
      ? 'text-amber-400 border-amber-500'
      : 'text-red-400 border-red-500';

  const statusBg = isHealthy
    ? 'bg-emerald-500/10 border-emerald-500/30'
    : isWarning
      ? 'bg-amber-500/10 border-amber-500/30'
      : 'bg-red-500/10 border-red-500/30';

  const ISSUE_TYPES = ['ALL', 'SYNTHETIC_REPLACED', 'CARRIER_MISMATCH', 'PRICE_ANOMALY', 'FARE_ARITHMETIC'];

  const filteredIssues = (metrics?.issueRecords || []).filter(rec => {
    const matchesSearch = !search ||
      rec.route.toLowerCase().includes(search.toLowerCase()) ||
      rec.airline.toLowerCase().includes(search.toLowerCase()) ||
      rec.flight_before.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedIssueType === 'ALL' ||
      (selectedIssueType === 'SYNTHETIC_REPLACED' && rec.registry_validation === 'AUTO_CORRECTED') ||
      (selectedIssueType === 'CARRIER_MISMATCH' && rec.integrity_status === 'CARRIER_MISMATCH') ||
      (selectedIssueType === 'PRICE_ANOMALY' && rec.issues.some(i => i.includes('PRICE_OUT_OF_BOUNDS'))) ||
      (selectedIssueType === 'FARE_ARITHMETIC' && rec.issues.some(i => i.includes('FARE_ARITHMETIC')));
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`gov-card p-6 rounded-2xl border-l-4 relative overflow-hidden ${isHealthy ? 'border-l-emerald-500' : isWarning ? 'border-l-amber-500' : 'border-l-red-500'}`}>
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <ShieldCheck className={`w-6 h-6 ${isHealthy ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-red-400'}`} />
              <h2 className="text-lg font-bold text-white">National Data Integrity & Validation Audit Center</h2>
              <span className={`px-3 py-1 text-xs font-bold rounded-full border font-mono ${statusBg} ${statusColor}`}>
                {integrityPct}% SYSTEM INTEGRITY
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Multi-layer cryptographic validation pipeline: Master Flight Registry cross-check (60+ real flights), carrier prefix validation,
              fare arithmetic correction, IQR price-range bounds, and cross-route contamination detection.
              Synthetic sequential flight numbers are auto-replaced with verified registry entries.
            </p>
          </div>
          <button
            onClick={fetchFromAPI}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400 text-xs font-bold hover:bg-blue-600/30 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <MetricCard
            icon={<Database className="w-5 h-5 text-blue-400" />}
            label="Total Observations"
            value={metrics.total.toLocaleString()}
            sub="in integrity scan"
            color="blue"
          />
          <MetricCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            label="Clean & Verified"
            value={metrics.verified.toLocaleString()}
            sub={`${((metrics.verified / metrics.total) * 100).toFixed(0)}% of total`}
            color="emerald"
          />
          <MetricCard
            icon={<Zap className="w-5 h-5 text-purple-400" />}
            label="Auto-Corrected"
            value={metrics.autoCorrected.toLocaleString()}
            sub="synthetic flights replaced"
            color="purple"
          />
          <MetricCard
            icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
            label="Price Anomalies"
            value={metrics.priceAnomalies.toLocaleString()}
            sub="out-of-range fares"
            color="amber"
          />
          <MetricCard
            icon={<XCircle className="w-5 h-5 text-red-400" />}
            label="Quarantined"
            value={metrics.quarantined.toLocaleString()}
            sub="excluded from index"
            color="red"
          />
        </div>
      )}

      {/* Issue Type Breakdown Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Detection Categories */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Detection Category Breakdown</span>
            </h3>
            <div className="space-y-3">
              <IssueBar
                label="Synthetic Flight Numbers Replaced"
                count={metrics.autoCorrected}
                total={metrics.total}
                color="purple"
                icon="🔄"
                description="Sequential fake flight IDs (e.g. 6E-336) replaced with real registry entries (e.g. 6E-7325)"
              />
              <IssueBar
                label="Carrier Prefix Mismatches"
                count={metrics.carrierMismatch}
                total={metrics.total}
                color="orange"
                icon="⚠️"
                description="Flight number prefix doesn't match the associated airline (e.g. IXI-869 tagged as Air India)"
              />
              <IssueBar
                label="Price Anomalies (IQR)"
                count={metrics.priceAnomalies}
                total={metrics.total}
                color="amber"
                icon="📊"
                description="Fares outside route-specific expected price bounds [min, max]"
              />
              <IssueBar
                label="Misattributed Routes"
                count={metrics.misattributed}
                total={metrics.total}
                color="red"
                icon="🚨"
                description="Flight confirmed on a different route in master registry"
              />
              <IssueBar
                label="Unverified (Not in Registry)"
                count={metrics.unverified}
                total={metrics.total}
                color="slate"
                icon="❓"
                description="Flights not in registry — may be valid newer flights not yet catalogued"
              />
            </div>
          </div>

          {/* Route Issue Ranking */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              <span>Routes with Most Issues</span>
            </h3>
            {metrics.routeIssueRanking.length === 0 ? (
              <div className="text-center py-8 text-emerald-400 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                <p className="font-bold">No route-level issues detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metrics.routeIssueRanking.map(([route, count], idx) => {
                  const maxCount = metrics.routeIssueRanking[0][1];
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={route} className="flex items-center space-x-3">
                      <span className="text-xs font-mono text-slate-400 w-4">{idx + 1}.</span>
                      <span className="text-xs font-bold text-white font-mono w-20 shrink-0">{route}</span>
                      <div className="flex-1 bg-navy-900 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-amber-400 font-bold w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Integrity Score Gauge */}
            <div className={`mt-5 p-4 rounded-xl border ${statusBg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300">Overall Data Integrity Score</span>
                <span className={`text-xl font-extrabold font-mono ${statusColor}`}>{integrityPct}%</span>
              </div>
              <div className="w-full bg-navy-900 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isHealthy ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                    isWarning ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                    'bg-gradient-to-r from-red-600 to-red-400'
                  }`}
                  style={{ width: `${integrityPct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                {integrityPct >= 90
                  ? 'HIGH — Data is clean and well-attributed. Index calculations are reliable.'
                  : integrityPct >= 75
                    ? 'MODERATE — Some auto-corrections applied. Index calculations use corrected data.'
                    : 'NEEDS ATTENTION — Significant corrections applied. Review quarantined records.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Issues Table */}
      <div className="glass-card p-6 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-navy-800">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Detected & Corrected Issues Log ({filteredIssues.length} records)</span>
          </h3>
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search route, airline, flight..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-navy-900 border border-navy-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
              />
            </div>
            {/* Filter */}
            <select
              value={selectedIssueType}
              onChange={e => setSelectedIssueType(e.target.value)}
              className="px-3 py-1.5 bg-navy-900 border border-navy-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {ISSUE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-emerald-400 font-bold">No issues match current filter</p>
            <p className="text-slate-500 text-xs mt-1">All observations in this category are clean</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-navy-950 border-b border-navy-800 text-slate-400 text-[10px] uppercase tracking-wide">
                  <th className="p-3">Route</th>
                  <th className="p-3">Airline</th>
                  <th className="p-3">Flight (Before)</th>
                  <th className="p-3">Flight (After)</th>
                  <th className="p-3">Window</th>
                  <th className="p-3">Fare</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Issue Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {filteredIssues.slice(0, 100).map((rec, idx) => {
                  const statusColor = rec.integrity_status === 'VERIFIED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : rec.integrity_status === 'CORRECTED' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    : rec.integrity_status === 'CARRIER_MISMATCH' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-red-400 bg-red-500/10 border-red-500/20';

                  const isCorrectedFlight = rec.was_corrected;
                  const issueLabel = rec.registry_validation === 'AUTO_CORRECTED'
                    ? 'Synthetic Replaced'
                    : rec.integrity_status === 'CARRIER_MISMATCH'
                      ? 'Carrier Mismatch'
                      : rec.issues.some(i => i.includes('PRICE_OUT_OF_BOUNDS'))
                        ? 'Price Anomaly'
                        : rec.issues.some(i => i.includes('FARE_ARITHMETIC'))
                          ? 'Fare Arithmetic'
                          : 'Other';

                  return (
                    <tr key={idx} className="hover:bg-navy-850/50 transition-colors">
                      <td className="p-3 font-bold text-white">{rec.route}</td>
                      <td className="p-3 text-slate-300 font-sans text-xs">{rec.airline}</td>
                      <td className="p-3">
                        <span className={`${isCorrectedFlight ? 'line-through text-red-400/70' : 'text-slate-400'}`}>
                          {rec.flight_before}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`font-bold ${isCorrectedFlight ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {rec.flight_after}
                          {isCorrectedFlight && <span className="ml-1 text-[9px] text-emerald-500">✓ CORRECTED</span>}
                        </span>
                      </td>
                      <td className="p-3 text-amber-400">{rec.booking_window}</td>
                      <td className="p-3 text-white">₹{rec.total_fare?.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusColor}`}>
                          {rec.integrity_status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          issueLabel === 'Synthetic Replaced' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                          issueLabel === 'Carrier Mismatch' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                          issueLabel === 'Price Anomaly' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                          'text-slate-400 bg-slate-500/10 border-slate-500/20'
                        }`}>
                          {issueLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredIssues.length > 100 && (
              <p className="text-center text-slate-500 text-xs mt-3 py-2 border-t border-navy-800">
                Showing first 100 of {filteredIssues.length} issues. Use filters to narrow down.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Engine Methodology Note */}
      <div className="glass-card p-5 rounded-2xl border border-blue-500/20">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span>Integrity Engine Methodology</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
          <div>
            <p className="font-bold text-white mb-1">Rule-Based Checks</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Master Flight Registry cross-validation (60+ real DGCA-published flight-route bindings)</li>
              <li>Carrier IATA prefix validation (6E=IndiGo, AI=Air India, IX=Air India Express, QP=Akasa)</li>
              <li>Fare component arithmetic: base_fare + taxes + fees = total_fare (±6 INR tolerance)</li>
              <li>Origin ≠ Destination check, status field sanity</li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-white mb-1">Statistical Checks</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Route-specific IQR price bounds (per booking window and corridor segment)</li>
              <li>Cross-route price contamination via median deviation (&gt;60% = warning)</li>
              <li>Sequential flight number heuristic (IDs with 'SCRAPED' tag = synthetic)</li>
              <li>Quality score adjusted based on integrity status (quarantined = excluded from APIx)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color }) {
  const colorMap = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    red: 'border-red-500/30 bg-red-500/5',
  };
  return (
    <div className={`glass-card p-4 rounded-xl border ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center space-x-2 mb-2">
        {icon}
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-white font-mono tracking-tight">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function IssueBar({ label, count, total, color, icon, description }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const colorBar = {
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    slate: 'bg-slate-600',
  };
  const colorText = {
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <span className="text-sm">{icon}</span>
          <span className="text-xs text-slate-300">{label}</span>
        </div>
        <span className={`text-xs font-bold font-mono ${colorText[color]}`}>{count.toLocaleString()}</span>
      </div>
      <div className="w-full bg-navy-900 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorBar[color]}`}
          style={{ width: `${Math.min(pct * 3, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}
