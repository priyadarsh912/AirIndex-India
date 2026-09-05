import React from 'react';
import { ShieldCheck, Activity, CheckCircle2, RefreshCw, Server, AlertCircle } from 'lucide-react';

export default function PipelineHealthView({ healthData }) {
  const defaultConnectors = [
    { airline: 'IndiGo', status: 'ONLINE', latency_ms: 142, records_today: 320, robots_txt: 'COMPLIANT' },
    { airline: 'Air India', status: 'ONLINE', latency_ms: 185, records_today: 280, robots_txt: 'COMPLIANT' },
    { airline: 'Air India Express', status: 'ONLINE', latency_ms: 160, records_today: 210, robots_txt: 'COMPLIANT' },
    { airline: 'Akasa Air', status: 'ONLINE', latency_ms: 210, records_today: 190, robots_txt: 'COMPLIANT' },
  ];

  const connectors = healthData?.connectors || defaultConnectors;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="gov-card p-6 rounded-2xl border-l-4 border-l-emerald-500 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400"></div>
        <div className="flex items-center space-x-3.5 mb-2">
          <div className="p-2.5 bg-emerald-950 text-emerald-300 rounded-xl border border-emerald-500/30 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">National Data Pipeline & Scraper Connector Surveillance</h2>
            <p className="text-xs text-slate-300">
              Continuous health surveillance of automated ingestion nodes, rate limiting compliance, and ethical data collection safeguards.
            </p>
          </div>
        </div>
      </div>

      {/* Connectors Table */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-base font-bold text-white mb-4 pb-3 border-b border-navy-800 flex items-center space-x-2">
          <Server className="w-4 h-4 text-blue-400" />
          <span>Active Airline Connectors</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {connectors.map((c) => (
            <div key={c.airline} className="bg-navy-950 p-4 rounded-xl border border-navy-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-sm">{c.airline}</span>
                <span className="flex items-center text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                  {c.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono text-slate-400 pt-2 border-t border-navy-800">
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="text-slate-200">{c.latency_ms} ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Records Today:</span>
                  <span className="text-blue-400">{c.records_today}</span>
                </div>
                <div className="flex justify-between">
                  <span>robots.txt:</span>
                  <span className="text-emerald-400">{c.robots_txt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
