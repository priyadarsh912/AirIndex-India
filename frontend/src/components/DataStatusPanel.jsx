import React, { useState, useEffect } from 'react';

export default function DataStatusPanel({ onCollectionSuccess }) {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/data-status');
      if (res.ok) {
        const json = await res.json();
        setStatusData(json);
      }
    } catch (err) {
      console.warn('Could not load /api/data-status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerCollect = async (forceFixture = false) => {
    setCollecting(true);
    setCollectMsg(null);
    try {
      const res = await fetch(`/api/collector/run?max_searches=5&force_fixture=${forceFixture}`, {
        method: 'POST',
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        const rawText = await res.text().catch(() => '');
        data = { detail: rawText || `Server responded with status ${res.status}` };
      }

      if (res.ok) {
        setCollectMsg({
          type: 'success',
          text: `Collected ${data.rows_written} quotes (${data.searches_used} searches used) via ${data.provider}.`,
        });
        fetchStatus();
        if (onCollectionSuccess) onCollectionSuccess();
      } else {
        setCollectMsg({ type: 'error', text: data.detail || 'Collection failed.' });
      }
    } catch (err) {
      setCollectMsg({ type: 'error', text: err.message || 'Network request failed' });
    } finally {
      setCollecting(false);
    }
  };

  if (loading && !statusData) {
    return (
      <div className="bg-surface-card rounded-xl p-5 border border-border-hairline shadow-sm mb-6 animate-pulse">
        <div className="h-4 bg-surface-subtle rounded w-1/4 mb-3"></div>
        <div className="h-10 bg-surface-subtle rounded mb-2"></div>
      </div>
    );
  }

  const sources = statusData?.source_counts || {};
  const feeBasis = statusData?.fee_basis_counts || {};
  const budgetTotal = statusData?.monthly_search_budget || 250;
  const budgetUsed = statusData?.searches_used_this_month || 0;
  const budgetRemain = statusData?.budget_remaining || (budgetTotal - budgetUsed);
  const budgetPct = Math.min(100, Math.round((budgetUsed / budgetTotal) * 100));

  return (
    <div className="bg-surface-card rounded-xl p-5 border border-border-hairline shadow-sm mb-6 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-hairline">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-primary text-[22px]">database</span>
          <div>
            <h3 className="font-headline text-sm font-bold text-text-primary flex items-center gap-2">
              Persistent Observation Ledger & Telemetry
              {statusData?.is_provisional ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  PROVISIONAL ({statusData?.live_days_collected || 0}/30 Live Days)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                  PRODUCTION READY
                </span>
              )}
            </h3>
            <p className="text-[11px] text-text-muted">
              Real-time airfare ingestion, idempotent upsert ledger, and budget governance
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTriggerCollect(false)}
            disabled={collecting || budgetRemain <= 0}
            className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Execute scheduled collection run"
          >
            <span className={`material-symbols-outlined text-[16px] ${collecting ? 'animate-spin' : ''}`}>
              {collecting ? 'progress_activity' : 'cloud_download'}
            </span>
            <span>{collecting ? 'Collecting...' : 'Run Collector (5 Routes)'}</span>
          </button>

          <button
            onClick={() => handleTriggerCollect(true)}
            disabled={collecting}
            className="px-2.5 py-1.5 bg-surface-subtle text-text-secondary text-xs font-medium rounded-lg hover:bg-surface-subtle/80 border border-border-hairline transition-all"
            title="Run calibrated synthetic fixture ingestion"
          >
            Simulate Fixture
          </button>
        </div>
      </div>

      {collectMsg && (
        <div
          className={`mt-3 p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
            collectMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {collectMsg.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{collectMsg.text}</span>
        </div>
      )}

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {/* Source Breakdown */}
        <div className="bg-surface-subtle/60 rounded-lg p-3.5 border border-border-hairline">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-2">
            Provenance Sources
          </span>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                LIVE_API (SerpApi)
              </span>
              <strong className="font-mono text-text-primary">{sources.LIVE_API || 0}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                FIXTURE (Calibrated)
              </span>
              <strong className="font-mono text-text-primary">{sources.FIXTURE || 0}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                LIVE_SCRAPE
              </span>
              <strong className="font-mono text-text-primary">{sources.LIVE_SCRAPE || 0}</strong>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-border-hairline text-text-primary font-bold">
              <span>Total DB Quotes</span>
              <span className="font-mono">{sources.TOTAL || 0}</span>
            </div>
          </div>
        </div>

        {/* Monthly Budget Tracker */}
        <div className="bg-surface-subtle/60 rounded-lg p-3.5 border border-border-hairline">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Search Budget
            </span>
            <span className="text-xs font-mono font-bold text-text-primary">
              {budgetUsed} / {budgetTotal}
            </span>
          </div>
          <div className="w-full bg-surface-canvas rounded-full h-2 my-2 overflow-hidden border border-border-hairline">
            <div
              className={`h-full transition-all duration-500 ${
                budgetPct > 90 ? 'bg-metric-negative' : budgetPct > 70 ? 'bg-metric-warning' : 'bg-primary'
              }`}
              style={{ width: `${budgetPct}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-[11px] text-text-muted mt-1">
            <span>Remaining: <strong className="text-text-primary">{budgetRemain}</strong> queries</span>
            <span>{budgetPct}% Used</span>
          </div>
        </div>

        {/* Fee Basis & Quality */}
        <div className="bg-surface-subtle/60 rounded-lg p-3.5 border border-border-hairline">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-2">
            Fee Basis Breakdown
          </span>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Reported by Source</span>
              <strong className="font-mono text-blue-600">{feeBasis.reported || 0}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Derived (Civil Aviation)</span>
              <strong className="font-mono text-purple-600">{feeBasis.derived || 0}</strong>
            </div>
            <div className="pt-1 border-t border-border-hairline text-[11px] text-text-muted">
              <span>Fee deriver active via <code className="font-mono text-primary">fee_table.yaml</code></span>
            </div>
          </div>
        </div>

        {/* Connector & API Configuration */}
        <div className="bg-surface-subtle/60 rounded-lg p-3.5 border border-border-hairline">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-2">
            Provider Architecture
          </span>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">SerpApi Key:</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                statusData?.serpapi_configured 
                  ? 'bg-emerald-500/15 text-emerald-600' 
                  : 'bg-amber-500/15 text-amber-600'
              }`}>
                {statusData?.serpapi_configured ? 'CONFIGURED' : 'USING FIXTURE'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Playwright Scraper:</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-canvas text-text-muted border border-border-hairline">
                FLAGGED OFF (robots.txt gated)
              </span>
            </div>
            <div className="text-[10px] text-text-muted pt-1 truncate">
              Last Run: {statusData?.last_collection_run?.provider || 'None'} ({statusData?.last_collection_run?.status || 'IDLE'})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
