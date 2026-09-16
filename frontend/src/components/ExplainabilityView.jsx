import React from 'react';

export default function ExplainabilityView({ explainabilityData }) {
  const defaultData = {
    latest_index: 128.4,
    index_change_24h_pct: 3.2,
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
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm border-l-4 border-l-primary">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="p-2.5 bg-primary-container text-on-primary rounded-lg shadow-sm">
            <span className="material-symbols-outlined text-[24px]">menu_book</span>
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold text-text-primary">Index Movement Explainability — Policy & Research</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Granular econometric decomposition of the <strong className="text-primary">+{data.index_change_24h_pct}%</strong> 24-hour index shift.
              Primary upward pressure was driven by <strong className="text-text-primary">{data.primary_driver_corridor}</strong> (+{data.primary_driver_impact_pct}%), while <strong className="text-text-secondary">{data.stabilizing_corridor}</strong> exerted stabilizing downward pressure.
            </p>
          </div>
        </div>
      </div>

      {/* Contribution Table */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
        <h3 className="font-headline text-base font-bold text-text-primary mb-4 pb-3 border-b border-border-hairline flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
          <span>Corridor Index Point Contribution Matrix</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-subtle text-text-muted uppercase text-[10px] font-semibold border-b border-border-hairline">
                <th className="py-2.5 px-3">Corridor</th>
                <th className="py-2.5 px-3">Route Name</th>
                <th className="py-2.5 px-3">Statistical Weight</th>
                <th className="py-2.5 px-3">24h Price Change</th>
                <th className="py-2.5 px-3 text-right">Index Points Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {data.route_contributions.map((row) => {
                const isPos = row.contribution_points >= 0;
                return (
                  <tr key={row.route} className="hover:bg-surface-subtle transition-colors">
                    <td className="py-3 px-3 font-headline font-bold text-primary">{row.route}</td>
                    <td className="py-3 px-3 font-medium text-text-primary">{row.name}</td>
                    <td className="py-3 px-3 text-text-muted tabular-nums">{row.weight_pct}%</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.change_24h_pct >= 0 ? 'bg-badge-positive-bg text-metric-positive' : 'bg-badge-negative-bg text-metric-negative'
                      }`}>
                        {row.change_24h_pct >= 0 ? `+${row.change_24h_pct}%` : `${row.change_24h_pct}%`}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-headline font-bold tabular-nums ${isPos ? 'text-metric-positive' : 'text-metric-negative'}`}>
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
