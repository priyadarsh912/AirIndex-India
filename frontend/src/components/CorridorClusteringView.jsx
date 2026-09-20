import React, { useState } from 'react';
import { DEFAULT_52_ROUTES, DEFAULT_CLUSTERS } from '../defaultData';

export default function CorridorClusteringView({ clusterData, routes, onSelectRoute }) {
  const [activeClusterFilter, setActiveClusterFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Always ensure all 52 corridors are present by merging backend routes with DEFAULT_52_ROUTES
  const allRoutes = React.useMemo(() => {
    if (!routes || routes.length === 0) return DEFAULT_52_ROUTES;
    const existingCodes = new Set(routes.map(r => r.route || r.code));
    const missing = DEFAULT_52_ROUTES.filter(d => !existingCodes.has(d.route));
    return [...routes, ...missing];
  }, [routes]);

  // Compute live cluster overview totals across the full 52 corridors
  const clusters = React.useMemo(() => {
    const defaultMeta = DEFAULT_CLUSTERS.reduce((acc, c) => {
      acc[c.name] = c;
      return acc;
    }, {});

    const counts = {};
    const sumFares = {};

    allRoutes.forEach(r => {
      const cName = r.cluster || 'Metro Trunk';
      counts[cName] = (counts[cName] || 0) + 1;
      sumFares[cName] = (sumFares[cName] || 0) + (r.current_fare || r.base_fare || 4500);
    });

    const clusterNames = ["Metro Trunk", "Metro-Tier2 Link", "Regional & NE", "Leisure & Tourist", "Emerging Hubs"];

    return clusterNames.map(name => {
      const cnt = counts[name] || defaultMeta[name]?.routes_count || 10;
      const avg = sumFares[name] ? Math.round(sumFares[name] / counts[name]) : (defaultMeta[name]?.avg_fare_inr || 4500);
      return {
        name,
        routes_count: cnt,
        avg_fare_inr: avg,
        description: defaultMeta[name]?.description || 'Strategic corridor cluster'
      };
    });
  }, [allRoutes]);

  const filteredRoutes = allRoutes.filter(r => {
    const q = searchTerm.trim().toLowerCase();
    const routeCode = (r.route || r.code || '').toLowerCase();
    const nameStr = (r.name || '').toLowerCase();
    const clusterStr = (r.cluster || '').toLowerCase();
    const orig = routeCode.split('-')[0] || '';
    const dest = routeCode.split('-')[1] || '';

    const matchesSearch = !q || 
      routeCode.includes(q) || 
      nameStr.includes(q) || 
      clusterStr.includes(q) ||
      orig.includes(q) ||
      dest.includes(q);

    const matchesCluster = activeClusterFilter === 'ALL' || r.cluster === activeClusterFilter;

    return matchesSearch && matchesCluster;
  });

  return (
    <div className="space-y-6">
      {/* Cluster Overview Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {clusters.map((c) => {
          const isSelected = activeClusterFilter === c.name;
          return (
            <div
              key={c.name}
              onClick={() => setActiveClusterFilter(isSelected ? 'ALL' : c.name)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary-container text-on-primary border-primary shadow-sm'
                  : 'bg-surface-card text-text-primary border-border-hairline hover:border-border-focus'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-surface-subtle text-primary'}`}>
                  {c.routes_count} Corridors
                </span>
                <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-white' : 'text-primary'}`}>
                  alt_route
                </span>
              </div>
              <h3 className="font-headline font-bold text-sm mb-1">{c.name}</h3>
              <p className={`text-[11px] line-clamp-2 mb-2 ${isSelected ? 'text-on-primary/80' : 'text-text-muted'}`}>
                {c.description}
              </p>
              <div className={`pt-2 border-t text-xs font-semibold flex justify-between ${isSelected ? 'border-white/20 text-white' : 'border-border-hairline text-text-primary'}`}>
                <span>Avg Fare:</span>
                <span className="tabular-nums">₹{c.avg_fare_inr?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Directory Table */}
      <div className="bg-surface-card rounded-xl border border-border-hairline p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-border-hairline">
          <div>
            <h2 className="font-headline text-lg font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">explore</span>
              <span>Tracked Corridors Directory ({filteredRoutes.length} Corridors)</span>
            </h2>
            <p className="text-xs text-text-muted">Click any route to select it for global data filtering</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by city, code (e.g. DEL, Goa)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-canvas border border-border-hairline rounded-lg pl-9 pr-8 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-focus"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-[16px] material-symbols-outlined"
                >
                  close
                </button>
              )}
            </div>
            {(activeClusterFilter !== 'ALL' || searchTerm !== '') && (
              <button
                onClick={() => { setActiveClusterFilter('ALL'); setSearchTerm(''); }}
                className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {filteredRoutes.length === 0 ? (
          <div className="text-center py-10 space-y-3 bg-surface-canvas/50 rounded-lg border border-dashed border-border-hairline">
            <span className="material-symbols-outlined text-text-muted text-[36px]">search_off</span>
            <h4 className="font-headline text-sm font-bold text-text-primary">No corridors found matching "{searchTerm}"</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Try searching by airport code (DEL, BOM, BLR, GOI), city name (Delhi, Goa, Pune), or cluster segment.
            </p>
            <button
              onClick={() => { setSearchTerm(''); setActiveClusterFilter('ALL'); }}
              className="px-3.5 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-subtle text-text-muted uppercase text-[10px] font-semibold border-b border-border-hairline">
                  <th className="py-2.5 px-3">Corridor Code</th>
                  <th className="py-2.5 px-3">City Pair Name</th>
                  <th className="py-2.5 px-3">Segment Cluster</th>
                  <th className="py-2.5 px-3 text-right">Current Fare</th>
                  <th className="py-2.5 px-3 text-right">Jan 2026 Base</th>
                  <th className="py-2.5 px-3 text-right">24h Variance</th>
                  <th className="py-2.5 px-3 text-right">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline">
                {filteredRoutes.map((r) => (
                  <tr
                    key={r.route || r.code}
                    onClick={() => onSelectRoute?.(r.route || r.code)}
                    className="hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 font-bold text-primary font-headline">{r.route || r.code}</td>
                    <td className="py-3 px-3 font-medium text-text-primary">{r.name}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle text-text-secondary border border-border-hairline">
                        {r.cluster || 'Metro Trunk'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-text-primary tabular-nums">
                      ₹{Math.round(r.current_fare || 5000).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right text-text-muted tabular-nums">
                      ₹{Math.round(r.base_fare || 4500).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        (r.change_24h || 0) >= 0 ? 'bg-badge-positive-bg text-metric-positive' : 'bg-badge-negative-bg text-metric-negative'
                      }`}>
                        {(r.change_24h || 0) >= 0 ? `+${r.change_24h}%` : `${r.change_24h}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-text-muted tabular-nums">
                      {((r.weight || 0.02) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
