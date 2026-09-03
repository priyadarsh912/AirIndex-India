import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, Plane, Database, Layers, CheckCircle2 } from 'lucide-react';

export default function KPICards({ data, filters = { route: 'ALL', airline: 'ALL', window: 'ALL' } }) {
  const currentIdx = data?.current_index ?? 128.6;
  const change24h = data?.change_24h_pct ?? (data?.change_24h ?? 4.2);
  const change7d = data?.change_7d_pct ?? (data?.change_7d ?? 1.7);
  const avgFare = data?.overall_avg_fare_inr ?? (data?.overall_avg_fare ?? 5284);
  const observations = data?.total_observations ?? 12486;
  const usableObs = data?.usable_observations ?? 11840;

  const isFiltered = filters.route !== 'ALL' || filters.airline !== 'ALL' || filters.window !== 'ALL';
  const filterLabel = [
    filters.route !== 'ALL' ? filters.route : null,
    filters.airline !== 'ALL' ? filters.airline : null,
    filters.window !== 'ALL' ? filters.window : null,
  ].filter(Boolean).join(' • ');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Airfare Price Index */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isFiltered ? 'Scoped Airfare Index' : 'Airfare Price Index (APIx)'}
          </span>
          <span className="text-[11px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
            {isFiltered ? filterLabel : 'Base-100'}
          </span>
        </div>
        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">{Number(currentIdx).toFixed(1)}</span>
          <div className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
            change24h >= 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
            {change24h >= 0 ? `+${change24h}%` : `${change24h}%`} (24h)
          </div>
        </div>
        <div className="text-xs text-slate-400 flex justify-between items-center pt-2 border-t border-navy-800">
          <span>7-Day Trend: <strong className="text-slate-200">+{change7d}%</strong></span>
          <span className="text-slate-500 text-[11px]">Jan 2026 = 100</span>
        </div>
      </div>

      {/* Card 2: Average National Fare */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isFiltered ? 'Scoped Average Fare' : 'Average National Fare'}
          </span>
          <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
            {filters.route !== 'ALL' ? filters.route : 'All Routes'}
          </span>
        </div>
        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            ₹{Math.round(Number(avgFare)).toLocaleString('en-IN')}
          </span>
          <div className="flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
            +6.1% vs base
          </div>
        </div>
        <div className="text-xs text-slate-400 flex justify-between items-center pt-2 border-t border-navy-800">
          <span>{isFiltered ? `Scoped to ${filterLabel}` : 'Weighted across 6 corridors'}</span>
          <span className="text-emerald-400 font-mono text-[11px]">Economy Standard</span>
        </div>
      </div>

      {/* Card 3: Observations Collected */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fare Observations</span>
          <span className="text-[11px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">30-Day Window</span>
        </div>
        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {Number(usableObs || observations).toLocaleString('en-IN')}
          </span>
          <div className="flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-purple-400" />
            Active Records
          </div>
        </div>
        <div className="text-xs text-slate-400 flex justify-between items-center pt-2 border-t border-navy-800">
          <span>{isFiltered ? 'Filtered observations' : '+1,240 records today'}</span>
          <span className="text-slate-500 text-[11px]">QA Score: 94.2/100</span>
        </div>
      </div>

      {/* Card 4: Tracked Basket Coverage */}
      <div className="glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Representative Basket</span>
          <span className="text-[11px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">DGCA Traffic</span>
        </div>
        <div className="flex items-baseline space-x-3 mb-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {filters.route !== 'ALL' ? '1 Corridor' : '6 Corridors'}
          </span>
          <div className="flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Plane className="w-3.5 h-3.5 mr-1 text-amber-400" />
            {filters.airline !== 'ALL' ? '1 Carrier' : '4 Carriers'}
          </div>
        </div>
        <div className="text-xs text-slate-400 flex justify-between items-center pt-2 border-t border-navy-800">
          <span>{filters.airline !== 'ALL' ? filters.airline : 'IndiGo, AI, AI Express, Akasa'}</span>
          <span className="text-amber-400 font-mono text-[11px]">{filters.window !== 'ALL' ? filters.window : 'T+1 to T+45'}</span>
        </div>
      </div>
    </div>
  );
}
