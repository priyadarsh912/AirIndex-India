import React, { useState } from 'react';
import FareBreakdownModal from './FareBreakdownModal';
import SCRAPED_OBSERVATIONS from '../data/scrapedObservations.json';

export default function DataExplorerView({ observations, routes = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [selectedWindow, setSelectedWindow] = useState('ALL');
  const [selectedCabin, setSelectedCabin] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState('ALL');
  const [selectedQuality, setSelectedQuality] = useState('ALL');
  const [activeModalObs, setActiveModalObs] = useState(null);

  // Always fallback to real scraped dataset if prop is empty
  const allObs = (observations && observations.length > 0) ? observations : SCRAPED_OBSERVATIONS;

  // Extract unique filter options dynamically from authentic scraped observations
  const uniqueRoutesList = (routes && routes.length > 0)
    ? Array.from(new Set(routes.map(r => typeof r === 'string' ? r : (r.route || r.code)))).filter(Boolean).sort()
    : Array.from(new Set(allObs.map(o => o.route))).filter(Boolean).sort();

  const uniqueAirlinesList = Array.from(new Set(allObs.map(o => o.airline).filter(Boolean))).sort();
  const uniqueWindowsList = Array.from(new Set(allObs.map(o => o.booking_window || o.window).filter(Boolean))).sort();
  const uniqueDatesList = Array.from(new Set(allObs.map(o => o.travel_date || o.capture_date).filter(Boolean))).sort();

  const filtered = allObs.filter((o) => {
    const matchesSearch = !searchTerm || 
      (o.flight_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (o.route || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.airline || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.fare_brand || o.fare_family || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRoute = selectedRoute === 'ALL' || o.route === selectedRoute;
    const matchesAirline = selectedAirline === 'ALL' || (o.airline || '').toLowerCase() === selectedAirline.toLowerCase();
    
    const windowVal = o.booking_window || o.window || '';
    const matchesWindow = selectedWindow === 'ALL' || windowVal === selectedWindow;
    
    const cabin = (o.cabin_class || 'ECONOMY').toUpperCase();
    const matchesCabin = selectedCabin === 'ALL' || cabin === selectedCabin;

    const avail = (o.availability_status || o.status || 'AVAILABLE').toUpperCase();
    const matchesAvail = selectedAvailability === 'ALL' || avail === selectedAvailability;

    const dqs = (o.data_quality_status || (o.is_usable !== false ? 'VALID' : 'PARTIAL')).toUpperCase();
    const matchesQuality = selectedQuality === 'ALL' || dqs === selectedQuality;

    const obsDate = o.travel_date || o.capture_date || '';
    const matchesDate = selectedDate === 'ALL' || obsDate === selectedDate;

    return matchesSearch && matchesRoute && matchesAirline && matchesWindow && matchesCabin && matchesAvail && matchesQuality && matchesDate;
  });

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedRoute('ALL');
    setSelectedAirline('ALL');
    setSelectedWindow('ALL');
    setSelectedCabin('ALL');
    setSelectedDate('ALL');
    setSelectedAvailability('ALL');
    setSelectedQuality('ALL');
  };

  const exportCSV = () => {
    const headers = ['ID', 'CaptureDate', 'TravelDate', 'Route', 'Airline', 'Flight', 'Window', 'Cabin', 'FareFamily', 'BaseFare', 'Taxes', 'ConvenienceFee', 'TotalFare', 'Availability', 'QualityStatus', 'QualityScore', 'Source'];
    const rows = filtered.map((o) => [
      o.id || o.observation_id,
      o.capture_date || o.timestamp,
      o.travel_date || o.capture_date,
      o.route,
      o.airline,
      o.flight_number,
      o.booking_window || o.window,
      o.cabin_class || 'ECONOMY',
      o.fare_family || 'UNKNOWN',
      o.base_fare ?? '',
      o.taxes ?? '',
      o.convenience_fee ?? o.fees ?? '',
      o.total_fare ?? '',
      o.availability_status || o.status || 'AVAILABLE',
      o.data_quality_status || 'VALID',
      o.quality_score || 95,
      o.source
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AirScope_Fare_Ledger_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = selectedRoute !== 'ALL' || selectedAirline !== 'ALL' || selectedWindow !== 'ALL' || selectedCabin !== 'ALL' || selectedDate !== 'ALL' || selectedAvailability !== 'ALL' || selectedQuality !== 'ALL' || searchTerm !== '';

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-surface-card p-5 rounded-xl border border-border-hairline shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search flight number, corridor, carrier, or fare brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-border-focus font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 bg-surface-subtle hover:bg-surface-canvas text-text-secondary font-medium text-xs rounded-lg border border-border-hairline transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                <span>Reset Filters</span>
              </button>
            )}

            <button
              onClick={exportCSV}
              className="px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Audited CSV ({filtered.length})</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2 border-t border-border-hairline text-xs font-medium">
          {/* Corridor / Route Filter */}
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 truncate"
          >
            <option value="ALL">All Corridors ({uniqueRoutesList.length})</option>
            {uniqueRoutesList.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Airline Filter */}
          <select 
            value={selectedAirline} 
            onChange={(e) => setSelectedAirline(e.target.value)} 
            className="bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5"
          >
            <option value="ALL">All Airlines ({uniqueAirlinesList.length})</option>
            {uniqueAirlinesList.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Booking Window Filter */}
          <select 
            value={selectedWindow} 
            onChange={(e) => setSelectedWindow(e.target.value)} 
            className="bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5"
          >
            <option value="ALL">All Windows</option>
            {uniqueWindowsList.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {/* Cabin Class Filter */}
          <select 
            value={selectedCabin} 
            onChange={(e) => setSelectedCabin(e.target.value)} 
            className="bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5"
          >
            <option value="ALL">All Cabin Classes</option>
            <option value="ECONOMY">Economy</option>
            <option value="PREMIUM_ECONOMY">Premium Economy</option>
            <option value="BUSINESS">Business Class</option>
          </select>

          {/* Travel / Observation Date Filter */}
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5"
          >
            <option value="ALL">All Travel Dates ({uniqueDatesList.length})</option>
            {uniqueDatesList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Availability Status Filter */}
          <select 
            value={selectedAvailability} 
            onChange={(e) => setSelectedAvailability(e.target.value)} 
            className="bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5"
          >
            <option value="ALL">All Availability</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="SOLD_OUT">Sold Out</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Data Quality Filter */}
          <select 
            value={selectedQuality} 
            onChange={(e) => setSelectedQuality(e.target.value)} 
            className="bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5"
          >
            <option value="ALL">All Data Quality</option>
            <option value="VALID">Valid (100% Complete)</option>
            <option value="PARTIAL">Partial (Some Undisclosed)</option>
            <option value="INVALID">Invalid (Mismatch)</option>
          </select>
        </div>
      </div>

      {/* Observations Table Card */}
      <div className="bg-surface-card rounded-xl border border-border-hairline p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center pb-3 border-b border-border-hairline gap-2">
          <div>
            <h3 className="font-headline text-base font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">database</span>
              <span>Raw Observations & Fare Breakdown Ledger ({filtered.length} of {allObs.length} records)</span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Authentic scraped domestic airfare data. Click any row to view unbundled taxes, surcharges, and audit metrics.
            </p>
          </div>
          <span className="text-xs text-text-muted font-medium bg-surface-subtle px-3 py-1 rounded-full border border-border-hairline">
            Click row for itemized tax & fee modal
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-surface-subtle/50 rounded-lg border border-dashed border-border-hairline">
            <span className="material-symbols-outlined text-text-muted text-[40px]">find_in_page</span>
            <h4 className="font-headline text-sm font-bold text-text-primary">No observations found matching criteria</h4>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              No flight quotes recorded for corridor <strong className="text-text-primary">{selectedRoute}</strong> {selectedAirline !== 'ALL' ? `on ${selectedAirline}` : ''} {selectedDate !== 'ALL' ? `for date ${selectedDate}` : ''}.
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-primary text-on-primary font-semibold text-xs rounded-lg hover:bg-primary/90 transition-all inline-flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-subtle text-text-muted uppercase text-[10px] font-semibold border-b border-border-hairline">
                  <th className="py-2.5 px-3">Flight / Corridor</th>
                  <th className="py-2.5 px-3">Carrier</th>
                  <th className="py-2.5 px-3">Travel Date</th>
                  <th className="py-2.5 px-3">Window</th>
                  <th className="py-2.5 px-3">Fare Family</th>
                  <th className="py-2.5 px-3">Availability</th>
                  <th className="py-2.5 px-3 text-right">Base Fare</th>
                  <th className="py-2.5 px-3 text-right">Taxes</th>
                  <th className="py-2.5 px-3 text-right">Total Fare</th>
                  <th className="py-2.5 px-3 text-center">Fee Basis</th>
                  <th className="py-2.5 px-3 text-center">Quality</th>
                  <th className="py-2.5 px-3">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline">
                {filtered.map((o, idx) => {
                  const isAvail = (o.availability_status || o.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE';
                  const isSoldOut = (o.availability_status || o.status || '').toUpperCase() === 'SOLD_OUT';
                  const isCancel = (o.availability_status || o.status || '').toUpperCase() === 'CANCELLED';
                  const dqs = (o.data_quality_status || (o.is_usable !== false ? 'VALID' : 'PARTIAL')).toUpperCase();

                  const travelDate = o.travel_date || o.capture_date || 'N/A';
                  const windowLabel = o.booking_window || o.window || 'T+7';

                  return (
                    <tr 
                      key={o.id || o.observation_id || idx} 
                      onClick={() => setActiveModalObs(o)}
                      className="hover:bg-primary/5 transition-colors cursor-pointer group"
                      title="Click to view detailed itemized breakdown"
                    >
                      <td className="py-3 px-3">
                        <span className="font-headline font-bold text-primary group-hover:underline block">
                          {o.route}
                        </span>
                        <span className="font-mono text-[10px] text-text-muted">{o.flight_number || 'AI-FLT'}</span>
                      </td>

                      <td className="py-3 px-3 font-medium text-text-primary">
                        {o.airline}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-text-secondary">
                        {travelDate}
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle text-text-secondary border border-border-hairline">
                          {windowLabel}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[11px] font-medium text-text-primary block">
                          {o.fare_brand || (o.fare_family ? `${o.cabin_class || 'Economy'} ${o.fare_family}` : (o.fare_class || 'Economy Standard'))}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">{o.cabin_class || 'ECONOMY'}</span>
                      </td>

                      <td className="py-3 px-3">
                        {isAvail ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Available
                          </span>
                        ) : isSoldOut ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Sold Out
                          </span>
                        ) : isCancel ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            Cancelled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">
                            Unavailable
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right text-text-muted tabular-nums font-mono">
                        {o.base_fare != null ? `₹${Math.round(o.base_fare).toLocaleString('en-IN')}` : <em className="text-text-muted/60 text-[10px]">Undisclosed</em>}
                      </td>

                      <td className="py-3 px-3 text-right text-text-muted tabular-nums font-mono">
                        {o.taxes != null ? `₹${Math.round(o.taxes).toLocaleString('en-IN')}` : <em className="text-text-muted/60 text-[10px]">Undisclosed</em>}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-text-primary tabular-nums font-mono">
                        {isAvail && o.total_fare != null ? (
                          `₹${Math.round(o.total_fare).toLocaleString('en-IN')}`
                        ) : (
                          <span className="text-[10px] font-normal text-text-muted">N/A</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                          o.fee_basis === 'reported' 
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                            : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                        }`}>
                          {o.fee_basis || 'derived'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          dqs === 'VALID' ? 'bg-badge-positive-bg text-metric-positive' :
                          dqs === 'PARTIAL' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          'bg-badge-negative-bg text-metric-negative'
                        }`}>
                          {dqs}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[11px] font-medium">
                        {o.source === 'LIVE_API' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                            LIVE API
                          </span>
                        ) : o.source === 'LIVE_SCRAPE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 border border-blue-500/30">
                            SCRAPE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                            FIXTURE
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Itemized Fare Breakdown & Audit Modal */}
      {activeModalObs && (
        <FareBreakdownModal 
          observation={activeModalObs} 
          onClose={() => setActiveModalObs(null)} 
        />
      )}
    </div>
  );
}
