import React, { useState } from 'react';

export default function CorridorClusteringView({ clusterData, routes, onSelectRoute }) {
  const [activeClusterFilter, setActiveClusterFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const clusters = clusterData?.clusters || [
    { name: "Metro Trunk", routes_count: 12, avg_fare_inr: 5450, description: "High-density primary interstate connectivity" },
    { name: "Metro-Tier2 Link", routes_count: 15, avg_fare_inr: 4820, description: "Connects primary hubs to state capitals" },
    { name: "Regional & NE", routes_count: 10, avg_fare_inr: 4100, description: "Tier-3 & North-East regional corridors" },
    { name: "Leisure & Tourist", routes_count: 8, avg_fare_inr: 6200, description: "Seasonal demand & tourist corridors" },
    { name: "Emerging Hubs", routes_count: 7, avg_fare_inr: 4350, description: "Fast-growing industrial pairs" },
  ];

  const filteredRoutes = (routes || []).filter(r => {
    const matchesSearch = (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (r.route || '').toLowerCase().includes(searchTerm.toLowerCase());
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
                placeholder="Search corridors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-canvas border border-border-hairline rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-focus"
              />
            </div>
            {activeClusterFilter !== 'ALL' && (
              <button
                onClick={() => setActiveClusterFilter('ALL')}
                className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

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
                  key={r.route}
                  onClick={() => onSelectRoute?.(r.route)}
                  className="hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 font-bold text-primary font-headline">{r.route}</td>
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
      </div>
    </div>
  );
}
