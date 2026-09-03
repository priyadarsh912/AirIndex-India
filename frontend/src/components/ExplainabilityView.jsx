import React from 'react';
import { FileCheck, ArrowUpRight, ArrowDownRight, Layers, PieChart, Info } from 'lucide-react';

export default function ExplainabilityView({ explainabilityData }) {
  const defaultData = {
    latest_index: 128.6,
    index_change_24h_pct: 4.2,
    primary_driver_corridor: 'Delhi to Mumbai (DEL-BOM)',
    primary_driver_impact_pct: 8.7,
    stabilizing_corridor: 'Delhi to Kolkata (DEL-CCU)',
    route_contributions: [
      { route: 'DEL-BOM', name: 'Delhi to Mumbai', change_24h_pct: 8.7, weight_pct: 25.0, contribution_points: 2.18 },
      { route: 'DEL-BLR', name: 'Delhi to Bengaluru', change_24h_pct: 5.2, weight_pct: 20.0, contribution_points: 1.04 },
      { route: 'BLR-HYD', name: 'Bengaluru to Hyderabad', change_24h_pct: 6.3, weight_pct: 10.0, contribution_points: 0.63 },
      { route: 'MAA-DEL', name: 'Chennai to Delhi', change_24h_pct: 3.9, weight_pct: 15.0, contribution_points: 0.585 },
      { route: 'BOM-BLR', name: 'Mumbai to Bengaluru', change_24h_pct: 2.1, weight_pct: 15.0, contribution_points: 0.315 },
      { route: 'DEL-CCU', name: 'Delhi to Kolkata', change_24h_pct: -1.4, weight_pct: 15.0, contribution_points: -0.21 },
    ]
  };

  const data = explainabilityData || defaultData;

  return (
    <div className="space-y-6">
      {/* Top Explanation Banner */}
      <div className="glass-card p-6 rounded-2xl border-l-4 border-l-blue-500">
        <div className="flex items-center space-x-3 mb-2">
          <FileCheck className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Index Movement Explainability — "Why Did the Index Move?"</h2>
        </div>
        <p className="text-xs text-slate-300">
          Statistical decomposition of the <strong className="text-blue-400">+{data.index_change_24h_pct}%</strong> 24-hour index movement.
          The primary upward pressure was driven by <strong className="text-white">{data.primary_driver_corridor}</strong> (+{data.primary_driver_impact_pct}%), while <strong className="text-slate-300">{data.stabilizing_corridor}</strong> exerted stabilizing downward pressure.
        </p>
      </div>

      {/* Contribution Table */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-base font-bold text-white mb-4 pb-3 border-b border-navy-800 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Corridor Contribution Breakdown</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-navy-950 border-b border-navy-800 text-slate-400">
                <th className="p-3">Corridor</th>
                <th className="p-3">Route Name</th>
                <th className="p-3">Weight</th>
                <th className="p-3">24h Price Change</th>
                <th className="p-3 text-right">Index Points Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60">
              {data.route_contributions.map((row) => {
                const isPos = row.contribution_points >= 0;
                return (
                  <tr key={row.route} className="hover:bg-navy-850/50">
                    <td className="p-3 font-bold text-white">{row.route}</td>
                    <td className="p-3 text-slate-300 font-sans">{row.name}</td>
                    <td className="p-3 text-slate-400">{row.weight_pct}%</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                        row.change_24h_pct >= 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {row.change_24h_pct >= 0 ? `+${row.change_24h_pct}%` : `${row.change_24h_pct}%`}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-bold text-sm ${isPos ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isPos ? `+${row.contribution_points.toFixed(2)} pts` : `${row.contribution_points.toFixed(2)} pts`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
