import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Plane, CheckCircle2 } from 'lucide-react';

export default function AirlineComparisonChart({ airlineData, airlines, selectedAirline = 'ALL', onSelectAirline }) {
  const defaultAirlines = [
    { airline: 'IndiGo', avg_fare: 5400, min_fare: 4200, max_fare: 7800, observation_count: 7420 },
    { airline: 'Air India', avg_fare: 5150, min_fare: 4100, max_fare: 8200, observation_count: 2750 },
    { airline: 'Air India Express', avg_fare: 4920, min_fare: 3800, max_fare: 6900, observation_count: 1240 },
    { airline: 'Akasa Air', avg_fare: 4710, min_fare: 3650, max_fare: 6500, observation_count: 1076 },
  ];

  const incomingData = airlineData || airlines;
  const data = (incomingData && incomingData.length > 0) ? incomingData : defaultAirlines;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-navy-950 border border-navy-700 p-3 rounded-xl shadow-2xl text-xs font-mono">
          <p className="font-bold text-white mb-1">{label}</p>
          <div className="space-y-1 text-slate-300">
            <p className="text-blue-400">Avg Fare: ₹{Math.round(payload[0]?.value).toLocaleString('en-IN')}</p>
            <p className="text-emerald-400">Min Fare: ₹{Math.round(payload[0]?.payload?.min_fare || 0).toLocaleString('en-IN')}</p>
            <p className="text-rose-400">Max Fare: ₹{Math.round(payload[0]?.payload?.max_fare || 0).toLocaleString('en-IN')}</p>
            <p className="text-slate-400 pt-1 border-t border-navy-800">Observations: {payload[0]?.payload?.observation_count}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 rounded-2xl border border-teal-500/30 bg-[#091026] relative flex flex-col justify-between h-full overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-400"></div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2.5 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Plane className="w-4 h-4 text-emerald-400" />
            <span>Airline Carrier Comparison</span>
            {selectedAirline !== 'ALL' && (
              <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                Filtered: {selectedAirline}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-400">Click a carrier chip below to isolate its pricing trend</p>
        </div>
        <div className="flex items-center space-x-1">
          {selectedAirline !== 'ALL' && (
            <button
              onClick={() => onSelectAirline?.('ALL')}
              className="text-xs font-mono text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 transition-all"
            >
              Reset to All
            </button>
          )}
        </div>
      </div>

      {/* Airline Selector Chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {data.map((item) => {
          const isSelected = selectedAirline === item.airline;
          return (
            <button
              key={item.airline}
              onClick={() => onSelectAirline?.(isSelected ? 'ALL' : item.airline)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center space-x-1 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 font-bold'
                  : 'bg-[#111c38] text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{item.airline}</span>
              <span className="text-[10px] opacity-80 ml-1">₹{Math.round(item.avg_fare)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2f5e" vertical={false} />
            <XAxis dataKey="airline" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="avg_fare"
              name="Average Fare (₹)"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(entry) => onSelectAirline?.(selectedAirline === entry.airline ? 'ALL' : entry.airline)}
            >
              {data.map((entry, index) => {
                const isSelected = selectedAirline === entry.airline;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isSelected ? '#10B981' : (selectedAirline !== 'ALL' ? '#1E3A8A' : '#3B82F6')}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
