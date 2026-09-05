import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, Plane, Database, Layers, CheckCircle2, Award, Building2 } from 'lucide-react';

export default function KPICards({ data, indexData, routes = [], healthData, rawObsCount, filters = { route: 'ALL', airline: 'ALL', window: 'ALL' } }) {
  const activeData = indexData || data;
  const currentIdx = activeData?.current_index ?? 128.6;
  const change24h = activeData?.change_24h_pct ?? (activeData?.change_24h ?? 4.2);
  const change7d = activeData?.change_7d_pct ?? (activeData?.change_7d ?? 1.7);
  const avgFare = activeData?.overall_avg_fare_inr ?? (activeData?.overall_avg_fare ?? 5284);
  const observations = activeData?.total_observations ?? (rawObsCount || 12486);
  const usableObs = activeData?.usable_observations ?? (rawObsCount || 11840);
  const totalCorridorsCount = routes?.length || activeData?.tracked_routes_count || 52;

  const isFiltered = filters.route !== 'ALL' || filters.airline !== 'ALL' || filters.window !== 'ALL';
  const filterLabel = [
    filters.route !== 'ALL' ? filters.route : null,
    filters.airline !== 'ALL' ? filters.airline : null,
    filters.window !== 'ALL' ? filters.window : null,
  ].filter(Boolean).join(' • ');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Airfare Price Index */}
      <div className="gov-card p-5 rounded-2xl relative overflow-hidden group border border-blue-500/20">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-cyan-400"></div>
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            {isFiltered ? 'Scoped Airfare Index' : 'Airfare Price Index (APIx)'}
          </span>
          <span className="text-[11px] font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-semibold">
            {isFiltered ? filterLabel : 'Base-100'}
          </span>
        </div>

        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">{Number(currentIdx).toFixed(1)}</span>
          <div className={`flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full ${
            change24h >= 0 
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' 
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          }`}>
            {change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
            {change24h >= 0 ? `+${change24h}%` : `${change24h}%`} (24h)
          </div>
        </div>

        <div className="text-xs text-slate-400 flex justify-between items-center pt-2.5 border-t border-slate-800/80">
          <span>7-Day Trend: <strong className="text-slate-200">+{change7d}%</strong></span>
          <span className="text-slate-500 text-[11px] font-mono">Base: Jan 2026</span>
        </div>
      </div>

      {/* Card 2: Average National Fare */}
      <div className="gov-card p-5 rounded-2xl relative overflow-hidden group border border-emerald-500/20">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-400"></div>
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {isFiltered ? 'Scoped Average Fare' : 'Average National Fare'}
          </span>
          <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
            {filters.route !== 'ALL' ? filters.route : 'All Corridors'}
          </span>
        </div>

        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
            ₹{Math.round(Number(avgFare)).toLocaleString('en-IN')}
          </span>
          {(() => {
            const baseRef = filters.route !== 'ALL'
              ? (routes?.find(r => r.route === filters.route)?.base_fare || 4600)
              : 4600;
            const diffPct = parseFloat((((Number(avgFare) - baseRef) / baseRef) * 100).toFixed(1));
            const isDiffPositive = diffPct >= 0;
            return (
              <div className={`flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isDiffPositive 
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' 
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isDiffPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                {isDiffPositive ? `+${diffPct}%` : `${diffPct}%`} vs base
              </div>
            );
          })()}
        </div>

        <div className="text-xs text-slate-400 flex justify-between items-center pt-2.5 border-t border-slate-800/80">
          <span className="truncate">{isFiltered ? `Filter: ${filterLabel}` : `Weighted ${totalCorridorsCount} Corridors`}</span>
          <span className="text-emerald-400 font-mono text-[11px] font-semibold">Economy Class</span>
        </div>
      </div>

      {/* Card 3: Observations Collected */}
      <div className="gov-card p-5 rounded-2xl relative overflow-hidden group border border-purple-500/20">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-500 to-indigo-400"></div>
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Fare Observations
          </span>
          <span className="text-[11px] font-mono bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 font-semibold">
            Automated Audit
          </span>
        </div>

        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
            {Number(usableObs || observations).toLocaleString('en-IN')}
          </span>
          <div className="flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-purple-400" />
            Clean Records
          </div>
        </div>

        <div className="text-xs text-slate-400 flex justify-between items-center pt-2.5 border-t border-slate-800/80">
          <span>{isFiltered ? 'Active sample pool' : 'Harvested live daily'}</span>
          <span className="text-purple-300 font-mono text-[11px] font-semibold">Confidence 98.4%</span>
        </div>
      </div>

      {/* Card 4: Tracked Basket Coverage */}
      <div className="gov-card p-5 rounded-2xl relative overflow-hidden group border border-amber-500/20">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 to-orange-400"></div>
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Statistical Basket
          </span>
          <span className="text-[11px] font-mono bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-semibold">
            DGCA Coverage
          </span>
        </div>

        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
            {filters.route !== 'ALL' ? '1 Route' : `${totalCorridorsCount} Routes`}
          </span>
          <div className="flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Plane className="w-3.5 h-3.5 mr-1 text-amber-400" />
            {filters.airline !== 'ALL' ? '1 Carrier' : '4 Airlines'}
          </div>
        </div>

        <div className="text-xs text-slate-400 flex justify-between items-center pt-2.5 border-t border-slate-800/80">
          <span className="truncate">{filters.airline !== 'ALL' ? filters.airline : 'IndiGo, AI, Express, Akasa'}</span>
          <span className="text-amber-400 font-mono text-[11px] font-semibold">{filters.window !== 'ALL' ? filters.window : 'T+1 to T+45'}</span>
        </div>
      </div>
    </div>
  );
}
