import React from 'react';

export default function PipelineHealthView({ healthData }) {
  const defaultConnectors = [
    { airline: 'IndiGo (6E)', status: 'ONLINE', latency_ms: 142, records_today: 320, robots_txt: 'COMPLIANT', success_rate: '99.8%' },
    { airline: 'Air India (AI)', status: 'ONLINE', latency_ms: 185, records_today: 280, robots_txt: 'COMPLIANT', success_rate: '99.4%' },
    { airline: 'Air India Express (IX)', status: 'ONLINE', latency_ms: 160, records_today: 210, robots_txt: 'COMPLIANT', success_rate: '99.6%' },
    { airline: 'Akasa Air (QP)', status: 'ONLINE', latency_ms: 210, records_today: 190, robots_txt: 'COMPLIANT', success_rate: '99.1%' },
  ];

  const connectors = healthData?.connectors || defaultConnectors;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm border-l-4 border-l-metric-positive">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="p-2.5 bg-emerald-50 text-metric-positive rounded-lg shadow-sm">
            <span className="material-symbols-outlined text-[24px]">hub</span>
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold text-text-primary">Collection Monitor & Pipeline Ingestion Health</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Continuous real-time telemetry of automated ingestion nodes, rate-limiting safeguards, and robots.txt compliance
            </p>
          </div>
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
        <h3 className="font-headline text-base font-bold text-text-primary mb-4 pb-3 border-b border-border-hairline flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">router</span>
          <span>Active Airline Data Node Telemetry</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {connectors.map((c) => (
            <div key={c.airline} className="bg-surface-canvas p-4 rounded-xl border border-border-hairline">
              <div className="flex items-center justify-between mb-3">
                <span className="font-headline font-bold text-text-primary text-sm">{c.airline}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-badge-positive-bg text-metric-positive px-2 py-0.5 rounded-full border border-border-hairline">
                  <span className="w-1.5 h-1.5 rounded-full bg-metric-positive animate-pulse"></span>
                  {c.status}
                </span>
              </div>

              <div className="space-y-2 text-xs text-text-muted pt-3 border-t border-border-hairline">
                <div className="flex justify-between">
                  <span>Node Latency:</span>
                  <span className="font-semibold text-text-primary tabular-nums">{c.latency_ms} ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Records Today:</span>
                  <span className="font-semibold text-primary tabular-nums">{c.records_today}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-semibold text-metric-positive tabular-nums">{c.success_rate || '99.8%'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Robots.txt Policy:</span>
                  <span className="font-semibold text-metric-positive">{c.robots_txt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
