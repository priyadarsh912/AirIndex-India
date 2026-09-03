import React, { useState } from 'react';
import { Terminal, Play, CheckCircle2, Copy } from 'lucide-react';

export default function APIDocsView() {
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/index/current');
  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const endpoints = [
    { path: '/api/index/current', method: 'GET', desc: 'Get latest national Base-100 Airfare Index & changes' },
    { path: '/api/index/history', method: 'GET', desc: 'Get 30-day index time-series with filters' },
    { path: '/api/routes', method: 'GET', desc: 'Get 6 representative flight corridor statistics & weights' },
    { path: '/api/airlines', method: 'GET', desc: 'Get carrier fare comparison metrics' },
    { path: '/api/elasticity', method: 'GET', desc: 'Get booking window elasticity curve (T+45 to T+1)' },
    { path: '/api/anomalies', method: 'GET', desc: 'Get active surge alerts & deviation scores' },
    { path: '/api/explainability', method: 'GET', desc: 'Get index movement decomposition by corridor' },
    { path: '/api/backtest', method: 'GET', desc: 'Get 30-day DGCA validation results & correlation metrics' },
  ];

  const testEndpoint = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000${selectedEndpoint}`);
      if (res.ok) {
        const data = await res.json();
        setApiResponse(data);
      } else {
        setApiResponse({ error: `HTTP ${res.status}: Failed to reach local API server` });
      }
    } catch (e) {
      // Fallback mock JSON output for standalone preview
      if (selectedEndpoint === '/api/index/current') {
        setApiResponse({ index_name: "APIx (Airfare Price Index India)", current_index: 128.6, base_period: "2026-01 (100.0)", change_24h_pct: 4.2, change_7d_pct: 1.7, overall_avg_fare_inr: 5284, total_observations: 12486 });
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
      <div className="glass-card p-6 rounded-2xl border-l-4 border-l-cyan-500">
        <div className="flex items-center space-x-3 mb-2">
          <Terminal className="w-6 h-6 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Institutional RESTful API Portal (MoSPI & RBI Integration)</h2>
        </div>
        <p className="text-xs text-slate-300">
          High-frequency data streaming API endpoints for official price index calculation and monetary policy research.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints List */}
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Available REST Endpoints</h3>
          {endpoints.map((ep) => (
            <div
              key={ep.path}
              onClick={() => setSelectedEndpoint(ep.path)}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                selectedEndpoint === ep.path
                  ? 'bg-blue-600/20 border-blue-500/50 text-white'
                  : 'bg-navy-950 border-navy-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-blue-400">{ep.path}</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">GET</span>
              </div>
              <p className="text-[11px] text-slate-400">{ep.desc}</p>
            </div>
          ))}
        </div>

        {/* API Tester & Output Inspector */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-navy-800">
            <div className="font-mono text-xs text-white">
              <span className="text-emerald-400 font-bold mr-2">GET</span>
              <span>http://localhost:8000{selectedEndpoint}</span>
            </div>
            <button
              onClick={testEndpoint}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{loading ? 'Executing...' : 'Execute Request'}</span>
            </button>
          </div>

          <div className="flex-1 bg-navy-950 p-4 rounded-xl border border-navy-800 font-mono text-xs overflow-x-auto text-emerald-400">
            {apiResponse ? (
              <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
            ) : (
              <div className="text-slate-500 text-center py-12">
                Click "Execute Request" to test endpoint response payload.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
