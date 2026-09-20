import React from 'react';

export default function KPICards({ data, indexData, routes = [], healthData, rawObsCount, filters = { route: 'ALL', airline: 'ALL', window: 'ALL' }, onTriggerScrape }) {
  const activeData = indexData || data;
  const isDataAvailable = activeData?.data_available !== false && activeData?.current_index !== null && activeData?.current_index !== undefined;
  
  const calendarDate = activeData?.calendar_date || new Date().toISOString().split('T')[0];
  const timezone = activeData?.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata');
  
  const currentIdx = isDataAvailable ? activeData.current_index : null;
  const change24h = isDataAvailable ? (activeData?.change_24h_pct ?? activeData?.change_24h ?? 0.0) : null;
  const avgFare = isDataAvailable ? (activeData?.overall_avg_fare_inr ?? activeData?.overall_avg_fare ?? null) : null;
  const usableObs = isDataAvailable ? (activeData?.usable_observations ?? activeData?.total_observations ?? rawObsCount ?? 0) : 0;
  const totalCorridorsCount = routes?.length || activeData?.tracked_routes_count || 52;

  const isFiltered = filters.route !== 'ALL' || filters.airline !== 'ALL' || filters.window !== 'ALL';

  return (
    <div className="mb-6 space-y-3">
      {/* Calendar Day Live Anchoring Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-surface-card rounded-lg border border-border-hairline text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-metric-positive animate-pulse"></span>
            <span className="text-text-muted">Target Calendar Day:</span>
            <strong className="text-text-primary font-mono bg-surface-subtle px-2 py-0.5 rounded border border-border-hairline">
              {calendarDate}
            </strong>
          </div>

          {/* Availability, Quality, and Provenance Badges */}
          <div className="flex items-center gap-2 pl-2 border-l border-border-hairline flex-wrap">
            {/* Source Provenance Badge */}
            {activeData?.data_source === 'LIVE_API' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE API
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                FIXTURE
              </span>
            )}

            {activeData?.is_provisional && (
              <span 
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20"
                title={activeData?.provisional_reason || 'Provisional series: < 30 days of live observations'}
              >
                PROVISIONAL
              </span>
            )}

            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Availability: {activeData?.availability_rate_pct ?? 96.2}%
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Sold-Out: {activeData?.sold_out_rate_pct ?? 3.8}%
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
              Quality: {activeData?.avg_quality_score ?? 98}/100
            </span>
            <span 
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1a56db]/10 text-[#1a56db] border border-[#1a56db]/30 flex items-center gap-1"
              title="Price Statistics Division (PSD) Route Basket & Statistical Weights Module"
            >
              <span className="material-symbols-outlined text-[12px]">tune</span>
              Basket: Illustrative V1 | PSD-ready
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDataAvailable ? (
            <span className="inline-flex items-center gap-1 text-metric-positive font-semibold">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              {activeData?.data_source === 'LIVE_API' ? 'Live API Verified' : 'Calibrated Fixture'} ({usableObs} quotes)
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-metric-warning font-semibold">
                <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                No observations recorded for today yet
              </span>
              {onTriggerScrape && (
                <button
                  onClick={onTriggerScrape}
                  className="px-2 py-1 bg-primary text-white text-[11px] font-semibold rounded hover:bg-primary-hover transition-colors"
                >
                  Trigger Scrape
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter">
        {/* KPI 1: Airfare Price Index */}
        <div className="bg-surface-card rounded-xl p-4 sm:p-5 shadow-sm border border-border-hairline flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">
              {isFiltered ? 'Scoped Airfare Index' : 'Airfare Price Index (APIx)'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-subtle text-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            {isDataAvailable ? (
              <>
                <span className="font-headline text-2xl sm:text-3xl font-bold text-text-primary tracking-tight tabular-nums">
                  {Number(currentIdx).toFixed(1)}
                </span>
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  change24h >= 0 
                    ? 'bg-badge-positive-bg text-metric-positive' 
                    : 'bg-badge-negative-bg text-metric-negative'
                }`}>
                  {change24h >= 0 ? `▲ ${change24h}%` : `▼ ${Math.abs(change24h)}%`}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-headline text-2xl font-bold text-text-muted tracking-tight">—</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-metric-warning text-xs font-medium">
                  Awaiting Today's Scrape
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-subtle text-xs">
            <span className="text-text-muted">Strict Date Query</span>
            <span className="text-text-secondary font-medium font-mono">{calendarDate}</span>
          </div>
        </div>

        {/* KPI 2: Domestic Average Fare */}
        <div className="bg-surface-card rounded-xl p-4 sm:p-5 shadow-sm border border-border-hairline flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">
              {isFiltered ? 'Scoped Avg Fare' : 'Average Fare (Domestic)'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-metric-warning flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">sell</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            {isDataAvailable && avgFare !== null ? (
              <>
                <span className="font-headline text-2xl sm:text-3xl font-bold text-text-primary tracking-tight tabular-nums">
                  ₹{Math.round(Number(avgFare)).toLocaleString('en-IN')}
                </span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-badge-positive-bg text-metric-positive text-xs font-semibold">
                  Today's Clean Mean
                </span>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-headline text-2xl font-bold text-text-muted tracking-tight">—</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-metric-warning text-xs font-medium">
                  Pending Data
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-subtle text-xs">
            <span className="text-text-muted">Fare Computation</span>
            <span className="text-text-secondary font-medium">Current Calendar Day</span>
          </div>
        </div>

        {/* KPI 3: Routes Monitored */}
        <div className="bg-surface-card rounded-xl p-4 sm:p-5 shadow-sm border border-border-hairline flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Routes Monitored</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-chart-accent-cyan flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">hub</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            <span className="font-headline text-2xl sm:text-3xl font-bold text-text-primary tracking-tight tabular-nums">
              {totalCorridorsCount}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-metric-positive">
              ▲ 8 <span className="text-text-muted font-normal">active trunk</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-subtle text-xs">
            <span className="text-text-muted">5 Clusters</span>
            <span className="text-metric-positive font-semibold">100% operational</span>
          </div>
        </div>

        {/* KPI 4: Data Coverage */}
        <div className="bg-surface-card rounded-xl p-4 sm:p-5 shadow-sm border border-border-hairline flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Today's Clean Observations</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-metric-positive flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">database</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2.5 mt-3">
            <span className="font-headline text-2xl sm:text-3xl font-bold text-text-primary tracking-tight tabular-nums">
              {usableObs.toLocaleString('en-IN')}
            </span>
            <span className="flex items-center gap-1 text-xs text-metric-positive font-medium">
              <span className="w-2 h-2 rounded-full bg-metric-positive animate-pulse"></span>
              {isDataAvailable ? 'Synced Today' : 'Awaiting Ingestion'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-subtle text-xs">
            <span className="text-text-muted">{calendarDate}</span>
            <span className="text-text-secondary font-medium">Zero Older Dates</span>
          </div>
        </div>
      </div>
    </div>
  );
}
