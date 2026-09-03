import React, { useState } from 'react';
import { Search, Download, Database, CheckCircle, AlertTriangle, ShieldCheck, Filter } from 'lucide-react';

export default function DataExplorerView({ observations, routes = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [selectedWindow, setSelectedWindow] = useState('ALL');
  const [minQuality, setMinQuality] = useState(0);

  // Extract unique route list from routes prop or observations
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
    fees: 100,
    total_fare: 5150 + i * 180,
    quality_score: 95 - (i % 3) * 5,
    quality_flag: 'EXCELLENT',
    source: 'Direct Airline API',
    status: 'AVAILABLE'
  }));

  const filtered = sampleObs.filter((o) => {
    const matchesSearch = !searchTerm || o.flight_number.toLowerCase().includes(searchTerm.toLowerCase()) || o.route.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoute = selectedRoute === 'ALL' || o.route === selectedRoute;
    const matchesAirline = selectedAirline === 'ALL' || o.airline === selectedAirline;
    const matchesWindow = selectedWindow === 'ALL' || o.booking_window === selectedWindow;
    const matchesQuality = (o.quality_score || 100) >= minQuality;
    return matchesSearch && matchesRoute && matchesAirline && matchesWindow && matchesQuality;
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
      {/* Search & Export Toolbar */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search flight, corridor, airline..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-navy-950 border border-navy-700 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="bg-navy-950 border border-navy-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium max-w-[220px] truncate"
          >
            <option value="ALL">All Corridors ({uniqueRoutesList.length})</option>
            {uniqueRoutesList.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select value={selectedAirline} onChange={(e) => setSelectedAirline(e.target.value)} className="bg-navy-950 border border-navy-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium">
            <option value="ALL">All Airlines</option>
            <option value="IndiGo">IndiGo</option>
            <option value="Air India">Air India</option>
            <option value="Air India Express">Air India Express</option>
            <option value="Akasa Air">Akasa Air</option>
          </select>
        </div>

        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Raw Data Table */}
      <div className="glass-card p-6 rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-navy-800">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Database className="w-4 h-4 text-purple-400" />
            <span>Standardized Observation Registry ({filtered.length} records)</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">Total: {sampleObs.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-navy-950 border-b border-navy-800 text-slate-400">
                <th className="p-3">ID</th>
                <th className="p-3">Corridor</th>
                <th className="p-3">Airline</th>
                <th className="p-3">Flight</th>
                <th className="p-3">Window</th>
                <th className="p-3">Base Fare</th>
                <th className="p-3">Taxes</th>
                <th className="p-3 font-bold text-white">Total Fare</th>
                <th className="p-3">QA Score</th>
                <th className="p-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-navy-850/50">
                  <td className="p-3 text-slate-400">{row.id}</td>
                  <td className="p-3 font-bold text-white">{row.route}</td>
                  <td className="p-3 text-slate-300 font-sans">{row.airline}</td>
                  <td className="p-3 text-blue-400">{row.flight_number}</td>
                  <td className="p-3 text-amber-400">{row.booking_window}</td>
                  <td className="p-3 text-slate-400">₹{row.base_fare ? row.base_fare.toLocaleString('en-IN') : 'N/A'}</td>
                  <td className="p-3 text-slate-400">₹{row.taxes ? row.taxes.toLocaleString('en-IN') : 'N/A'}</td>
                  <td className="p-3 font-bold text-white">₹{row.total_fare.toLocaleString('en-IN')}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      {row.quality_score}/100
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
