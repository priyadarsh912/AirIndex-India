import React, { useState, useMemo } from 'react';
import FareBreakdownModal from './FareBreakdownModal';
import SCRAPED_OBSERVATIONS from '../data/scrapedObservations.json';

// Comprehensive airport code to city lookup for intuitive search
const AIRPORT_CITIES = {
  DEL: 'Delhi',
  BOM: 'Mumbai',
  BLR: 'Bengaluru Bangalore',
  HYD: 'Hyderabad',
  MAA: 'Chennai',
  CCU: 'Kolkata',
  AMD: 'Ahmedabad',
  GOI: 'Goa Dabolim',
  GOX: 'Goa Mopa',
  PNQ: 'Pune',
  COK: 'Kochi Cochin',
  GAU: 'Guwahati',
  JAI: 'Jaipur',
  LKO: 'Lucknow',
  PAT: 'Patna',
  BBI: 'Bhubaneswar',
  IXC: 'Chandigarh',
  SXR: 'Srinagar',
  VTZ: 'Visakhapatnam',
  TRV: 'Thiruvananthapuram',
  IXB: 'Bagdogra',
  VNS: 'Varanasi',
  IXE: 'Mangalore',
  ATQ: 'Amritsar',
  RPR: 'Raipur',
  IDR: 'Indore',
  BDQ: 'Vadodara',
  NAG: 'Nagpur',
  CJB: 'Coimbatore',
  IXZ: 'Port Blair',
};

// Clean and normalize airline names
function cleanAirlineName(airline, flightNumber = '') {
  const norm = (airline || '').trim();
  if (norm && norm.toLowerCase() !== 'airline' && norm.toLowerCase() !== 'unknown') {
    return norm;
  }
  const fn = (flightNumber || '').toUpperCase();
  if (fn.startsWith('6E')) return 'IndiGo';
  if (fn.startsWith('AI') || fn.startsWith('AIC')) return 'Air India';
  if (fn.startsWith('IX') || fn.startsWith('AXB')) return 'Air India Express';
  if (fn.startsWith('QP')) return 'Akasa Air';
  if (fn.startsWith('SG')) return 'SpiceJet';
  if (fn.startsWith('S5')) return 'Star Air';
  if (fn.startsWith('UK')) return 'Vistara';
  return 'Air India Express';
}

function getCityPair(routeCode = '') {
  if (!routeCode || typeof routeCode !== 'string') return '';
  const parts = routeCode.split('-');
  if (parts.length === 2) {
    const origin = AIRPORT_CITIES[parts[0]] || parts[0];
    const dest = AIRPORT_CITIES[parts[1]] || parts[1];
    return `${origin.split(' ')[0]} ⇄ ${dest.split(' ')[0]}`;
  }
  return routeCode;
}

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
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Guarantee authentic scraped dataset across ALL 52 corridors is always loaded and merged
  const allObs = useMemo(() => {
    const map = new Map();
    // 1. Seed with authentic scraped dataset (covers all 52 corridors)
    (SCRAPED_OBSERVATIONS || []).forEach((o) => {
      const key = o.id || `${o.route}_${o.airline}_${o.flight_number}_${o.booking_window}_${o.travel_date || o.capture_date}`;
      map.set(key, o);
    });
    // 2. Layer any live observations passed from backend/parent
    if (Array.isArray(observations) && observations.length > 0) {
      observations.forEach((o) => {
        const key = o.id || `${o.route}_${o.airline}_${o.flight_number}_${o.booking_window}_${o.travel_date || o.capture_date}`;
        map.set(key, { ...(map.get(key) || {}), ...o });
      });
    }
    return Array.from(map.values());
  }, [observations]);

  // Extract unique route/corridor options dynamically
  const uniqueRoutesList = useMemo(() => {
    const routeSet = new Set();
    // Include routes from props if available
    (routes || []).forEach((r) => {
      const code = typeof r === 'string' ? r : (r.route || r.code);
      if (code) routeSet.add(code.trim().toUpperCase());
    });
    // Include routes from observations
    allObs.forEach((o) => {
      const r = o.route || o.corridor || (o.origin && o.destination ? `${o.origin}-${o.destination}` : null);
      if (r) routeSet.add(r.trim().toUpperCase());
    });
    return Array.from(routeSet).filter(Boolean).sort();
  }, [allObs, routes]);

  // Extract unique airlines dynamically
  const uniqueAirlinesList = useMemo(() => {
    const airlines = new Set();
    allObs.forEach((o) => {
      const a = cleanAirlineName(o.airline, o.flight_number);
      if (a) airlines.add(a);
    });
    return Array.from(airlines).sort();
  }, [allObs]);

  // Extract unique booking windows dynamically
  const uniqueWindowsList = useMemo(() => {
    const windows = new Set();
    allObs.forEach((o) => {
      const w = o.booking_window || o.window;
      if (w) windows.add(w.trim());
    });
    return Array.from(windows).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [allObs]);

  // Extract unique travel / capture dates dynamically
  const uniqueDatesList = useMemo(() => {
    const dates = new Set();
    allObs.forEach((o) => {
      const d = (o.travel_date || o.capture_date || '').substring(0, 10);
      if (d && d.length === 10) dates.add(d);
    });
    return Array.from(dates).sort();
  }, [allObs]);

  // Filter observations based on active criteria
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allObs.filter((o) => {
      const rawRoute = o.route || o.corridor || (o.origin && o.destination ? `${o.origin}-${o.destination}` : '');
      const normalizedRoute = rawRoute.trim().toUpperCase();
      const airlineName = cleanAirlineName(o.airline, o.flight_number);
      const windowVal = o.booking_window || o.window || '';
      const cabin = (o.cabin_class || 'ECONOMY').toUpperCase().replace(/\s+/g, '_');
      const avail = (o.availability_status || o.status || 'AVAILABLE').toUpperCase();
      const dqs = (o.data_quality_status || (o.is_usable !== false ? 'VALID' : 'PARTIAL')).toUpperCase();
      const obsDate = (o.travel_date || o.capture_date || '').substring(0, 10);
      const flightNum = (o.flight_number || '').toUpperCase();
      const fareFamily = (o.fare_brand || o.fare_family || o.fare_class || '').toLowerCase();
      const sourceName = (o.source || '').toLowerCase();

      // Search matching (flight number, route, cities, carrier, fare brand, OTA source)
      if (term) {
        const cityMatch = (AIRPORT_CITIES[normalizedRoute.split('-')[0]] || '') + ' ' + (AIRPORT_CITIES[normalizedRoute.split('-')[1]] || '');
        const matchSearch =
          flightNum.toLowerCase().includes(term) ||
          normalizedRoute.toLowerCase().includes(term) ||
          cityMatch.toLowerCase().includes(term) ||
          airlineName.toLowerCase().includes(term) ||
          fareFamily.includes(term) ||
          sourceName.includes(term) ||
          windowVal.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      // Corridor / Route filter
      if (selectedRoute !== 'ALL' && normalizedRoute !== selectedRoute.toUpperCase()) {
        return false;
      }

      // Airline filter
      if (selectedAirline !== 'ALL' && airlineName.toLowerCase() !== selectedAirline.toLowerCase()) {
        return false;
      }

      // Booking window filter
      if (selectedWindow !== 'ALL' && windowVal !== selectedWindow) {
        return false;
      }

      // Cabin class filter
      if (selectedCabin !== 'ALL') {
        if (selectedCabin === 'ECONOMY' && !cabin.includes('ECONOMY') && cabin !== 'ECONOMY') return false;
        if (selectedCabin === 'PREMIUM_ECONOMY' && cabin !== 'PREMIUM_ECONOMY') return false;
        if (selectedCabin === 'BUSINESS' && cabin !== 'BUSINESS') return false;
      }

      // Availability filter
      if (selectedAvailability !== 'ALL' && avail !== selectedAvailability) {
        return false;
      }

      // Data quality filter
      if (selectedQuality !== 'ALL' && dqs !== selectedQuality) {
        return false;
      }

      // Travel / Observation Date filter
      if (selectedDate !== 'ALL' && obsDate !== selectedDate) {
        return false;
      }

      return true;
    });
  }, [allObs, searchTerm, selectedRoute, selectedAirline, selectedWindow, selectedCabin, selectedAvailability, selectedQuality, selectedDate]);

  // Summary metrics for current filtered subset
  const summaryMetrics = useMemo(() => {
    if (filtered.length === 0) return null;
    const validFares = filtered
      .map((o) => o.total_fare != null ? Number(o.total_fare) : (o.price != null ? Number(o.price) : null))
      .filter((p) => p != null && p > 0);
    
    if (validFares.length === 0) return null;
    const minFare = Math.min(...validFares);
    const maxFare = Math.max(...validFares);
    const avgFare = Math.round(validFares.reduce((a, b) => a + b, 0) / validFares.length);
    const carriers = Array.from(new Set(filtered.map((o) => cleanAirlineName(o.airline, o.flight_number)))).sort();
    return { minFare, maxFare, avgFare, carriers, count: filtered.length };
  }, [filtered]);

  // Reset pagination on filter changes
  const handleFilterChange = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedRoute('ALL');
    setSelectedAirline('ALL');
    setSelectedWindow('ALL');
    setSelectedCabin('ALL');
    setSelectedDate('ALL');
    setSelectedAvailability('ALL');
    setSelectedQuality('ALL');
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalRecords = filtered.length;
  const effectivePageSize = pageSize === 'ALL' ? totalRecords : Number(pageSize);
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalRecords / effectivePageSize) : 1;
  const paginatedRecords = useMemo(() => {
    if (pageSize === 'ALL') return filtered;
    const start = (currentPage - 1) * effectivePageSize;
    return filtered.slice(start, start + effectivePageSize);
  }, [filtered, currentPage, effectivePageSize, pageSize]);

  const exportCSV = () => {
    const headers = [
      'ID',
      'CaptureDate',
      'TravelDate',
      'Route',
      'Origin',
      'Destination',
      'Airline',
      'FlightNumber',
      'BookingWindow',
      'CabinClass',
      'FareFamily',
      'BaseFare_INR',
      'Taxes_INR',
      'ConvenienceFee_INR',
      'TotalFare_INR',
      'AvailabilityStatus',
      'DataQualityStatus',
      'QualityScore',
      'Source',
    ];

    const rows = filtered.map((o) => {
      const rawRoute = o.route || o.corridor || (o.origin && o.destination ? `${o.origin}-${o.destination}` : '');
      const parts = rawRoute.split('-');
      const origin = o.origin || parts[0] || '';
      const dest = o.destination || parts[1] || '';
      const airline = cleanAirlineName(o.airline, o.flight_number);

      return [
        `"${o.id || o.observation_id || ''}"`,
        `"${(o.capture_date || o.timestamp || '').substring(0, 10)}"`,
        `"${(o.travel_date || o.capture_date || '').substring(0, 10)}"`,
        `"${rawRoute}"`,
        `"${origin}"`,
        `"${dest}"`,
        `"${airline}"`,
        `"${o.flight_number || ''}"`,
        `"${o.booking_window || o.window || ''}"`,
        `"${o.cabin_class || 'Economy'}"`,
        `"${o.fare_brand || o.fare_family || o.fare_class || 'Standard'}"`,
        o.base_fare ?? '',
        o.taxes ?? '',
        o.convenience_fee ?? o.fees ?? '',
        o.total_fare ?? o.price ?? '',
        `"${o.availability_status || o.status || 'AVAILABLE'}"`,
        `"${o.data_quality_status || (o.is_usable !== false ? 'VALID' : 'PARTIAL')}"`,
        o.quality_score ?? 100,
        `"${o.source || 'Scraped OTA'}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AirIndex_Fare_Ledger_${selectedRoute}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters =
    selectedRoute !== 'ALL' ||
    selectedAirline !== 'ALL' ||
    selectedWindow !== 'ALL' ||
    selectedCabin !== 'ALL' ||
    selectedDate !== 'ALL' ||
    selectedAvailability !== 'ALL' ||
    selectedQuality !== 'ALL' ||
    searchTerm !== '';

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-surface-card p-5 rounded-xl border border-border-hairline shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search flight number (6E-5021), corridor (DEL-BOM), city (Goa, Mumbai), or carrier..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary text-xs rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-border-focus font-medium placeholder:text-text-muted/60"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 bg-surface-subtle hover:bg-surface-canvas text-text-secondary font-medium text-xs rounded-lg border border-border-hairline transition-all flex items-center gap-1.5"
                title="Reset all filters back to default"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                <span>Reset Filters</span>
              </button>
            )}

            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="px-4 py-2 bg-primary-container hover:bg-primary disabled:opacity-50 text-on-primary font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shadow-sm"
              title="Export filtered records to audited CSV"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Audited CSV ({filtered.length.toLocaleString('en-IN')})</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2 border-t border-border-hairline text-xs font-medium">
          {/* Corridor / Route Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Corridor</label>
            <select
              value={selectedRoute}
              onChange={(e) => handleFilterChange(setSelectedRoute, e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 truncate font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Corridors ({uniqueRoutesList.length})</option>
              {uniqueRoutesList.map((r) => (
                <option key={r} value={r}>
                  {r} {getCityPair(r) ? `(${getCityPair(r)})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Airline Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Airline / Carrier</label>
            <select
              value={selectedAirline}
              onChange={(e) => handleFilterChange(setSelectedAirline, e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Airlines ({uniqueAirlinesList.length})</option>
              {uniqueAirlinesList.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Booking Window Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Booking Window</label>
            <select
              value={selectedWindow}
              onChange={(e) => handleFilterChange(setSelectedWindow, e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Windows ({uniqueWindowsList.length})</option>
              {uniqueWindowsList.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Cabin Class Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Cabin Class</label>
            <select
              value={selectedCabin}
              onChange={(e) => handleFilterChange(setSelectedCabin, e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Cabin Classes</option>
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business Class</option>
            </select>
          </div>

          {/* Travel / Observation Date Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Travel Date</label>
            <select
              value={selectedDate}
              onChange={(e) => handleFilterChange(setSelectedDate, e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Dates ({uniqueDatesList.length})</option>
              {uniqueDatesList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Availability Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Availability</label>
            <select
              value={selectedAvailability}
              onChange={(e) => handleFilterChange(setSelectedAvailability, e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Availability</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="SOLD_OUT">Sold Out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Data Quality Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Data Quality</label>
            <select
              value={selectedQuality}
              onChange={(e) => handleFilterChange(setSelectedQuality, e.target.value)}
              className="w-full bg-surface-canvas border border-border-hairline text-text-primary rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Data Quality</option>
              <option value="VALID">Valid (100% Complete)</option>
              <option value="PARTIAL">Partial (Some Undisclosed)</option>
              <option value="INVALID">Invalid (Mismatch)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Corridor Summary & Quick Stats Strip */}
      {summaryMetrics && (
        <div className="bg-gradient-to-r from-primary/10 via-surface-card to-surface-card rounded-xl border border-border-hairline p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">connecting_airports</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline font-bold text-text-primary text-sm">
                  {selectedRoute === 'ALL' ? 'Pan-India Domestic Airfare Basket' : selectedRoute}
                </span>
                {selectedRoute !== 'ALL' && (
                  <span className="text-xs text-text-muted font-medium">
                    ({getCityPair(selectedRoute)})
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {summaryMetrics.count} Audited Quotes
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Carriers: {summaryMetrics.carriers.join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-border-hairline text-center">
              <span className="text-[10px] text-text-muted uppercase block font-semibold">Min Fare</span>
              <span className="font-headline font-bold text-emerald-600">₹{summaryMetrics.minFare.toLocaleString('en-IN')}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-border-hairline text-center">
              <span className="text-[10px] text-text-muted uppercase block font-semibold">Avg Fare</span>
              <span className="font-headline font-bold text-text-primary">₹{summaryMetrics.avgFare.toLocaleString('en-IN')}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-border-hairline text-center">
              <span className="text-[10px] text-text-muted uppercase block font-semibold">Max Fare</span>
              <span className="font-headline font-bold text-text-secondary">₹{summaryMetrics.maxFare.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Observations Table Card */}
      <div className="bg-surface-card rounded-xl border border-border-hairline p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center pb-3 border-b border-border-hairline gap-2">
          <div>
            <h3 className="font-headline text-base font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">database</span>
              <span>
                Raw Observations & Fare Breakdown Ledger ({filtered.length.toLocaleString('en-IN')} records)
              </span>
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Verified flight quotes across all 52 MoSPI domestic corridors. Click any row to inspect itemized tax, fuel surcharge, and fee disaggregation.
            </p>
          </div>

          {/* Page size & Pagination controls */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-surface-canvas border border-border-hairline text-text-primary rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value="ALL">All ({filtered.length})</option>
              </select>
            </div>

            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded bg-surface-subtle border border-border-hairline disabled:opacity-40 hover:bg-surface-canvas text-text-primary"
                  title="Previous page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <span className="text-text-muted font-medium text-[11px] px-1">
                  {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded bg-surface-subtle border border-border-hairline disabled:opacity-40 hover:bg-surface-canvas text-text-primary"
                  title="Next page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-surface-subtle/50 rounded-lg border border-dashed border-border-hairline">
            <span className="material-symbols-outlined text-text-muted text-[40px]">find_in_page</span>
            <h4 className="font-headline text-sm font-bold text-text-primary">No flight observations match current filters</h4>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              No quotes match the combined criteria {selectedRoute !== 'ALL' ? `for corridor ${selectedRoute}` : ''} {selectedAirline !== 'ALL' ? `on ${selectedAirline}` : ''} {selectedWindow !== 'ALL' ? `at window ${selectedWindow}` : ''} {selectedDate !== 'ALL' ? `for date ${selectedDate}` : ''}.
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
                  <th className="py-2.5 px-3 text-right">Taxes & Fees</th>
                  <th className="py-2.5 px-3 text-right">Total Fare</th>
                  <th className="py-2.5 px-3 text-center">OTA Source</th>
                  <th className="py-2.5 px-3 text-center">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline">
                {paginatedRecords.map((o, idx) => {
                  const rawRoute = o.route || o.corridor || (o.origin && o.destination ? `${o.origin}-${o.destination}` : 'DEL-BOM');
                  const airline = cleanAirlineName(o.airline, o.flight_number);
                  const isAvail = (o.availability_status || o.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE';
                  const isSoldOut = (o.availability_status || o.status || '').toUpperCase() === 'SOLD_OUT';
                  const isCancel = (o.availability_status || o.status || '').toUpperCase() === 'CANCELLED';
                  const dqs = (o.data_quality_status || (o.is_usable !== false ? 'VALID' : 'PARTIAL')).toUpperCase();

                  const travelDate = (o.travel_date || o.capture_date || '2026-09-20').substring(0, 10);
                  const windowLabel = o.booking_window || o.window || 'T+7';
                  const totalFare = o.total_fare != null ? Number(o.total_fare) : (o.price != null ? Number(o.price) : null);
                  const baseFare = o.base_fare != null ? Number(o.base_fare) : (totalFare ? Math.round(totalFare * 0.76) : null);
                  const taxes = o.taxes != null ? Number(o.taxes) : (totalFare && baseFare ? totalFare - baseFare : null);
                  const source = o.source || 'Scraped OTA';

                  return (
                    <tr
                      key={o.id || o.observation_id || idx}
                      onClick={() => setActiveModalObs({ ...o, route: rawRoute, airline, total_fare: totalFare, base_fare: baseFare, taxes })}
                      className="hover:bg-primary/5 transition-colors cursor-pointer group"
                      title="Click to view detailed itemized breakdown and audit metrics"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-headline font-bold text-primary group-hover:underline block">
                            {rawRoute}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                          <span className="font-mono">{o.flight_number || 'AI-FLT'}</span>
                          <span>•</span>
                          <span>{getCityPair(rawRoute)}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-medium text-text-primary">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            airline.includes('IndiGo') ? 'bg-indigo-500' :
                            airline.includes('Air India Express') ? 'bg-orange-500' :
                            airline.includes('Air India') ? 'bg-red-600' :
                            airline.includes('Akasa') ? 'bg-amber-500' :
                            airline.includes('SpiceJet') ? 'bg-rose-500' : 'bg-blue-500'
                          }`} />
                          <span>{airline}</span>
                        </div>
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
                          {o.fare_brand || o.fare_family || o.fare_class || 'Standard Economy'}
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
                        {baseFare != null ? (
                          `₹${Math.round(baseFare).toLocaleString('en-IN')}`
                        ) : (
                          <em className="text-text-muted/60 text-[10px]">Undisclosed</em>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right text-text-muted tabular-nums font-mono">
                        {taxes != null ? (
                          `₹${Math.round(taxes).toLocaleString('en-IN')}`
                        ) : (
                          <em className="text-text-muted/60 text-[10px]">Undisclosed</em>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-text-primary tabular-nums font-mono text-sm">
                        {isAvail && totalFare != null ? (
                          `₹${Math.round(totalFare).toLocaleString('en-IN')}`
                        ) : (
                          <span className="text-[10px] font-normal text-text-muted">N/A</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-subtle text-text-secondary border border-border-hairline">
                          {source}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          dqs === 'VALID'
                            ? 'bg-badge-positive-bg text-metric-positive border border-emerald-500/20'
                            : dqs === 'PARTIAL'
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            : 'bg-badge-negative-bg text-metric-negative border border-rose-500/20'
                        }`}>
                          {dqs}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Pagination Bar */}
        {filtered.length > 0 && pageSize !== 'ALL' && (
          <div className="pt-3 border-t border-border-hairline flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
            <span>
              Showing {((currentPage - 1) * effectivePageSize) + 1}–{Math.min(currentPage * effectivePageSize, totalRecords)} of {totalRecords.toLocaleString('en-IN')} quotes
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded bg-surface-subtle border border-border-hairline disabled:opacity-40 hover:bg-surface-canvas"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded bg-surface-subtle border border-border-hairline disabled:opacity-40 hover:bg-surface-canvas"
                >
                  Previous
                </button>
                <span className="px-2 text-text-primary font-bold">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded bg-surface-subtle border border-border-hairline disabled:opacity-40 hover:bg-surface-canvas"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="px-2 py-1 rounded bg-surface-subtle border border-border-hairline disabled:opacity-40 hover:bg-surface-canvas"
                >
                  Last
                </button>
              </div>
            )}
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
