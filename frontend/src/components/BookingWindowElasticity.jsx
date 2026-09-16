import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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
        <div className="bg-surface-card border border-border-hairline p-3 rounded-lg shadow-md text-xs font-sans">
          <p className="font-semibold text-primary mb-1">Booking Window: {label}</p>
          <p className="text-text-primary text-sm font-bold tabular-nums">Avg Fare: ₹{Math.round(payload[0]?.value).toLocaleString('en-IN')}</p>
          <p className="text-text-muted text-[11px] mt-1">Sample Pool: {payload[0]?.payload?.count} observations</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-surface-card rounded-xl p-5 sm:p-6 shadow-sm border border-border-hairline mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-border-hairline">
        <div>
          <h3 className="font-headline text-base font-bold text-text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">schedule</span>
            <span>Advance Booking Price Elasticity</span>
            {selectedWindow !== 'ALL' && (
              <span className="text-[11px] font-semibold bg-surface-subtle text-primary px-2.5 py-0.5 rounded-full border border-border-hairline">
                Filtered: {selectedWindow}
              </span>
            )}
          </h3>
          <p className="text-xs text-text-muted">Dynamic pricing progression from 45 days out down to 1 day spot surge</p>
        </div>
        <span className="text-xs font-semibold text-primary bg-surface-subtle px-2.5 py-1 rounded-lg border border-border-hairline">
          T+45 to T+1
        </span>
      </div>

      {/* Interactive Window Chips */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {data.map((item) => {
          const isSelected = selectedWindow === item.window;
          return (
            <button
              key={item.window}
              onClick={() => onSelectWindow?.(isSelected ? 'ALL' : item.window)}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                isSelected
                  ? 'bg-primary-container text-on-primary border-primary font-semibold shadow-sm'
                  : 'bg-surface-canvas border-border-hairline text-text-primary hover:bg-surface-subtle'
              }`}
            >
              <span className="block text-[10px] opacity-80">{item.window}</span>
              <span className="font-headline font-bold text-xs tabular-nums block mt-0.5">₹{Math.round(item.avg_fare).toLocaleString('en-IN')}</span>
            </button>
          );
        })}
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="window" stroke="#64748B" tick={{ fill: '#64748B', fontSize: 11 }} />
            <YAxis stroke="#64748B" tick={{ fill: '#64748B', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="avg_fare"
              name="Average Fare (₹)"
              stroke="#2F6FED"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#2F6FED', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 7, fill: '#123B7A' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
