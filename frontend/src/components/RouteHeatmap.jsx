import React from 'react';
import { ArrowUpRight, ArrowDownRight, Layers, CheckCircle2 } from 'lucide-react';

export default function RouteHeatmap({ routes, selectedRoute = 'ALL', onSelectRoute }) {
  const defaultRoutes = [
    { route: 'DEL-BOM', name: 'Delhi → Mumbai', current_fare: 5450, base_fare: 4600, change_24h: 8.7, weight: 0.25 },
    { route: 'DEL-BLR', name: 'Delhi → Bengaluru', current_fare: 5980, base_fare: 5400, change_24h: 5.2, weight: 0.20 },
    { route: 'BOM-BLR', name: 'Mumbai → Bengaluru', current_fare: 4120, base_fare: 3800, change_24h: 2.1, weight: 0.15 },
    { route: 'DEL-CCU', name: 'Delhi → Kolkata', current_fare: 4440, base_fare: 4500, change_24h: -1.4, weight: 0.15 },
    { route: 'BLR-HYD', name: 'Bengaluru → Hyderabad', current_fare: 3280, base_fare: 2900, change_24h: 6.3, weight: 0.10 },
    { route: 'MAA-DEL', name: 'Chennai → Delhi', current_fare: 5720, base_fare: 5300, change_24h: 3.9, weight: 0.15 },
  ];

  const list = (routes && routes.length > 0) ? routes : defaultRoutes;

  return (
    <div className="glass-card p-6 rounded-2xl mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-navy-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Corridor Price Pressure Heatmap</span>
            {selectedRoute !== 'ALL' && (
              <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                Filtered: {selectedRoute}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400">Click any corridor card to isolate its index and pricing trend across the dashboard</p>
        </div>
        <div className="flex items-center space-x-2">
          {selectedRoute !== 'ALL' && (
            <button
              onClick={() => onSelectRoute?.('ALL')}
              className="text-xs font-mono text-slate-400 hover:text-white bg-navy-950 px-2.5 py-1 rounded-lg border border-navy-800"
            >
              Show All Corridors
            </button>
          )}
          <span className="text-xs font-mono text-slate-400 bg-navy-950 px-2.5 py-1 rounded-lg border border-navy-800">
            {list.length} Corridors
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((item) => {
          const isUp = item.change_24h >= 0;
          const absVal = Math.abs(item.change_24h);
          const isSelected = selectedRoute === item.route;
          
          let bgClass = "bg-navy-900 border-navy-800";
          let badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
          
          if (isUp) {
            if (absVal > 7.0) {
              bgClass = "bg-gradient-to-br from-rose-950/40 to-navy-900 border-rose-800/40";
              badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold";
            } else if (absVal > 3.0) {
              bgClass = "bg-gradient-to-br from-amber-950/30 to-navy-900 border-amber-800/30";
              badgeClass = "bg-amber-500/15 text-amber-300 border-amber-500/30";
            } else {
              badgeClass = "bg-blue-500/10 text-blue-300 border-blue-500/20";
            }
          } else {
            bgClass = "bg-gradient-to-br from-emerald-950/30 to-navy-900 border-emerald-800/30";
          }

          return (
            <div
              key={item.route}
              onClick={() => onSelectRoute?.(isSelected ? 'ALL' : item.route)}
              className={`p-4 rounded-xl border ${bgClass} ${
                isSelected ? 'ring-2 ring-blue-500 shadow-xl shadow-blue-500/25 border-blue-400' : ''
              } transition-all hover:scale-[1.02] cursor-pointer group relative overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm font-extrabold text-white tracking-wide">{item.route}</span>
                  <span className="text-[10px] font-mono bg-navy-950 text-slate-400 px-1.5 py-0.5 rounded border border-navy-800">
                    W: {Math.round(item.weight * 100)}%
                  </span>
                  {isSelected && (
                    <span className="text-[9px] font-mono bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Active
                    </span>
                  )}
                </div>
                <div className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                  {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {isUp ? `+${item.change_24h}%` : `${item.change_24h}%`}
                </div>
              </div>

              <div className="text-xs text-slate-300 mb-3 truncate">{item.name}</div>

              <div className="flex items-baseline justify-between pt-2 border-t border-navy-800/60 font-mono text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">Current Avg</span>
                  <span className="font-bold text-white text-sm">₹{Math.round(item.current_fare).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block">Base (Jan 26)</span>
                  <span className="text-slate-400">₹{Math.round(item.base_fare).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
