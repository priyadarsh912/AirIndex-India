import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Clock } from 'lucide-react';

export default function BookingWindowElasticity({ elasticityData, selectedWindow = 'ALL', onSelectWindow }) {
  const defaultData = [
    { window: 'T+45', avg_fare: 3950, count: 2480, label: '45 Days Out (Base)' },
    { window: 'T+30', avg_fare: 4280, count: 2610, label: '30 Days Out (+8.3%)' },
    { window: 'T+15', avg_fare: 4890, count: 2540, label: '15 Days Out (+23.7%)' },
    { window: 'T+7',  avg_fare: 5820, count: 2490, label: '7 Days Out (+47.3%)' },
    { window: 'T+1',  avg_fare: 7450, count: 2366, label: '1 Day Out (+88.6% Surge)' },
  ];

  const data = (elasticityData && elasticityData.length > 0) ? elasticityData : defaultData;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-navy-950 border border-navy-700 p-3 rounded-xl shadow-2xl text-xs font-mono">
          <p className="font-bold text-amber-400 mb-1">Booking Window: {label}</p>
          <p className="text-white text-sm font-extrabold">Avg Fare: ₹{Math.round(payload[0]?.value).toLocaleString('en-IN')}</p>
          <p className="text-slate-400 text-[11px] mt-1">Sample Count: {payload[0]?.payload?.count} observations</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="gov-card p-6 rounded-2xl mb-6 border border-amber-500/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-orange-400"></div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Advance Booking Window Price Elasticity Curve</span>
            {selectedWindow !== 'ALL' && (
              <span className="text-xs font-mono bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-semibold">
                Filtered: {selectedWindow}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400">Click any window button to isolate its price elasticity</p>
        </div>
        <span className="text-xs font-mono text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-500/30 font-semibold">
          T+45 to T+1
        </span>
      </div>

      {/* Interactive Window Chips */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {data.map((item) => {
          const isSelected = selectedWindow === item.window;
          return (
            <button
              key={item.window}
              onClick={() => onSelectWindow?.(isSelected ? 'ALL' : item.window)}
              className={`p-2 rounded-lg border text-center font-mono text-xs transition-all ${
                isSelected
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 font-bold ring-2 ring-amber-400/40'
                  : 'bg-navy-950 border-navy-800 text-slate-400 hover:border-navy-700 hover:text-white'
              }`}
            >
              <span className="block text-[10px] opacity-80">{item.window}</span>
              <span className="font-bold text-white text-xs">₹{Math.round(item.avg_fare)}</span>
            </button>
          );
        })}
      </div>

      <div className="h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2f5e" vertical={false} />
            <XAxis dataKey="window" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="avg_fare"
              name="Average Fare (₹)"
              stroke="#F59E0B"
              strokeWidth={3}
              dot={{ r: 6, fill: '#F59E0B', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 8, fill: '#f59e0b' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
