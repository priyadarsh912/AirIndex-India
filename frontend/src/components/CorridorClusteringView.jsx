import React, { useState } from 'react';
import { Layers, Building2, Share2, MapPin, Sun, TrendingUp, Filter, Search } from 'lucide-react';

const CLUSTER_ICONS = {
  "Metro Trunk": Building2,
  "Metro-Tier2 Link": Share2,
  "Regional & NE": MapPin,
  "Leisure & Tourist": Sun,
  "Emerging Hubs": TrendingUp,
};

export default function CorridorClusteringView({ clusterData, routes, selectedRoute, onSelectRoute }) {
  const [activeClusterFilter, setActiveClusterFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const clusters = clusterData?.clusters || [];
  const dailyTrend = clusterData?.daily_cluster_trend || [];

  // Filter routes based on search and selected cluster
  const filteredRoutes = (routes || []).filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.route.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCluster = activeClusterFilter === 'ALL' || r.cluster === activeClusterFilter;
    return matchesSearch && matchesCluster;
  });

  return (
    <div className="space-y-6">
      {/* Cluster Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {clusters.map((c) => {
          const Icon = CLUSTER_ICONS[c.name] || Layers;
          const isSelected = activeClusterFilter === c.name;

          return (
            <div
              key={c.name}
              onClick={() => setActiveClusterFilter(isSelected ? 'ALL' : c.name)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-navy-800 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-navy-900/60 border-navy-800 hover:border-navy-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-navy-950 text-slate-400 border border-navy-800">
                  {c.routes_count} Routes
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{c.name}</h3>
              <p className="text-xs text-slate-400 line-clamp-2 mb-3">{c.description}</p>

              <div className="border-t border-navy-800/80 pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400">Avg Fare:</span>
                <span className="font-mono font-semibold text-emerald-400">₹{c.avg_fare_inr?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Corridor Table & Interactive Filter Section */}
      <div className="bg-navy-900/70 rounded-2xl border border-navy-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-navy-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span>Tracked Corridors Directory ({filteredRoutes.length} of {routes?.length || 52})</span>
            </h2>
            <p className="text-xs text-slate-400">Select any corridor to apply real-time filter across all analytics widgets</p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search 52+ routes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Reset Cluster Filter */}
            {activeClusterFilter !== 'ALL' && (
              <button
                onClick={() => setActiveClusterFilter('ALL')}
                className="px-3 py-1.5 rounded-lg bg-navy-800 text-xs text-blue-400 border border-navy-700 hover:bg-navy-750"
              >
                Clear Segment Filter
              </button>
            )}
          </div>
        </div>

        {/* 52-Route Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-navy-800 text-slate-400 font-mono uppercase text-[10px]">
                <th className="py-2.5 px-3">Corridor</th>
                <th className="py-2.5 px-3">Segment Cluster</th>
                <th className="py-2.5 px-3">Current Fare</th>
                <th className="py-2.5 px-3">Price Relative</th>
                <th className="py-2.5 px-3">24h Change</th>
                <th className="py-2.5 px-3">Weight</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-850">
              {filteredRoutes.slice(0, 15).map((r) => {
                const isSelected = selectedRoute === r.route;
                const isPositive = r.change_24h >= 0;

                return (
                  <tr
                    key={r.route}
                    onClick={() => onSelectRoute(r.route)}
                    className={`transition-all cursor-pointer ${
                      isSelected ? 'bg-blue-900/30 font-semibold' : 'hover:bg-navy-850/50'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{r.route}</div>
                      <div className="text-[11px] text-slate-400">{r.name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-navy-950 border border-navy-800 text-slate-300">
                        {r.cluster || 'Trunk'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-200">
                      ₹{r.current_fare?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {r.price_relative?.toFixed(1)}
                    </td>
                    <td className={`py-3 px-3 font-mono font-medium ${isPositive ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {isPositive ? `+${r.change_24h}%` : `${r.change_24h}%`}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {(r.weight * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRoute(isSelected ? 'ALL' : r.route);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-navy-800 text-slate-300 border-navy-700 hover:text-white'
                        }`}
                      >
                        {isSelected ? 'Filtered' : 'Filter Corridor'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRoutes.length > 15 && (
            <div className="text-center py-2 text-xs text-slate-500 font-mono">
              Showing top 15 of {filteredRoutes.length} matched corridors. Use search to find specific routes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
