import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { Filter, Calendar, Info, RotateCcw } from 'lucide-react';

export default function IndexTrendChart({
  trendData,
  routes,
  airlines,
  filters = { route: 'ALL', airline: 'ALL', window: 'ALL', frequency: 'Daily' },
  onFilterChange
}) {
  const selectedRoute = filters.route || 'ALL';
  const selectedAirline = filters.airline || 'ALL';
  const selectedWindow = filters.window || 'ALL';
  const frequency = filters.frequency || 'Daily';

  const handleRouteSelect = (e) => {
    onFilterChange?.({ ...filters, route: e.target.value });
  };

  const handleAirlineSelect = (e) => {
    onFilterChange?.({ ...filters, airline: e.target.value });
  };

  const handleWindowSelect = (e) => {
    onFilterChange?.({ ...filters, window: e.target.value });
  };

  const handleFrequencySelect = (f) => {
    onFilterChange?.({ ...filters, frequency: f });
  };

  const handleReset = () => {
    onFilterChange?.({ route: 'ALL', airline: 'ALL', window: 'ALL', frequency: 'Daily' });
  };

  // Ensure format fits frequency
  const formattedData = (trendData || []).map((d) => {
    let displayDate = d.date;
    if (frequency === 'Daily' && d.date && d.date.length >= 10) {
      displayDate = d.date.substring(5); // MM-DD
    }
    return {
      date: displayDate,
      fullDate: d.full_date || d.date,
      Index: d.weighted_index,
      Jevons: d.jevons_index,
      Fisher: d.fisher_index,
      AvgFare: d.avg_fare
    };
  });

  const hasActiveFilters = selectedRoute !== 'ALL' || selectedAirline !== 'ALL' || selectedWindow !== 'ALL' || frequency !== 'Daily';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-navy-950/95 border border-navy-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono">
          <p className="font-semibold text-slate-300 mb-1.5 border-b border-navy-800 pb-1">
            Period: {payload[0]?.payload?.fullDate || label}
          </p>
          <div className="space-y-1">
            <p className="text-blue-400 flex justify-between space-x-4">
              <span>Weighted Index (APIx):</span>
              <strong className="font-extrabold">{payload[0]?.value?.toFixed(1)}</strong>
            </p>
            {payload[1] && (
              <p className="text-cyan-400 flex justify-between space-x-4">
                <span>Jevons Index:</span>
                <span>{payload[1]?.value?.toFixed(1)}</span>
              </p>
            )}
            <p className="text-emerald-400 flex justify-between space-x-4 pt-1 border-t border-navy-800">
              <span>Average Fare:</span>
              <span>₹{payload[0]?.payload?.AvgFare ? Math.round(payload[0]?.payload?.AvgFare).toLocaleString('en-IN') : 'N/A'}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6 rounded-2xl mb-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-navy-800">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>Airfare Price Index (APIx) — {frequency} Trend</span>
              <span className="text-xs font-mono font-normal text-slate-400 bg-navy-800 px-2.5 py-0.5 rounded-full border border-navy-700">
                Base 100 = Jan 2026
              </span>
            </h2>
            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="text-[11px] font-mono text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 flex items-center space-x-1 transition-all"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {hasActiveFilters ? (
              <span className="text-blue-400">
                Showing filtered metrics for {selectedRoute !== 'ALL' ? selectedRoute : 'All Routes'}
                {selectedAirline !== 'ALL' ? ` • ${selectedAirline}` : ''}
                {selectedWindow !== 'ALL' ? ` • ${selectedWindow}` : ''}
                {` • ${frequency} View (${formattedData.length} data intervals)`}
              </span>
            ) : (
              'High-frequency national index aggregated across representative domestic corridors'
            )}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Frequency Selector: Daily | Weekly | Monthly */}
          <div className="flex items-center bg-navy-950 p-1 rounded-lg border border-navy-800 text-xs font-medium">
            {['Daily', 'Weekly', 'Monthly'].map((f) => (
              <button
                key={f}
                onClick={() => handleFrequencySelect(f)}
                className={`px-3 py-1 rounded-md transition-all font-semibold ${
                  frequency === f
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Route Filter Dropdown - Dynamically populated with all 52+ corridors */}
          <select
            value={selectedRoute}
            onChange={handleRouteSelect}
            className="bg-navy-950 border border-navy-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium max-w-[260px] truncate"
          >
            <option value="ALL">All Tracked Corridors ({routes?.length || 52})</option>
            {/* If routes are categorized by cluster, group them into optgroups */}
            {['Metro Trunk', 'Metro-Tier2 Link', 'Regional & NE', 'Leisure & Tourist', 'Emerging Hubs'].map((clusterName) => {
              const clusterRoutes = (routes || []).filter((r) => (r.cluster || 'Metro Trunk') === clusterName);
              if (clusterRoutes.length === 0) return null;
              return (
                <optgroup key={clusterName} label={`── ${clusterName} (${clusterRoutes.length}) ──`}>
                  {clusterRoutes.map((r) => (
                    <option key={r.route} value={r.route}>
                      {r.route} ({r.name})
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {/* Fallback if no cluster grouping found */}
            {(!routes || routes.length === 0 || !routes.some(r => r.cluster)) && (routes || []).map((r) => (
              <option key={r.route} value={r.route}>
                {r.route} ({r.name})
              </option>
            ))}
          </select>

          {/* Airline Filter Dropdown */}
          <select
            value={selectedAirline}
            onChange={handleAirlineSelect}
            className="bg-navy-950 border border-navy-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">All Airlines (4)</option>
            <option value="IndiGo">IndiGo (6E)</option>
            <option value="Air India">Air India (AI)</option>
            <option value="Air India Express">Air India Express (IX)</option>
            <option value="Akasa Air">Akasa Air (QP)</option>
          </select>

          {/* Advance Window Dropdown */}
          <select
            value={selectedWindow}
            onChange={handleWindowSelect}
            className="bg-navy-950 border border-navy-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">All Windows (T+1 to T+45)</option>
            <option value="T+1">T+1 (Immediate 1-day)</option>
            <option value="T+7">T+7 (7-Day Advance)</option>
            <option value="T+15">T+15 (15-Day Advance)</option>
            <option value="T+30">T+30 (30-Day Advance)</option>
            <option value="T+45">T+45 (45-Day Advance)</option>
          </select>
        </div>
      </div>

      {/* Main Area Chart */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="indexGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="jevonsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2f5e" vertical={false} />
            <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={100}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: 'Base Period (100.0)', fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }}
            />
            <Area
              type="monotone"
              dataKey="Index"
              name="Weighted Index"
              stroke="#3B82F6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#indexGradient)"
              activeDot={{ r: 6, stroke: '#60a5fa', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="Jevons"
              name="Jevons Geometric"
              stroke="#06B6D4"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#jevonsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Stats Footer */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mt-4 pt-3 border-t border-navy-800">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-blue-500 rounded-full"></span>
            <span className="text-slate-300 font-medium">Weighted Base-100 APIx</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-0.5 bg-cyan-400 border-t border-dashed border-cyan-400"></span>
            <span className="text-slate-400">Jevons Geometric Index</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-0.5 bg-amber-500 border-t border-dashed border-amber-500"></span>
            <span className="text-amber-400">Base Period (100.0)</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-400">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>Showing <strong className="text-slate-200">{formattedData.length}</strong> {frequency.toLowerCase()} time periods</span>
        </div>
      </div>
    </div>
  );
}
