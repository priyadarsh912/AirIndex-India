// frontend/src/components/IndexTrendChart.jsx
import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';

export default function IndexTrendChart({
  trendData = [],
  filters = { route: 'ALL', airline: 'ALL', window: 'ALL', frequency: 'Daily' },
  onFilterChange = () => {},
  isLoading = false,
  error = null,
  routes = []
}) {
  // Only show blocking error card if there is an error AND zero data points available
  if (error && (!trendData || trendData.length === 0)) {
    return (
      <div className="bg-surface-card rounded-xl p-8 border border-border-hairline shadow-sm text-center">
        <span className="material-symbols-outlined text-metric-negative text-[36px]">error</span>
        <h4 className="font-headline font-bold text-base text-text-primary mt-2">API Connection Interrupted</h4>
        <p className="text-xs text-text-muted mt-1">{error}</p>
        <button 
          onClick={() => onFilterChange({})} 
          className="mt-4 px-4 py-2 bg-primary-container text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm"
        >
          Retry Real-Time Query
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-xl p-6 shadow-sm border border-border-hairline relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-surface-canvas/75 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 bg-surface-card px-4 py-2 rounded-lg border border-border-hairline shadow-md">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold text-text-primary">Calculating Live Index...</span>
          </div>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">stacked_line_chart</span>
            <h2 className="font-headline text-lg font-bold text-text-primary">
              Airfare Price Index (APIx) — {filters.frequency || 'Daily'} Trend
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Active Corridor: <strong className="text-primary">{filters.route || 'ALL'}</strong> | 
            Carrier: <strong className="text-primary">{filters.airline || 'ALL'}</strong> | 
            Window: <strong className="text-primary">{filters.window || 'ALL'}</strong>
          </p>
        </div>

        {/* Quick Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Route selector dropdown */}
          {routes && routes.length > 0 && (
            <select
              value={filters.route || 'ALL'}
              onChange={(e) => onFilterChange({ route: e.target.value })}
              className="bg-surface-canvas border border-border-hairline text-xs font-semibold px-2.5 py-1.5 rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Corridors (National)</option>
              {routes.map(r => (
                <option key={r.code || r.route} value={r.code || r.route}>
                  {r.code || r.route} - {r.name || r.route}
                </option>
              ))}
            </select>
          )}

          {/* Frequency Toggle Buttons */}
          <div className="flex items-center gap-1 bg-surface-canvas p-1 rounded-lg border border-border-hairline">
            {['Daily', 'Weekly', 'Monthly'].map(f => (
              <button
                key={f}
                onClick={() => onFilterChange({ frequency: f })}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  (filters.frequency || 'Daily') === f
                    ? 'bg-primary-container text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!isLoading && (!trendData || trendData.length === 0) ? (
        <div className="h-[280px] flex flex-col items-center justify-center text-center p-6">
          <span className="material-symbols-outlined text-text-muted text-[44px]">query_stats</span>
          <p className="font-headline font-bold text-sm text-text-primary mt-2">No Observational Records Found</p>
          <p className="text-xs text-text-muted mt-1 max-w-sm">
            No scraped or verified records exist matching the selected parameters. Adjust your filters or select "All Corridors".
          </p>
          <button
            onClick={() => onFilterChange({ route: 'ALL', airline: 'ALL', window: 'ALL' })}
            className="mt-3 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-surface-canvas border border-border-hairline text-primary hover:bg-slate-100"
          >
            Reset Filters to National Basket
          </button>
        </div>
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="liveIndexGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2F6FED" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2F6FED" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="date" stroke="#64748B" tick={{ fill: '#64748B', fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} stroke="#64748B" tick={{ fill: '#64748B', fontSize: 11 }} />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-surface-card border border-border-hairline p-3 rounded-lg shadow-lg text-xs space-y-1">
                        <div className="font-bold text-text-primary border-b border-border-hairline pb-1 mb-1">
                          {item.full_date || label}
                        </div>
                        <div className="text-secondary font-bold">
                          Weighted Index (APIx): {item.weighted_index !== undefined ? item.weighted_index.toFixed(1) : '--'}
                        </div>
                        {item.jevons_index && (
                          <div className="text-text-muted text-[11px]">
                            Jevons Index: {item.jevons_index.toFixed(1)}
                          </div>
                        )}
                        <div className="text-text-primary font-medium">
                          Average Fare: ₹{Math.round(item.avg_fare || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-text-muted pt-1 border-t border-border-hairline">
                          Live Clean Sample: {item.observation_count || 1} flights
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={100} stroke="#EA580C" strokeDasharray="3 3" label={{ value: 'Base 100', fill: '#EA580C', fontSize: 10, position: 'insideTopLeft' }} />
              <Area
                type="monotone"
                dataKey="weighted_index"
                stroke="#2F6FED"
                strokeWidth={2.5}
                fill="url(#liveIndexGrad)"
                activeDot={{ r: 6, stroke: '#123B7A', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
