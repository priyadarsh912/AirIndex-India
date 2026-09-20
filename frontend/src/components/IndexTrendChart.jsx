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

  // Calculate summary metrics across current trend dataset
  const { peakPoint, troughPoint, periodChange } = React.useMemo(() => {
    if (!trendData || trendData.length === 0) return { peakPoint: null, troughPoint: null, periodChange: 0 };
    let peak = trendData[0];
    let trough = trendData[0];
    for (const p of trendData) {
      if ((p.weighted_index ?? 0) > (peak.weighted_index ?? 0)) peak = p;
      if ((p.weighted_index ?? 0) < (trough.weighted_index ?? 0)) trough = p;
    }
    const firstVal = trendData[0].weighted_index || 100;
    const lastVal = trendData[trendData.length - 1].weighted_index || firstVal;
    const change = ((lastVal - firstVal) / firstVal) * 100;
    return { peakPoint: peak, troughPoint: trough, periodChange: change };
  }, [trendData]);

  const activeFreq = filters.frequency || 'Daily';

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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">stacked_line_chart</span>
            <h2 className="font-headline text-lg font-bold text-text-primary">
              Airfare Price Index (APIx) — {activeFreq} Trend
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
                  activeFreq === f
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

      {/* Economic Data Interpretation & Statistical Insights Banner */}
      {trendData && trendData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-canvas rounded-lg border border-border-hairline text-xs mb-5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              activeFreq === 'Monthly' ? 'bg-emerald-500' : activeFreq === 'Weekly' ? 'bg-blue-500' : 'bg-indigo-500'
            } animate-pulse`}></span>
            <span className="font-semibold text-text-primary">
              {activeFreq === 'Monthly' && '12-Month Macroeconomic CPI Airfare Basket (Jan 2026 = 100.0)'}
              {activeFreq === 'Weekly' && '12-Week Rolling Dynamic Series (Holiday Surges & Seasonal Movement)'}
              {activeFreq === 'Daily' && 'High-Frequency 30-Day Observational Velocity (T+1 to T+45 Feeds)'}
            </span>
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono font-medium">
              {activeFreq === 'Monthly' ? 'MoM Analysis' : activeFreq === 'Weekly' ? 'WoW Dynamics' : 'Daily Volatility'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-muted">
            {peakPoint && (
              <span>
                {activeFreq === 'Monthly' ? '12M High' : activeFreq === 'Weekly' ? 'Holiday Peak' : 'Period High'}:{' '}
                <strong className="text-text-primary">{peakPoint.date} ({peakPoint.weighted_index})</strong>
              </span>
            )}
            {troughPoint && (
              <span>
                {activeFreq === 'Monthly' ? '12M Low' : activeFreq === 'Weekly' ? 'Monsoon Low' : 'Period Low'}:{' '}
                <strong className="text-text-primary">{troughPoint.date} ({troughPoint.weighted_index})</strong>
              </span>
            )}
            <span>
              Net Shift:{' '}
              <strong className={periodChange >= 0 ? 'text-metric-warning font-bold' : 'text-metric-positive font-bold'}>
                {periodChange >= 0 ? `+${periodChange.toFixed(1)}%` : `${periodChange.toFixed(1)}%`}
              </strong>
            </span>
          </div>
        </div>
      )}

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
                    const currentIndex = trendData.findIndex(p => p.date === item.date);
                    const prevItem = currentIndex > 0 ? trendData[currentIndex - 1] : null;
                    const delta = prevItem && prevItem.weighted_index > 0 
                      ? ((item.weighted_index - prevItem.weighted_index) / prevItem.weighted_index) * 100 
                      : null;
                    const deltaLabel = activeFreq === 'Monthly' ? 'MoM Change' : activeFreq === 'Weekly' ? 'WoW Change' : 'DoD Change';

                    return (
                      <div className="bg-surface-card border border-border-hairline p-3 rounded-lg shadow-lg text-xs space-y-1 min-w-[210px]">
                        <div className="font-bold text-text-primary border-b border-border-hairline pb-1 mb-1">
                          {item.full_date || label}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-secondary font-bold">APIx Weighted Index:</span>
                          <span className="font-mono font-bold text-text-primary">{item.weighted_index !== undefined ? item.weighted_index.toFixed(1) : '--'}</span>
                        </div>
                        {delta !== null && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-text-muted">{deltaLabel}:</span>
                            <span className={`font-semibold ${delta >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                            </span>
                          </div>
                        )}
                        {item.jevons_index && (
                          <div className="flex items-center justify-between text-text-muted text-[11px]">
                            <span>Jevons Geometric Index:</span>
                            <span className="font-mono">{item.jevons_index.toFixed(1)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-text-primary font-medium pt-1 border-t border-border-hairline">
                          <span>Average Fare:</span>
                          <span className="font-bold">₹{Math.round(item.avg_fare || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border-hairline/60">
                          <span className="text-text-muted">Provenance:</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.is_live || item.source === 'LIVE_API'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                          }`}>
                            {item.is_live || item.source === 'LIVE_API' ? '● LIVE API' : '○ FIXTURE'}
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted pt-0.5">
                          Sample Size: {item.observation_count?.toLocaleString() || 1} observations
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={100} stroke="#EA580C" strokeDasharray="3 3" label={{ value: 'Base 100 (Jan 2026)', fill: '#EA580C', fontSize: 10, position: 'insideTopLeft' }} />
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
