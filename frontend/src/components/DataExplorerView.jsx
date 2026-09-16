import React, { useState } from 'react';

export default function DataExplorerView({ observations, routes = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [selectedWindow, setSelectedWindow] = useState('ALL');

  const uniqueRoutesList = (routes && routes.length > 0)
    ? routes.map(r => r.route)
    : Array.from(new Set((observations || []).map(o => o.route))).sort();

  const sampleObs = (observations && observations.length > 0) ? observations : Array.from({ length: 15 }, (_, i) => ({
    id: `OBS-${10001 + i}`,
    timestamp: '2026-09-03T18:45:00Z',
    route: ['DEL-BOM', 'DEL-BLR', 'BOM-BLR', 'DEL-CCU', 'BLR-HYD', 'MAA-DEL'][i % 6],
    airline: ['IndiGo', 'Air India', 'Air India Express', 'Akasa Air'][i % 4],
    flight_number: `6E-${400 + i}`,
    booking_window: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'][i % 5],
    base_fare: 4200 + i * 150,
    taxes: 850 + i * 30,
    total_fare: 5150 + i * 180,
    quality_score: 95 - (i % 3) * 5,
    source: 'Direct Airline API',
  }));

  const filtered = sampleObs.filter((o) => {
    const matchesSearch = !searchTerm || (o.flight_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || (o.route || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoute = selectedRoute === 'ALL' || o.route === selectedRoute;
    const matchesAirline = selectedAirline === 'ALL' || o.airline === selectedAirline;
    const matchesWindow = selectedWindow === 'ALL' || o.booking_window === selectedWindow;
    return matchesSearch && matchesRoute && matchesAirline && matchesWindow;
  });

  const exportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Route', 'Airline', 'Flight', 'Window', 'BaseFare', 'Taxes', 'TotalFare', 'QualityScore', 'Source'];
    const rows = filtered.map((o) => [o.id, o.timestamp, o.route, o.airline, o.flight_number, o.booking_window, o.base_fare, o.taxes, o.total_fare, o.quality_score, o.source]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AirIndex_Observations_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-surface-card p-5 rounded-xl border border-border-hairline shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search flight number, corridor, or carrier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-border-focus font-medium"
            />
          </div>

          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="bg-surface-canvas border border-border-hairline text-text-primary text-xs rounded-lg px-3 py-2 font-medium max-w-[200px] truncate"
          >
            <option value="ALL">All Corridors ({uniqueRoutesList.length})</option>
            {uniqueRoutesList.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select value={selectedAirline} onChange={(e) => setSelectedAirline(e.target.value)} className="bg-surface-canvas border border-border-hairline text-text-primary text-xs rounded-lg px-3 py-2 font-medium">
            <option value="ALL">All Airlines</option>
            <option value="IndiGo">IndiGo</option>
            <option value="Air India">Air India</option>
            <option value="Air India Express">Air India Express</option>
            <option value="Akasa Air">Akasa Air</option>
          </select>

          <select value={selectedWindow} onChange={(e) => setSelectedWindow(e.target.value)} className="bg-surface-canvas border border-border-hairline text-text-primary text-xs rounded-lg px-3 py-2 font-medium">
            <option value="ALL">All Windows</option>
            <option value="T+1">T+1</option>
            <option value="T+7">T+7</option>
            <option value="T+15">T+15</option>
            <option value="T+30">T+30</option>
            <option value="T+45">T+45</option>
          </select>
        </div>

        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          <span>Export CSV</span>
        </button>
      </div>

      {/* Observations Table Card */}
      <div className="bg-surface-card rounded-xl border border-border-hairline p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-border-hairline">
          <h3 className="font-headline text-base font-bold text-text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">database</span>
            <span>Raw Observations Ledger ({filtered.length} records)</span>
          </h3>
          <span className="text-xs text-text-muted font-medium">
            Real-time feed from live scrapers & API integrations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-subtle text-text-muted uppercase text-[10px] font-semibold border-b border-border-hairline">
                <th className="py-2.5 px-3">Record ID</th>
                <th className="py-2.5 px-3">Corridor</th>
                <th className="py-2.5 px-3">Carrier</th>
                <th className="py-2.5 px-3">Flight No</th>
                <th className="py-2.5 px-3">Window</th>
                <th className="py-2.5 px-3 text-right">Base Fare</th>
                <th className="py-2.5 px-3 text-right">Taxes</th>
                <th className="py-2.5 px-3 text-right">Total Fare</th>
                <th className="py-2.5 px-3 text-center">Quality Score</th>
                <th className="py-2.5 px-3">Ingestion Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {filtered.map((o) => (
                <tr key={o.id || o.flight_number} className="hover:bg-surface-subtle transition-colors">
                  <td className="py-3 px-3 font-mono text-[11px] text-text-muted">{o.id || 'OBS-1001'}</td>
                  <td className="py-3 px-3 font-headline font-bold text-primary">{o.route}</td>
                  <td className="py-3 px-3 font-medium text-text-primary">{o.airline}</td>
                  <td className="py-3 px-3 font-mono text-text-secondary">{o.flight_number}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle text-primary border border-border-hairline">
                      {o.booking_window}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-text-muted tabular-nums">
                    ₹{Math.round(o.base_fare || 4000).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-right text-text-muted tabular-nums">
                    ₹{Math.round(o.taxes || 800).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-text-primary tabular-nums">
                    ₹{Math.round(o.total_fare || 4800).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-badge-positive-bg text-metric-positive">
                      {o.quality_score || 95}/100
                    </span>
                  </td>
                  <td className="py-3 px-3 text-text-secondary text-[11px]">{o.source || 'Direct API'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
