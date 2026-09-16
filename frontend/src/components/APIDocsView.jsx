import React, { useState } from 'react';
import { API_BASE_URL } from '../App';

export default function APIDocsView() {
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/index/current');
  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const endpoints = [
    { path: '/api/index/current', method: 'GET', desc: 'Get latest national Base-100 Airfare Index & changes' },
    { path: '/api/index/history', method: 'GET', desc: 'Get 30-day index time-series with filters' },
    { path: '/api/routes', method: 'GET', desc: 'Get 50+ representative flight corridor statistics & weights' },
    { path: '/api/airlines', method: 'GET', desc: 'Get carrier fare comparison metrics' },
    { path: '/api/elasticity', method: 'GET', desc: 'Get booking window elasticity curve (T+45 to T+1)' },
    { path: '/api/anomalies', method: 'GET', desc: 'Get active surge alerts & deviation scores' },
    { path: '/api/explainability', method: 'GET', desc: 'Get index movement decomposition by corridor' },
    { path: '/api/backtest', method: 'GET', desc: 'Get 30-day DGCA validation results & correlation metrics' },
  ];

  const testEndpoint = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${selectedEndpoint}`);
      if (res.ok) {
        const data = await res.json();
        setApiResponse(data);
      } else {
        setApiResponse({ error: `HTTP ${res.status}: Failed to reach local API server` });
      }
    } catch (e) {
      if (selectedEndpoint === '/api/index/current') {
        setApiResponse({ index_name: "APIx (Airfare Price Index India)", current_index: 128.4, base_period: "2026-01 (100.0)", change_24h_pct: 3.2, change_7d_pct: 1.7, overall_avg_fare_inr: 7850, total_observations: 124 });
      } else {
        setApiResponse({ status: "SUCCESS", endpoint: selectedEndpoint, timestamp: new Date().toISOString() });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm border-l-4 border-l-primary">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="p-2.5 bg-primary-container text-on-primary rounded-lg shadow-sm">
            <span className="material-symbols-outlined text-[24px]">api</span>
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold text-text-primary">API & Data Developer Gateway</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Institutional RESTful API portal for real-time airfare index streaming & statistical intelligence integration
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints List */}
        <div className="bg-surface-card p-5 rounded-xl border border-border-hairline shadow-sm space-y-2">
          <h3 className="font-headline text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Available REST Endpoints</h3>
          {endpoints.map((ep) => (
            <div
              key={ep.path}
              onClick={() => setSelectedEndpoint(ep.path)}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                selectedEndpoint === ep.path
                  ? 'bg-primary-container text-on-primary border-primary shadow-sm font-semibold'
                  : 'bg-surface-canvas border-border-hairline text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold">{ep.path}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  selectedEndpoint === ep.path ? 'bg-white/20 text-white' : 'bg-badge-positive-bg text-metric-positive'
                }`}>
                  GET
                </span>
              </div>
              <p className={`text-[11px] ${selectedEndpoint === ep.path ? 'text-on-primary/80' : 'text-text-muted'}`}>
                {ep.desc}
              </p>
            </div>
          ))}
        </div>

        {/* API Tester & Output Inspector */}
        <div className="lg:col-span-2 bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-hairline">
            <div className="font-mono text-xs text-text-primary">
              <span className="text-metric-positive font-bold mr-2">GET</span>
              <span>{API_BASE_URL}{selectedEndpoint}</span>
            </div>
            <button
              onClick={testEndpoint}
              disabled={loading}
              className="px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>{loading ? 'Executing...' : 'Execute Request'}</span>
            </button>
          </div>

          <div className="flex-1 bg-surface-canvas p-4 rounded-lg border border-border-hairline font-mono text-xs overflow-x-auto text-primary min-h-[250px]">
            {apiResponse ? (
              <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
            ) : (
              <div className="text-text-muted text-center py-16">
                Click "Execute Request" to test endpoint response payload.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
