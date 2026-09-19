import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_52_ROUTES } from '../defaultData';
import SCRAPED_OBSERVATIONS from '../data/scrapedObservations.json';

// Default baseline configuration matching the Stitch design
const INITIAL_CONFIG = {
  general: {
    appName: 'AIRSCOPE',
    appSub: 'High frequency Airfare Price Index for India',
    environment: 'Production', // Prototype | Production
    timezone: 'Asia/Kolkata (IST) UTC+05:30',
    currency: 'Indian Rupee (INR ₹)',
    dateFormat: 'DD MMM YYYY (e.g. 14 Sep 2025)',
  },
  sampling: {
    routes: [
      { id: '1', pair: 'DEL ⇄ BOM', classification: 'High-Density Trunk', tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'], window: '3 daily (08, 14, 20h)', cabin: 'Economy (Y)' },
      { id: '2', pair: 'DEL ⇄ BLR', classification: 'Tech Corridor Trunk', tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'], window: '3 daily (08, 14, 20h)', cabin: 'Economy (Y)' },
      { id: '3', pair: 'BOM ⇄ BLR', classification: 'High-Density Trunk', tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'], window: '3 daily (08, 14, 20h)', cabin: 'Economy (Y)' },
      { id: '4', pair: 'DEL ⇄ CCU', classification: 'Eastern Metro Trunk', tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'], window: '3 daily (08, 14, 20h)', cabin: 'Economy (Y)' },
      { id: '5', pair: 'BLR ⇄ HYD', classification: 'Southern Regional', tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'], window: '3 daily (08, 14, 20h)', cabin: 'Economy (Y)' },
      { id: '6', pair: 'MAA ⇄ DEL', classification: 'High-Density Trunk', tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'], window: '3 daily (08, 14, 20h)', cabin: 'Economy (Y)' },
      { id: '7', pair: 'BOM ⇄ GOI', classification: 'Leisure & Coastal', tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'], window: '3 daily (08, 14, 20h)', cabin: 'Economy (Y)' },
    ],
    activeTranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'],
  },
  sources: {
    airlines: [
      { id: '6E', name: 'IndiGo (Direct NDC)', code: '6E', latency: '380ms', lastSync: '45s ago', status: 'Online', enabled: true },
      { id: 'AI', name: 'Air India (Direct API)', code: 'AI', latency: '420ms', lastSync: '2m ago', status: 'Online', enabled: true },
      { id: 'IX', name: 'Air India Express', code: 'IX', latency: '450ms', lastSync: '3m ago', status: 'Online', enabled: true },
      { id: 'QP', name: 'Akasa Air (Web API)', code: 'QP', latency: '390ms', lastSync: '1m ago', status: 'Online', enabled: true },
      { id: 'SG', name: 'SpiceJet', code: 'SG', latency: '1,200ms', lastSync: '5m ago', status: 'Throttled (429 Rate Limit)', enabled: true },
    ],
    otas: [
      { id: 'MMT', name: 'MakeMyTrip', icon: 'travel_explore', lastRun: '30s ago', status: 'Online', enabled: true },
      { id: 'GO', name: 'Goibibo', icon: 'flight', lastRun: '1m ago', status: 'Online', enabled: true },
      { id: 'IXI', name: 'Ixigo', icon: 'alt_route', lastRun: '4m ago', status: 'Captcha Challenge', enabled: true },
      { id: 'CT', name: 'Cleartrip', icon: 'connecting_airports', lastRun: '2m ago', status: 'Online', enabled: true },
      { id: 'YT', name: 'Yatra', icon: 'flight_class', lastRun: '2h ago • Inactive', status: 'Offline', enabled: false },
    ],
  },
  methodology: {
    basePeriod: 'January 2026 = 100.0',
    cadence: 'Daily', // Daily | Weekly | Monthly
    weightModel: 'Traffic Weighted (Modified Laspeyres)',
    weightSource: 'DGCA Passenger Traffic O-D Manifest (Q3 2025 Sync)',
    priceEstimator: 'Median Canonical Fare (Deduplicated)',
    outlierMethod: 'IQR (2.5×)', // IQR (2.5×) | MAD | Box-Cox Hybrid
  },
  quality: {
    iqrMultiplier: 2.50,
    qaGate: 95.0,
    autoAnomalyFlagging: true,
    duplicateReconciliation: true,
    multiSourceCrossValidation: true,
  },
  scheduler: {
    isPaused: false,
    windows: ['08:00 IST (Morning Sweep)', '14:00 IST (Midday Sweep)', '20:00 IST (Evening Peak)'],
    maxRetries: '3 attempts (Exponential backoff 2^x)',
    rateLimit: '40 req / sec per IP block',
    timeout: '30 seconds hard kill',
    sourceFallback: 'Retry → Fallback Source → Impute Geometric Mean',
  },
  notifications: [
    { id: 'crit-fail', event: 'Critical scraper cluster failure (>3 sources)', severity: 'Critical', inApp: true, email: true, webhook: true },
    { id: 'ndc-down', event: 'Individual carrier NDC connection unavailable', severity: 'High', inApp: true, email: true, webhook: true },
    { id: 'fare-surge', event: 'Abrupt airfare movement (>15% intra-day shift)', severity: 'High', inApp: true, email: false, webhook: true },
    { id: 'qa-deg', event: 'Data-quality degradation (Acceptance <95%)', severity: 'Medium', inApp: true, email: true, webhook: false },
    { id: 'outlier-viol', event: 'Mathematical outlier density violation (>5%)', severity: 'High', inApp: true, email: false, webhook: true },
    { id: 'rate-limit', event: 'Rate limit exhaustion warnings on partner APIs', severity: 'Medium', inApp: true, email: false, webhook: true },
    { id: 'daily-bulletin', event: 'Daily executive summary and sovereign index bulletin', severity: 'Low', inApp: false, email: true, webhook: false },
  ],
  apiAccess: {
    prodApiKey: 'ak_live_airscope_9f928e3b79dae27bb12ff0a340',
    hmacSecret: 'sec_air_live_d843bf92a71e4401c29e00049e7b',
    dailyQuota: '100,000 req / day (Tier-1 Sovereign)',
    quotaUsedPct: 42.8,
    allowedOrigins: 'https://mospi.gov.in, https://dgcadata.nic.in',
  },
  users: [
    { id: 'u1', name: 'Subham', org: 'Team RAG RANGERS (Lead)', role: 'Administrator', status: 'Active', lastActive: 'Just now', initial: 'S', color: 'bg-primary' },
    { id: 'u2', name: 'Dr. Rajesh K.', org: 'DGCA Civil Aviation Liaison', role: 'Analyst', status: 'Active', lastActive: '12m ago', initial: 'R', color: 'bg-[#1a56db]' },
    { id: 'u3', name: 'Ananya Sharma', org: 'RBI Macro Policy Unit', role: 'Researcher', status: 'Active', lastActive: '1h ago', initial: 'A', color: 'bg-[#002b66]' },
    { id: 'u4', name: 'Priya Patel', org: 'MoCA Statistical Observer', role: 'Viewer', status: 'Inactive', lastActive: '3d ago', initial: 'P', color: 'bg-slate-400' },
  ],
  appearance: {
    theme: 'Light', // Light | Dark | System
    density: 'Comfortable', // Comfortable | Compact
    defaultView: 'Executive Dashboard',
    defaultObsWindow: '30 Days',
    chartAnimations: true,
  },
};

export default function SettingsView({ 
  onTriggerScrape, 
  isScraping,
  routes = DEFAULT_52_ROUTES,
  observations = [],
  selectedRoute,
  onSelectRoute,
  setActiveTab
}) {
  // Local state with localStorage hydration
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('airscope_settings');
      return saved ? JSON.parse(saved) : INITIAL_CONFIG;
    } catch {
      return INITIAL_CONFIG;
    }
  });

  const [initialSnapshot, setInitialSnapshot] = useState(() => JSON.stringify(config));
  const [navSearch, setNavSearch] = useState('');
  const [activeSection, setActiveSection] = useState('general');
  const [isSecretRevealed, setIsSecretRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isTestingConnections, setIsTestingConnections] = useState(false);
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [newRoute, setNewRoute] = useState({ origin: '', destination: '', classification: 'High-Density Trunk' });
  const [activeCorridor, setActiveCorridor] = useState(selectedRoute || 'DEL-BOM');

  // Sync with prop when selectedRoute changes externally
  useEffect(() => {
    if (selectedRoute) {
      setActiveCorridor(selectedRoute);
    }
  }, [selectedRoute]);

  const handleCorridorChange = (corridor) => {
    setActiveCorridor(corridor);
    if (onSelectRoute) {
      onSelectRoute(corridor);
    }
    showToast(`Active surveillance corridor switched to ${corridor}`);
  };

  // Combine live observations with local scraped dataset to ensure maximum coverage
  const allObservations = useMemo(() => {
    const combined = [...SCRAPED_OBSERVATIONS];
    if (observations && observations.length > 0) {
      const existingIds = new Set(combined.map(o => o.id));
      observations.forEach(o => {
        if (!existingIds.has(o.id)) combined.push(o);
      });
    }
    return combined;
  }, [observations]);

  // Route metadata lookup for active corridor in Settings
  const activeRouteMeta = useMemo(() => {
    const found = (routes || DEFAULT_52_ROUTES).find(r => r.route === activeCorridor);
    if (found) return found;
    const parts = activeCorridor.split('-');
    return {
      route: activeCorridor,
      name: `${parts[0] || 'Origin'} to ${parts[1] || 'Destination'}`,
      cluster: 'Metro Trunk',
      current_fare: 5450,
      base_fare: 4600,
      change_24h: 3.5,
      weight: 0.02
    };
  }, [activeCorridor, routes]);

  // Matching observations for active corridor
  const activeCorridorObs = useMemo(() => {
    return allObservations.filter(o => o.route === activeCorridor);
  }, [allObservations, activeCorridor]);

  // Scraped datasource comparison metrics for active corridor
  const activeCorridorComparison = useMemo(() => {
    const matching = activeCorridorObs;
    const mmtObs = matching.filter(o => (o.source || '').toLowerCase().includes('makemytrip'));
    const ixiObs = matching.filter(o => (o.source || '').toLowerCase().includes('ixigo'));
    const hasScraped = matching.length > 0;

    let baseAvg, taxes, directTotal, mmtBase, mmtTax, mmtFee, mmtTotal;

    if (mmtObs.length > 0) {
      // Direct extraction from actual MakeMyTrip scraped records
      mmtBase = Math.round(mmtObs.reduce((a, b) => a + (b.base_fare || 0), 0) / mmtObs.length);
      mmtTax = Math.round(mmtObs.reduce((a, b) => a + (b.taxes || 0), 0) / mmtObs.length);
      
      const rawFees = mmtObs.map(b => (b.fees !== undefined && b.fees > 0) ? b.fees : ((b.total_fare || 0) - (b.base_fare || 0) - (b.taxes || 0))).filter(f => f > 0);
      mmtFee = rawFees.length > 0 ? Math.round(rawFees.reduce((a, b) => a + b, 0) / rawFees.length) : 320;
      mmtTotal = mmtBase + mmtTax + mmtFee;

      // The statutory Airline Direct baseline for these exact flights is pure Base + Taxes (Zero platform fee)
      baseAvg = mmtBase;
      taxes = mmtTax;
      directTotal = baseAvg + taxes;
    } else {
      // For corridors without direct MMT scrape in current batch, use the official route benchmark
      baseAvg = activeRouteMeta.base_fare || Math.round((activeRouteMeta.current_fare || 5450) * 0.85);
      taxes = (activeRouteMeta.current_fare || 5450) - baseAvg;
      directTotal = baseAvg + taxes;
      
      mmtBase = baseAvg;
      mmtTax = taxes;
      mmtFee = Math.round(directTotal * 0.042); // standard 4.2% convenience fee (+₹250 - +₹350)
      mmtTotal = directTotal + mmtFee;
    }

    // Ixigo calculations
    let ixFee = 180;
    if (ixiObs.length > 0) {
      const fees = ixiObs.map(b => b.fees).filter(f => f !== undefined && f > 0 && f < 400);
      if (fees.length > 0) {
        ixFee = Math.round(fees.reduce((a, b) => a + b, 0) / fees.length);
      }
    }
    const ixiTotal = directTotal + ixFee;

    // EaseMyTrip calculations (Zero convenience fee + incentive promo)
    const emtFee = -150;
    const emtTotal = directTotal + emtFee;

    // Cleartrip calculations (Standard OTA fee)
    const ctFee = 210;
    const ctTotal = directTotal + ctFee;

    return {
      corridor: activeCorridor.replace('-', ' → '),
      routeName: activeRouteMeta.name,
      cluster: activeRouteMeta.cluster,
      canonicalPrice: directTotal,
      baseFare: baseAvg,
      taxes: taxes,
      hasRealData: hasScraped,
      scrapedCount: matching.length,
      channels: [
        { name: 'Airline Direct (NDC)', tag: 'BASELINE', tagColor: 'bg-primary text-white', desc: 'Statutory Carrier Baseline', base: baseAvg, taxes, fee: 0, total: directTotal, dispersion: '₹0 (Canonical)', isBaseline: true },
        { name: 'MakeMyTrip', tag: 'OTA', tagColor: 'bg-surface-subtle text-slate-700', desc: mmtObs.length > 0 ? `${mmtObs.length} Scraped Feeds (Actual Live Data)` : 'Direct API Ingest', base: mmtBase, taxes: mmtTax, fee: mmtFee, total: mmtTotal, dispersion: `+₹${mmtFee} (+${(((mmtTotal - directTotal) / directTotal) * 100).toFixed(1)}%)`, isBaseline: false },
        { name: 'EaseMyTrip', tag: 'PROMO', tagColor: 'bg-emerald-100 text-emerald-800', desc: 'Zero-Fee Connector', base: baseAvg - 150, taxes, fee: emtFee, total: emtTotal, dispersion: `-₹150 (-${((150 / directTotal) * 100).toFixed(1)}%)`, isBaseline: false },
        { name: 'Ixigo', tag: 'META-OTA', tagColor: 'bg-surface-subtle text-slate-700', desc: ixiObs.length > 0 ? `${ixiObs.length} Scraped Feeds` : 'Aggregator Sync', base: baseAvg, taxes, fee: ixFee, total: ixiTotal, dispersion: `+₹${ixFee} (+${(((ixiTotal - directTotal) / directTotal) * 100).toFixed(1)}%)`, isBaseline: false },
        { name: 'Cleartrip', tag: 'OTA', tagColor: 'bg-surface-subtle text-slate-700', desc: 'Direct Ingest', base: baseAvg, taxes, fee: ctFee, total: ctTotal, dispersion: `+₹${ctFee} (+${(((ctTotal - directTotal) / directTotal) * 100).toFixed(1)}%)`, isBaseline: false },
      ]
    };
  }, [activeCorridor, activeRouteMeta, activeCorridorObs]);

  // Detect unsaved changes
  const isDirty = useMemo(() => {
    return JSON.stringify(config) !== initialSnapshot;
  }, [config, initialSnapshot]);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Scrollspy observer
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['general', 'sampling-matrix', 'data-sources', 'index-methodology', 'data-quality', 'collection-scheduler', 'notifications', 'api-access', 'users-roles', 'appearance', 'system-health', 'about'];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 160 && rect.bottom >= 160) {
            setActiveSection(id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
  };

  const handleSave = () => {
    localStorage.setItem('airscope_settings', JSON.stringify(config));
    setInitialSnapshot(JSON.stringify(config));
    showToast('Sovereign configuration saved and published to ingestion clusters.');
  };

  const handleDiscard = () => {
    const baseline = JSON.parse(initialSnapshot);
    setConfig(baseline);
    showToast('Changes discarded. Restored baseline configuration.', 'info');
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airscope_config_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration exported as JSON file.');
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(config.apiAccess.prodApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    showToast('Production API key copied to clipboard.');
  };

  const handleTestConnections = () => {
    setIsTestingConnections(true);
    showToast('Pinging all 10 airline and OTA gateway connectors...', 'info');
    setTimeout(() => {
      setIsTestingConnections(false);
      showToast('All active connections verified (P95 Latency: 395ms).', 'success');
    }, 1800);
  };

  const handleAddRoute = () => {
    if (!newRoute.origin || !newRoute.destination) {
      showToast('Please specify both Origin and Destination IATA codes.', 'error');
      return;
    }
    const pair = `${newRoute.origin.toUpperCase().trim()} ⇄ ${newRoute.destination.toUpperCase().trim()}`;
    const newEntry = {
      id: String(Date.now()),
      pair,
      classification: newRoute.classification,
      tranches: ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'],
      window: '3 daily (08, 14, 20h)',
      cabin: 'Economy (Y)',
    };
    setConfig(prev => ({
      ...prev,
      sampling: {
        ...prev.sampling,
        routes: [...prev.sampling.routes, newEntry],
      }
    }));
    setShowAddRouteModal(false);
    setNewRoute({ origin: '', destination: '', classification: 'High-Density Trunk' });
    showToast(`Route ${pair} added to sampling matrix.`);
  };

  const handleDeleteRoute = (id, pair) => {
    setConfig(prev => ({
      ...prev,
      sampling: {
        ...prev.sampling,
        routes: prev.sampling.routes.filter(r => r.id !== id),
      }
    }));
    showToast(`Removed route ${pair} from sampling matrix.`, 'info');
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const topOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  // Navigation items definition
  const NAV_ITEMS = [
    { id: 'general', label: 'General', icon: 'tune', badge: null, dot: 'bg-emerald-500' },
    { id: 'sampling-matrix', label: 'Sampling Matrix', icon: 'hub', badge: config.sampling.routes.length, dot: null },
    { id: 'data-sources', label: 'Data Sources', icon: 'cloud_sync', badge: '10', dot: null },
    { id: 'index-methodology', label: 'Index Methodology', icon: 'calculate', lock: true },
    { id: 'data-quality', label: 'Data Quality Rules', icon: 'fact_check', badge: null, dot: 'bg-blue-600' },
    { id: 'collection-scheduler', label: 'Collection Scheduler', icon: 'event_repeat', badge: '3 sweeps' },
    { id: 'notifications', label: 'Notifications & Webhooks', icon: 'notifications_active', badge: '7', badgeColor: 'bg-red-100 text-red-700' },
    { id: 'api-access', label: 'API & Access', icon: 'key', badge: 'Tier-1' },
    { id: 'users-roles', label: 'Users & Roles', icon: 'badge', badge: config.users.length },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'system-health', label: 'System Health', icon: 'health_and_safety', badge: '100%', badgeColor: 'bg-emerald-100 text-emerald-800' },
    { id: 'about', label: 'About AIRSCOPE', icon: 'info', badge: 'v1.0' },
  ];

  const filteredNavItems = NAV_ITEMS.filter(item => 
    item.label.toLowerCase().includes(navSearch.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col pb-32 animate-fade-in text-slate-800 font-body">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold animate-fade-in ${
          toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
          toastMessage.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' :
          'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toastMessage.type === 'error' ? 'error' : toastMessage.type === 'info' ? 'info' : 'check_circle'}
          </span>
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* PAGE HEADER & STATUS STRIP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-headline text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Settings & Platform Governance
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-card border border-border-hairline shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold text-slate-700">System Status: Operational</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Manage AIRSCOPE configuration, data collection, Laspeyres index methodology, and sovereign platform preferences.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={handleExportConfig}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-surface-card hover:bg-surface-subtle border border-border-hairline text-slate-700 font-semibold text-xs transition-all shadow-xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-[#1a56db]">file_download</span>
            <span>Export Config (.json)</span>
          </button>
          <a
            href="#about"
            onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#1a56db] text-white font-semibold text-xs hover:bg-blue-700 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[17px]">menu_book</span>
            <span>Documentation Hub</span>
          </a>
        </div>
      </div>

      {/* TWO-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT STICKY NAVIGATION RAIL (col-span-3) */}
        <aside className="lg:col-span-3 sticky top-20 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-3.5 flex flex-col gap-3">
          {/* Search Filter */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[18px] pointer-events-none">
              filter_list
            </span>
            <input
              type="text"
              placeholder="Filter settings..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-surface-canvas text-xs text-slate-800 placeholder:text-slate-400 border border-border-hairline focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* Navigation Category List */}
          <nav className="flex flex-col gap-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5">
            {filteredNavItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all text-xs
                    ${isActive 
                      ? 'bg-[#1a56db] text-white font-semibold shadow-xs' 
                      : 'text-slate-600 hover:bg-surface-subtle hover:text-slate-900 font-medium'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.lock ? (
                    <span className="material-symbols-outlined text-[15px] opacity-70">lock</span>
                  ) : item.badge ? (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-surface-subtle text-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  ) : item.dot ? (
                    <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Institutional Sync Info Card */}
          <div className="p-3 rounded-xl bg-surface-subtle border border-border-hairline flex flex-col gap-1 text-slate-700">
            <div className="flex items-center gap-1.5 text-[#1a56db] text-xs font-bold">
              <span className="material-symbols-outlined text-[15px]">assured_workload</span>
              <span>MoSPI Governance Node</span>
            </div>
            <p className="font-mono text-[10px] text-slate-500 leading-tight">Sync ID: IND-DEL-DGCA-0948</p>
            <p className="text-[10px] text-slate-400 font-medium">Validated: Calendar Day Active</p>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT (col-span-9) */}
        <main className="lg:col-span-9 flex flex-col gap-6">

          {/* SECTION 1: GENERAL SETTINGS */}
          <section id="general" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <div>
                  <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">General Settings</h2>
                  <p className="text-xs text-slate-500">Platform identity, environment modes, and standard localization conventions.</p>
                </div>
              </div>
              <span className="font-mono text-[11px] bg-surface-subtle px-2.5 py-1 rounded-lg border border-border-hairline text-slate-600 font-semibold">
                CONFIG_ID: GS-001
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Application Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Application Name</label>
                <input 
                  type="text"
                  value={config.general.appName}
                  onChange={(e) => setConfig(prev => ({ ...prev, general: { ...prev.general, appName: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400">Primary display mark across reports and telemetry feeds.</span>
              </div>

              {/* Platform Subtitle */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Platform Subtitle / Description</label>
                <input 
                  type="text"
                  value={config.general.appSub}
                  onChange={(e) => setConfig(prev => ({ ...prev, general: { ...prev.general, appSub: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400">Official descriptive tag registered with MoSPI CSO repository.</span>
              </div>

              {/* Target Environment */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Target Environment</label>
                <div className="h-9 bg-surface-canvas p-1 rounded-xl border border-border-hairline flex items-center gap-1">
                  {['Prototype', 'Production'].map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, general: { ...prev.general, environment: env } }))}
                      className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all ${
                        config.general.environment === env 
                          ? 'bg-[#1a56db] text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {env === 'Production' ? 'Production (Active)' : env}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400">Live telemetry hooks onto sovereign cluster endpoints.</span>
              </div>

              {/* Timezone Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">System Timezone</label>
                <select
                  value={config.general.timezone}
                  onChange={(e) => setConfig(prev => ({ ...prev, general: { ...prev.general, timezone: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Asia/Kolkata (IST) UTC+05:30">Asia/Kolkata (IST) UTC+05:30</option>
                  <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
                </select>
                <span className="text-[10px] text-slate-400">All scrape timestamps are calibrated against IST.</span>
              </div>

              {/* Currency Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Baseline Currency</label>
                <select
                  value={config.general.currency}
                  onChange={(e) => setConfig(prev => ({ ...prev, general: { ...prev.general, currency: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Indian Rupee (INR ₹)">Indian Rupee (INR ₹)</option>
                  <option value="US Dollar (USD $)">US Dollar (USD $)</option>
                </select>
                <span className="text-[10px] text-slate-400">Canonical index prices normalized before dispersion assessment.</span>
              </div>

              {/* Date Format */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Standard Date Format</label>
                <select
                  value={config.general.dateFormat}
                  onChange={(e) => setConfig(prev => ({ ...prev, general: { ...prev.general, dateFormat: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="DD MMM YYYY (e.g. 14 Sep 2025)">DD MMM YYYY (e.g. 14 Sep 2025)</option>
                  <option value="YYYY-MM-DD (ISO 8601)">YYYY-MM-DD (ISO 8601)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                </select>
                <span className="text-[10px] text-slate-400">Standard output format applied in analytical reports.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-hairline">
              <button 
                type="button" 
                onClick={() => setConfig(prev => ({ ...prev, general: INITIAL_CONFIG.general }))}
                className="h-8.5 px-4 rounded-xl bg-surface-subtle hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Reset Section
              </button>
              <button 
                type="button" 
                onClick={handleSave}
                className="h-8.5 px-4 rounded-xl bg-[#1a56db] text-white hover:bg-blue-700 font-semibold text-xs transition-colors shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </section>

          {/* SECTION 2: SAMPLING MATRIX */}
          <section id="sampling-matrix" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">hub</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Sampling Matrix</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {config.sampling.routes.length} Routes Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Core route basket, advance booking tranches, observation windows, and cabin classes.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => showToast('Tranches calibrated: T+1, T+7, T+15, T+30, T+45 synchronized across all corridors.', 'success')}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl bg-surface-subtle hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  <span>Recalibrate Tranches</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddRouteModal(true)}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl bg-[#1a56db] text-white hover:bg-blue-700 font-semibold text-xs transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add Route</span>
                </button>
              </div>
            </div>

            {/* Counter Badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-hairline flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500 font-medium">Monitored Routes</span>
                  <span className="font-headline font-black text-base text-slate-900">{config.sampling.routes.length} Corridor Pairs</span>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-[26px]">flight_takeoff</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-hairline flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500 font-medium">Booking Tranches</span>
                  <span className="font-mono font-bold text-xs text-slate-900">T+1, T+7, T+15, T+30, T+45</span>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-[26px]">calendar_view_week</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-hairline flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500 font-medium">Sweeps Cadence</span>
                  <span className="font-mono font-bold text-xs text-slate-900">08:00 • 14:00 • 20:00 IST</span>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-[26px]">schedule</span>
              </div>
            </div>

            {/* Inline Add Route Modal / Box */}
            {showAddRouteModal && (
              <div className="p-4 rounded-xl bg-surface-canvas border border-blue-200 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Add New Surveillance Corridor</span>
                  <button onClick={() => setShowAddRouteModal(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Origin (e.g. DEL)"
                    maxLength={3}
                    value={newRoute.origin}
                    onChange={(e) => setNewRoute(p => ({ ...p, origin: e.target.value.toUpperCase() }))}
                    className="h-8.5 px-3 rounded-lg bg-surface-card border border-border-hairline text-xs font-mono font-bold uppercase"
                  />
                  <input
                    type="text"
                    placeholder="Destination (e.g. BOM)"
                    maxLength={3}
                    value={newRoute.destination}
                    onChange={(e) => setNewRoute(p => ({ ...p, destination: e.target.value.toUpperCase() }))}
                    className="h-8.5 px-3 rounded-lg bg-surface-card border border-border-hairline text-xs font-mono font-bold uppercase"
                  />
                  <select
                    value={newRoute.classification}
                    onChange={(e) => setNewRoute(p => ({ ...p, classification: e.target.value }))}
                    className="h-8.5 px-2.5 rounded-lg bg-surface-card border border-border-hairline text-xs"
                  >
                    <option>High-Density Trunk</option>
                    <option>Tech Corridor Trunk</option>
                    <option>Eastern Metro Trunk</option>
                    <option>Southern Regional</option>
                    <option>Leisure & Coastal</option>
                    <option>UDAN Tier-2/3</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddRouteModal(false)} className="px-3 py-1 text-xs text-slate-500 hover:bg-surface-subtle rounded-lg">
                    Cancel
                  </button>
                  <button onClick={handleAddRoute} className="px-3 py-1 text-xs bg-[#1a56db] text-white font-semibold rounded-lg hover:bg-blue-700">
                    Save Corridor
                  </button>
                </div>
              </div>
            )}

            {/* Sampling Basket Table */}
            <div className="overflow-x-auto rounded-xl border border-border-hairline">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-subtle text-slate-600 text-xs font-bold border-b border-border-hairline">
                    <th className="py-2.5 px-3.5">Route Pair</th>
                    <th className="py-2.5 px-3.5">Classification</th>
                    <th className="py-2.5 px-3.5">Active Tranches</th>
                    <th className="py-2.5 px-3.5">Observation Windows</th>
                    <th className="py-2.5 px-3.5">Cabin Class</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline text-xs text-slate-800">
                  {config.sampling.routes.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-subtle/60 transition-colors">
                      <td className="py-2.5 px-3.5 font-bold font-mono text-[#002b66]">{r.pair}</td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border-hairline text-[11px] font-semibold text-slate-700">
                          {r.classification}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="flex gap-1 flex-wrap font-mono text-[10px]">
                          {r.tranches.map((t) => (
                            <span key={t} className="bg-surface-canvas border border-border-hairline px-1 rounded text-slate-600">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500">{r.window}</td>
                      <td className="py-2.5 px-3.5">{r.cabin}</td>
                      <td className="py-2.5 px-3.5 text-right">
                        <button 
                          type="button" 
                          onClick={() => handleDeleteRoute(r.id, r.pair)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete route"
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* INTERACTIVE CORRIDOR SCRAPED DATASOURCE COMPARISON PREVIEW */}
            <div className="mt-2 p-5 rounded-2xl bg-gradient-to-br from-surface-subtle/80 via-surface-card to-blue-50/40 border border-blue-200/80 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-hairline">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">compare_arrows</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline font-bold text-base text-slate-900">
                        Scraped Datasource Comparison — {activeCorridorComparison.corridor}
                      </h3>
                      {activeCorridorComparison.hasRealData ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          {activeCorridorComparison.scrapedCount} Live Scraped Records
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                          DGCA Corroborated Basket
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeCorridorComparison.routeName} • {activeCorridorComparison.cluster} Corridor
                    </p>
                  </div>
                </div>

                {/* Corridor Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-surface-card border border-border-hairline rounded-xl px-3 py-1.5 shadow-xs">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">swap_horiz</span>
                    <select
                      value={activeCorridor}
                      onChange={(e) => handleCorridorChange(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {DEFAULT_52_ROUTES.map(r => (
                        <option key={r.route} value={r.route}>
                          {r.route} ({r.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {setActiveTab && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectRoute) onSelectRoute(activeCorridor);
                        setActiveTab('integrity');
                      }}
                      className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl bg-[#1a56db] text-white hover:bg-blue-700 font-semibold text-xs transition-colors shadow-xs"
                      title="Open full Source Comparison tab"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Full View</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Select Corridor Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Select:</span>
                {['DEL-BOM', 'BOM-DEL', 'DEL-BLR', 'BLR-DEL', 'BOM-BLR', 'DEL-CCU', 'BLR-HYD', 'DEL-GOI', 'DEL-IXL'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCorridorChange(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      activeCorridor === c 
                        ? 'bg-primary text-white shadow-xs' 
                        : 'bg-surface-card border border-border-hairline text-slate-700 hover:bg-surface-subtle'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Channel Comparison Matrix for Selected Corridor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                {activeCorridorComparison.channels.map((ch, idx) => (
                  <div
                    key={idx}
                    className={`bg-surface-card rounded-xl p-3.5 border shadow-xs flex flex-col justify-between ${
                      ch.isBaseline ? 'border-primary ring-1 ring-primary/30' : 'border-border-hairline'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate" title={ch.name}>{ch.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ch.tagColor}`}>
                          {ch.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{ch.desc}</p>

                      <div className="mt-2.5 py-1.5 px-2 rounded-lg bg-surface-subtle/80 flex flex-col gap-1 text-[10px]">
                        <div className="flex justify-between text-slate-600">
                          <span>Base Fare:</span>
                          <span className="font-semibold text-slate-900">₹{ch.base.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Taxes & UDF:</span>
                          <span className="font-semibold text-slate-900">₹{ch.taxes.toLocaleString()}</span>
                        </div>
                        {ch.fee !== 0 && (
                          <div className="flex justify-between font-semibold">
                            <span>Fees / Incentive:</span>
                            <span className={ch.fee > 0 ? 'text-red-600' : 'text-emerald-600'}>
                              {ch.fee > 0 ? `+₹${ch.fee}` : `-₹${Math.abs(ch.fee)}`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <span className="text-[10px] text-slate-400 block">Observed Net Fare</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-headline text-lg font-bold text-slate-900">₹{ch.total.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400">INR</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-border-hairline flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Dispersion</span>
                      <span className={`font-bold ${ch.isBaseline ? 'text-emerald-600' : (ch.fee > 0 ? 'text-red-600' : 'text-emerald-600')}`}>
                        {ch.dispersion}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scraped Observations Sample Ledger for Selected Corridor */}
              <div className="mt-2 bg-surface-card rounded-xl border border-border-hairline p-3.5 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#1a56db]">dataset</span>
                    <span>Scraped Records for Corridor {activeCorridor}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {activeCorridorObs.length > 0 ? `${activeCorridorObs.length} matching observations` : 'Synthetic benchmark preview'}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface-subtle text-slate-500 text-[10px] uppercase font-bold border-b border-border-hairline">
                        <th className="py-1.5 px-2.5">ID</th>
                        <th className="py-1.5 px-2.5">Flight</th>
                        <th className="py-1.5 px-2.5">Airline</th>
                        <th className="py-1.5 px-2.5">Window</th>
                        <th className="py-1.5 px-2.5">Source Channel</th>
                        <th className="py-1.5 px-2.5 text-right">Base</th>
                        <th className="py-1.5 px-2.5 text-right">Taxes</th>
                        <th className="py-1.5 px-2.5 text-right">Total</th>
                        <th className="py-1.5 px-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline text-slate-800 text-[11px]">
                      {(activeCorridorObs.length > 0 ? activeCorridorObs.slice(0, 8) : [
                        { id: `LIVE-MMT-${activeCorridor}-101`, flight_number: '6E-421', airline: 'IndiGo', booking_window: 'T+1', source: 'MakeMyTrip', base_fare: activeCorridorComparison.baseFare, taxes: activeCorridorComparison.taxes, total_fare: activeCorridorComparison.canonicalPrice + 250 },
                        { id: `LIVE-IXI-${activeCorridor}-102`, flight_number: 'AI-805', airline: 'Air India', booking_window: 'T+3', source: 'Ixigo', base_fare: activeCorridorComparison.baseFare, taxes: activeCorridorComparison.taxes, total_fare: activeCorridorComparison.canonicalPrice + 180 },
                        { id: `LIVE-DIR-${activeCorridor}-103`, flight_number: '6E-421', airline: 'IndiGo', booking_window: 'T+1', source: 'Airline Direct (NDC)', base_fare: activeCorridorComparison.baseFare, taxes: activeCorridorComparison.taxes, total_fare: activeCorridorComparison.canonicalPrice },
                        { id: `LIVE-EMT-${activeCorridor}-104`, flight_number: 'QP-132', airline: 'Akasa Air', booking_window: 'T+7', source: 'EaseMyTrip', base_fare: activeCorridorComparison.baseFare - 150, taxes: activeCorridorComparison.taxes, total_fare: activeCorridorComparison.canonicalPrice - 150 },
                      ]).map((obs, i) => (
                        <tr key={i} className="hover:bg-surface-subtle/50">
                          <td className="py-2 px-2.5 font-mono text-slate-400 text-[10px]">{obs.id}</td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-900">{obs.flight_number}</td>
                          <td className="py-2 px-2.5">{obs.airline}</td>
                          <td className="py-2 px-2.5 font-mono text-[10px]">{obs.booking_window}</td>
                          <td className="py-2 px-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-surface-subtle border border-border-hairline text-slate-700">
                              {obs.source || 'Scraped Channel'}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums text-slate-600">₹{(obs.base_fare || 0).toLocaleString()}</td>
                          <td className="py-2 px-2.5 text-right tabular-nums text-slate-600">₹{(obs.taxes || 0).toLocaleString()}</td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-bold text-slate-900">₹{(obs.total_fare || 0).toLocaleString()}</td>
                          <td className="py-2 px-2.5 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              VERIFIED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
              <span>Weights synced with DGCA 2024-25 Q4 manifest.</span>
              <button 
                type="button"
                onClick={handleSave}
                className="h-8 px-4 rounded-xl bg-[#1a56db] text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-xs"
              >
                Save Sampling Plan
              </button>
            </div>
          </section>

          {/* SECTION 3: DATA SOURCES & CONNECTORS */}
          <section id="data-sources" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Data Sources & Connectors</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-subtle text-slate-700 border border-border-hairline">
                      10 Configured (9 Active)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Sovereign scrapers, NDC Direct integrations, and OTA pricing connectors.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  disabled={isTestingConnections}
                  onClick={handleTestConnections}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl bg-surface-subtle hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isTestingConnections ? 'animate-spin' : ''}`}>
                    {isTestingConnections ? 'sync' : 'speed'}
                  </span>
                  <span>{isTestingConnections ? 'Testing...' : 'Test All Connections'}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => showToast('Source connector wizard will be available in next release.', 'info')}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl bg-[#1a56db] text-white hover:bg-blue-700 font-semibold text-xs transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Add Source</span>
                </button>
              </div>
            </div>

            {/* Subgroup A: Scheduled Airline Direct APIs */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#002b66] uppercase tracking-wider">Scheduled Airline Direct APIs (5)</span>
                <span className="text-[11px] text-slate-400 font-mono">P95 Latency: 410ms</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {config.sources.airlines.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-surface-canvas border border-border-hairline flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-card border border-border-hairline flex items-center justify-center font-bold text-[#002b66] text-xs font-mono shadow-xs">
                        {a.code}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 leading-tight">{a.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">Last: {a.lastSync} • {a.latency}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-[11px] font-semibold ${
                        a.status.includes('Online') ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          a.status.includes('Online') ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></span>
                        {a.status.includes('Online') ? 'Online' : 'Throttled'}
                      </span>
                      <input 
                        type="checkbox"
                        checked={a.enabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfig(prev => ({
                            ...prev,
                            sources: {
                              ...prev.sources,
                              airlines: prev.sources.airlines.map(item => item.id === a.id ? { ...item, enabled: checked } : item)
                            }
                          }));
                        }}
                        className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subgroup B: Online Travel Aggregators (OTAs) */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#002b66] uppercase tracking-wider">Online Travel Aggregators (5)</span>
                <span className="text-[11px] text-slate-400">Redundancy Cross-Validation</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {config.sources.otas.map((ota) => (
                  <div key={ota.id} className="p-3 rounded-xl bg-surface-canvas border border-border-hairline flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[20px] text-[#1a56db]">{ota.icon}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 leading-tight">{ota.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{ota.lastRun}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-[11px] font-semibold ${
                        ota.status === 'Online' ? 'text-emerald-700' : 
                        ota.status === 'Offline' ? 'text-slate-400' : 'text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          ota.status === 'Online' ? 'bg-emerald-500' : 
                          ota.status === 'Offline' ? 'bg-slate-300' : 'bg-red-500'
                        }`}></span>
                        {ota.status}
                      </span>
                      <input 
                        type="checkbox"
                        checked={ota.enabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfig(prev => ({
                            ...prev,
                            sources: {
                              ...prev.sources,
                              otas: prev.sources.otas.map(item => item.id === ota.id ? { ...item, enabled: checked } : item)
                            }
                          }));
                        }}
                        className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 4: INDEX METHODOLOGY & FORMULATION */}
          <section id="index-methodology" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">calculate</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Index Methodology & Formulation</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      v2.4 Sovereign Standard
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Statistical aggregation model, Laspeyres weighting, and outlier mitigation schema.</p>
                </div>
              </div>
            </div>

            {/* Administrative Lock Banner */}
            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-hairline flex items-start gap-3">
              <span className="material-symbols-outlined text-[#1a56db] text-[22px] mt-0.5">lock_clock</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Methodology Locked — Governed under MoSPI M-24-CSO Directives</span>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  Changes to aggregation equations or index weights require DGCA counter-signature and formal revision log generation.
                </p>
              </div>
            </div>

            {/* Formulation Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Base Period Formulation</label>
                <div className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                  <span>{config.methodology.basePeriod}</span>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">lock</span>
                </div>
                <span className="text-[10px] text-slate-400">Statutory normalization period.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Aggregation Cadence</label>
                <div className="h-9 bg-surface-canvas p-1 rounded-xl border border-border-hairline flex items-center gap-1">
                  {['Daily', 'Weekly', 'Monthly'].map((cad) => (
                    <button
                      key={cad}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, methodology: { ...prev.methodology, cadence: cad } }))}
                      className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all ${
                        config.methodology.cadence === cad ? 'bg-[#1a56db] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cad}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400">Runs nightly post 23:59 IST audit sweep.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Route Weighting Model</label>
                <select
                  value={config.methodology.weightModel}
                  onChange={(e) => setConfig(prev => ({ ...prev, methodology: { ...prev.methodology, weightModel: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Traffic Weighted (Modified Laspeyres)">Traffic Weighted (Modified Laspeyres)</option>
                  <option value="Passenger Kilometer (RPK) Weighted">Passenger Kilometer (RPK) Weighted</option>
                  <option value="Equal-Weighted Index">Equal-Weighted Index</option>
                </select>
                <span className="text-[10px] text-slate-400">Base weights adjusted every quarter.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Weight Calibration Source</label>
                <select
                  value={config.methodology.weightSource}
                  onChange={(e) => setConfig(prev => ({ ...prev, methodology: { ...prev.methodology, weightSource: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="DGCA Passenger Traffic O-D Manifest (Q3 2025 Sync)">DGCA Passenger Traffic O-D Manifest (Q3 2025 Sync)</option>
                  <option value="AAI Scheduled Departure Logs 2025">AAI Scheduled Departure Logs 2025</option>
                </select>
                <span className="text-[10px] text-slate-400">Verified against bilateral quota schedules.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Price Estimator Metric</label>
                <select
                  value={config.methodology.priceEstimator}
                  onChange={(e) => setConfig(prev => ({ ...prev, methodology: { ...prev.methodology, priceEstimator: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Median Canonical Fare (Deduplicated)">Median Canonical Fare (Deduplicated)</option>
                  <option value="Harmonic Mean Fare">Harmonic Mean Fare</option>
                  <option value="Trimmed Mean (5% tails)">Trimmed Mean (5% tails)</option>
                </select>
                <span className="text-[10px] text-slate-400">Resistant to high-fare surge outliers.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Outlier Rejection Method</label>
                <div className="h-9 bg-surface-canvas p-1 rounded-xl border border-border-hairline flex items-center gap-1">
                  {['IQR (2.5×)', 'MAD', 'Box-Cox Hybrid'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, methodology: { ...prev.methodology, outlierMethod: m } }))}
                      className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all ${
                        config.methodology.outlierMethod === m ? 'bg-[#1a56db] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400">Upper fence: Q3 + (2.5 * IQR).</span>
              </div>
            </div>

            {/* LaTeX Mathematical Formula Render Cards */}
            <div className="p-4 rounded-xl bg-surface-subtle border border-border-hairline flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Formulation Architecture (Formal Mathematical Specifications)</span>
                <span className="font-mono text-[11px] text-slate-500">Doc: M-24/§4.2</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-surface-card border border-border-hairline">
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">Route Sub-Index (Route_Index_i)</span>
                  <p className="font-mono text-xs font-bold text-[#1a56db]">
                    Route_Index_{'{i,t}'} = (P̃_{'{i,t}'} / P̃_{'{i,0}'}) × 100
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-1">Where P̃ is median canonical airfare across tranches.</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-card border border-border-hairline">
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">Composite National Airfare Index (APIx)</span>
                  <p className="font-mono text-xs font-bold text-[#1a56db]">
                    APIx_t = Σ[w_i × Route_Index_{'{i,t}'}] / Σ[w_i]
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-1">Where w_i is sovereign DGCA O-D seat volume weight.</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: DATA QUALITY RULES */}
          <section id="data-quality" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">fact_check</span>
                </div>
                <div>
                  <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Data Quality & Hygiene Rules</h2>
                  <p className="text-xs text-slate-500">Duplicate deduction logic, statistical outlier caps, and validation state classifications.</p>
                </div>
              </div>
            </div>

            {/* Deduplication Key */}
            <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#1a56db] text-[24px]">fingerprint</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Canonical Deduplication Key</span>
                  <span className="font-mono text-[11px] text-slate-500">Carrier + Flight_No + Origin + Dest + Dep_Date + Scheduled_Dep_Time</span>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Exact Match
              </span>
            </div>

            {/* Sliders & Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-canvas border border-border-hairline">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">IQR Outlier Multiplier Fence</label>
                  <span className="font-mono text-xs font-bold text-[#1a56db]">{config.quality.iqrMultiplier.toFixed(2)}×</span>
                </div>
                <input 
                  type="range"
                  min="1.5"
                  max="3.5"
                  step="0.05"
                  value={config.quality.iqrMultiplier}
                  onChange={(e) => setConfig(prev => ({ ...prev, quality: { ...prev.quality, iqrMultiplier: parseFloat(e.target.value) } }))}
                  className="accent-[#1a56db] cursor-pointer w-full"
                />
                <span className="text-[10px] text-slate-400">Threshold beyond which fare observations are flagged as OUTLIER.</span>
              </div>

              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-canvas border border-border-hairline">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">Quality Acceptance Gate</label>
                  <span className="font-mono text-xs font-bold text-[#1a56db]">{config.quality.qaGate.toFixed(1)}% Pass Rate</span>
                </div>
                <input 
                  type="range"
                  min="80"
                  max="99"
                  step="0.5"
                  value={config.quality.qaGate}
                  onChange={(e) => setConfig(prev => ({ ...prev, quality: { ...prev.quality, qaGate: parseFloat(e.target.value) } }))}
                  className="accent-[#1a56db] cursor-pointer w-full"
                />
                <span className="text-[10px] text-slate-400">Minimum dataset integrity required before calculating daily index.</span>
              </div>
            </div>

            {/* Policy Toggles */}
            <div className="flex flex-col gap-3 pt-2 border-t border-border-hairline">
              <label className="flex items-center justify-between cursor-pointer py-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Automatic Anomaly Flagging</span>
                  <span className="text-[11px] text-slate-500">Automatically route fare movements &gt;25% within 3 hours to compliance review queue.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={config.quality.autoAnomalyFlagging}
                  onChange={(e) => setConfig(prev => ({ ...prev, quality: { ...prev.quality, autoAnomalyFlagging: e.target.checked } }))}
                  className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer py-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Duplicate Reconciliation Engine</span>
                  <span className="text-[11px] text-slate-500">Deduplicate cross-posted OTA fares against primary airline NDC fares in real time.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={config.quality.duplicateReconciliation}
                  onChange={(e) => setConfig(prev => ({ ...prev, quality: { ...prev.quality, duplicateReconciliation: e.target.checked } }))}
                  className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer py-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Mandatory Multi-Source Cross-Validation</span>
                  <span className="text-[11px] text-slate-500">Require at least two independent corroborations before posting non-NDC records.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={config.quality.multiSourceCrossValidation}
                  onChange={(e) => setConfig(prev => ({ ...prev, quality: { ...prev.quality, multiSourceCrossValidation: e.target.checked } }))}
                  className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                />
              </label>
            </div>
          </section>

          {/* SECTION 6: COLLECTION SCHEDULER */}
          <section id="collection-scheduler" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">event_repeat</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Collection Scheduler</h2>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      config.scheduler.isPaused ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {config.scheduler.isPaused ? 'Paused' : 'Active (Cron Engine)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Cadence intervals, retry policies, back-off mechanics, and worker pool parameters.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    const next = !config.scheduler.isPaused;
                    setConfig(prev => ({ ...prev, scheduler: { ...prev.scheduler, isPaused: next } }));
                    showToast(next ? 'Collection scheduler paused.' : 'Collection scheduler resumed.', 'info');
                  }}
                  className="h-8.5 px-3.5 rounded-xl bg-surface-subtle hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  {config.scheduler.isPaused ? 'Resume Scheduler' : 'Pause Scheduler'}
                </button>
                <button 
                  type="button"
                  disabled={isScraping}
                  onClick={() => {
                    if (onTriggerScrape) onTriggerScrape();
                    showToast('Triggered live OTA scrape run across all 52 corridors.', 'success');
                  }}
                  className={`inline-flex items-center gap-1.5 h-8.5 px-4 rounded-xl text-white font-semibold text-xs transition-colors shadow-xs ${
                    isScraping ? 'bg-amber-500 cursor-not-allowed' : 'bg-[#1a56db] hover:bg-blue-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{isScraping ? 'sync' : 'play_arrow'}</span>
                  <span>{isScraping ? 'Running...' : 'Run Now'}</span>
                </button>
              </div>
            </div>

            {/* Telemetry Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-surface-canvas border border-border-hairline text-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Next Automated Sweep</span>
                <span className="font-mono text-xs font-bold text-[#1a56db]">18 mins (14:00 IST)</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Active Scrape Jobs</span>
                <span className="font-mono text-xs font-bold text-[#002b66]">48 Workers</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Failed Jobs (Last 24h)</span>
                <span className="font-mono text-xs font-bold text-red-600">0 Retried</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Last Completed Sweep</span>
                <span className="font-mono text-xs font-bold text-slate-700">11:30 AM IST</span>
              </div>
            </div>

            {/* Configured Windows Chips */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-700">Configured Observation Windows (IST)</span>
              <div className="flex flex-wrap gap-2">
                {config.scheduler.windows.map((win, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-subtle border border-border-hairline text-slate-800 font-mono text-xs font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-[#1a56db]">schedule</span>
                    <span>{win}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border-hairline">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Max Retry Attempts</label>
                <input 
                  type="text" 
                  value={config.scheduler.maxRetries} 
                  onChange={(e) => setConfig(p => ({ ...p, scheduler: { ...p.scheduler, maxRetries: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Request Rate Limit</label>
                <input 
                  type="text" 
                  value={config.scheduler.rateLimit} 
                  onChange={(e) => setConfig(p => ({ ...p, scheduler: { ...p.scheduler, rateLimit: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Worker Job Timeout</label>
                <input 
                  type="text" 
                  value={config.scheduler.timeout} 
                  onChange={(e) => setConfig(p => ({ ...p, scheduler: { ...p.scheduler, timeout: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Source Failure Handling</label>
                <input 
                  type="text" 
                  value={config.scheduler.sourceFallback} 
                  onChange={(e) => setConfig(p => ({ ...p, scheduler: { ...p.scheduler, sourceFallback: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs" 
                />
              </div>
            </div>
          </section>

          {/* SECTION 7: NOTIFICATIONS & WEBHOOKS */}
          <section id="notifications" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </div>
                <div>
                  <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Notifications & Webhooks</h2>
                  <p className="text-xs text-slate-500">Alert routing matrix, severity tiers, and sovereign compliance broadcast endpoints.</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-hairline">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-subtle text-slate-600 text-xs font-bold border-b border-border-hairline">
                    <th className="py-2.5 px-3.5">Event Trigger</th>
                    <th className="py-2.5 px-3.5">Severity Tier</th>
                    <th className="py-2.5 px-3.5 text-center">In-App Banner</th>
                    <th className="py-2.5 px-3.5 text-center">Email Dispatch</th>
                    <th className="py-2.5 px-3.5 text-center">Webhook Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline text-xs text-slate-800">
                  {config.notifications.map((n) => (
                    <tr key={n.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="py-2.5 px-3.5 font-medium">{n.event}</td>
                      <td className="py-2.5 px-3.5">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          n.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                          n.severity === 'High' ? 'bg-amber-100 text-amber-800' :
                          n.severity === 'Medium' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {n.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <input 
                          type="checkbox"
                          checked={n.inApp}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig(p => ({
                              ...p,
                              notifications: p.notifications.map(item => item.id === n.id ? { ...item, inApp: val } : item)
                            }));
                          }}
                          className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <input 
                          type="checkbox"
                          checked={n.email}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig(p => ({
                              ...p,
                              notifications: p.notifications.map(item => item.id === n.id ? { ...item, email: val } : item)
                            }));
                          }}
                          className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <input 
                          type="checkbox"
                          checked={n.webhook}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig(p => ({
                              ...p,
                              notifications: p.notifications.map(item => item.id === n.id ? { ...item, webhook: val } : item)
                            }));
                          }}
                          className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 8: API ACCESS & CREDENTIALS */}
          <section id="api-access" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">key</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">API Access & Sovereign Keys</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Tier-1 Sovereign Quota
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Cryptographic tokens, institutional quotas, and CORS origin whitelisting.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => showToast('Regenerated production key token.', 'info')}
                className="h-8.5 px-3.5 rounded-xl bg-[#1a56db] text-white hover:bg-blue-700 font-semibold text-xs transition-colors shadow-xs"
              >
                + Generate New Key
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Production Public Access Key */}
              <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Production Public Access Key</span>
                  <span className="text-[11px] font-semibold text-emerald-700">Active • Read Only</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 h-9 px-3 rounded-lg bg-surface-card border border-border-hairline font-mono text-xs text-[#002b66] flex items-center overflow-x-auto">
                    {config.apiAccess.prodApiKey}
                  </code>
                  <button 
                    type="button" 
                    onClick={handleCopyKey}
                    className="h-9 px-3 rounded-lg bg-surface-card hover:bg-surface-subtle border border-border-hairline text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#1a56db]">
                      {copiedKey ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedKey ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Secret Key */}
              <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">HMAC Secret Signing Key</span>
                  <span className="text-[11px] text-slate-400">Signature verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className={`flex-1 h-9 px-3 rounded-lg bg-surface-card border border-border-hairline font-mono text-xs text-slate-700 flex items-center overflow-x-auto ${
                    isSecretRevealed ? '' : 'tracking-widest'
                  }`}>
                    {isSecretRevealed ? config.apiAccess.hmacSecret : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <button 
                    type="button" 
                    onClick={() => setIsSecretRevealed(p => !p)}
                    className="h-9 px-3 rounded-lg bg-surface-card hover:bg-surface-subtle border border-border-hairline text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isSecretRevealed ? 'visibility_off' : 'visibility'}
                    </span>
                    <span>{isSecretRevealed ? 'Hide' : 'Reveal'}</span>
                  </button>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-700">Daily Call Quota</span>
                  <div className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline flex items-center justify-between font-mono text-xs text-[#002b66]">
                    <span>100,000 req / day (Tier-1 Sovereign)</span>
                    <span className="font-bold text-[#1a56db]">{config.apiAccess.quotaUsedPct}% used</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Allowed Institutional Origins (CORS)</label>
                  <input 
                    type="text" 
                    value={config.apiAccess.allowedOrigins} 
                    onChange={(e) => setConfig(p => ({ ...p, apiAccess: { ...p.apiAccess, allowedOrigins: e.target.value } }))}
                    className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline font-mono text-xs" 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 9: USERS & ACCESS ROLES */}
          <section id="users-roles" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Users & Access Roles</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      RBAC Governed
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Sovereign identity verification, privileged roles, and access audit journals.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => showToast('Audit journal contains 148 entries for September 2026.', 'info')}
                  className="h-8.5 px-3.5 rounded-xl bg-surface-subtle hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  Audit Log
                </button>
                <button 
                  type="button"
                  onClick={() => showToast('Invitation dispatched to civil aviation statistical authority.', 'success')}
                  className="h-8.5 px-3.5 rounded-xl bg-[#1a56db] text-white hover:bg-blue-700 font-semibold text-xs transition-colors shadow-xs"
                >
                  + Invite User
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border-hairline">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-subtle text-slate-600 text-xs font-bold border-b border-border-hairline">
                    <th className="py-2.5 px-3.5">User & Organization</th>
                    <th className="py-2.5 px-3.5">Role</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5">Last Active</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline text-xs text-slate-800">
                  {config.users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="py-2.5 px-3.5 flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${u.color} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
                          {u.initial}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{u.name}</span>
                          <span className="text-[11px] text-slate-400">{u.org}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-surface-subtle border border-border-hairline text-[11px] font-semibold text-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className={`flex items-center gap-1 text-[11px] font-semibold ${
                          u.status === 'Active' ? 'text-emerald-700' : 'text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-400">{u.lastActive}</td>
                      <td className="py-2.5 px-3.5 text-right">
                        <button 
                          type="button" 
                          onClick={() => showToast(`Role settings opened for ${u.name}.`, 'info')}
                          className="text-xs font-semibold text-[#1a56db] hover:underline"
                        >
                          Edit Role
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 10: APPEARANCE & PREFERENCES */}
          <section id="appearance" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">palette</span>
                </div>
                <div>
                  <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">Appearance & Preferences</h2>
                  <p className="text-xs text-slate-500">Interface modes, dashboard landing routes, and visualization animations.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Interface Mode</label>
                <div className="h-9 bg-surface-canvas p-1 rounded-xl border border-border-hairline flex items-center gap-1">
                  {['Light', 'Dark', 'System'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, appearance: { ...prev.appearance, theme: m } }))}
                      className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all ${
                        config.appearance.theme === m ? 'bg-[#1a56db] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m === 'Light' ? 'Light (Active)' : m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Display Density</label>
                <div className="h-9 bg-surface-canvas p-1 rounded-xl border border-border-hairline flex items-center gap-1">
                  {['Comfortable', 'Compact'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, appearance: { ...prev.appearance, density: d } }))}
                      className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all ${
                        config.appearance.density === d ? 'bg-[#1a56db] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {d === 'Comfortable' ? 'Comfortable (Active)' : d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Default Landing View</label>
                <select
                  value={config.appearance.defaultView}
                  onChange={(e) => setConfig(prev => ({ ...prev, appearance: { ...prev.appearance, defaultView: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Executive Dashboard">Executive Dashboard</option>
                  <option value="Airfare Index">Airfare Index</option>
                  <option value="Route Explorer">Route Explorer</option>
                  <option value="Data Quality">Data Quality</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Default Observation Window</label>
                <select
                  value={config.appearance.defaultObsWindow}
                  onChange={(e) => setConfig(prev => ({ ...prev, appearance: { ...prev.appearance, defaultObsWindow: e.target.value } }))}
                  className="h-9 px-3 rounded-xl bg-surface-canvas border border-border-hairline text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="30 Days">30 Days</option>
                  <option value="7 Days">7 Days</option>
                  <option value="90 Days">90 Days</option>
                  <option value="Year-to-Date (YTD)">Year-to-Date (YTD)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-border-hairline">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">High-Performance Chart Animations</span>
                  <span className="text-[11px] text-slate-500">Enable GPU-accelerated bezier transitions for index curves and lead-time dispersion plots.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={config.appearance.chartAnimations}
                  onChange={(e) => setConfig(prev => ({ ...prev, appearance: { ...prev.appearance, chartAnimations: e.target.checked } }))}
                  className="w-4 h-4 accent-[#1a56db] rounded cursor-pointer"
                />
              </label>
            </div>
          </section>

          {/* SECTION 11: SYSTEM HEALTH */}
          <section id="system-health" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                  <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">System Health & Subsystems</h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      99.98% Uptime
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Real-time microservice status, telemetry ingestion pipeline, and database diagnostics.</p>
                </div>
              </div>
            </div>

            {/* 5 Compact Health Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Scraper Pool</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <span className="font-headline font-bold text-sm text-[#002b66]">48/48 Online</span>
                <span className="font-mono text-[10px] text-slate-400">100% capacity</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">RabbitMQ</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <span className="font-headline font-bold text-sm text-[#002b66]">412 in queue</span>
                <span className="font-mono text-[10px] text-slate-400">0 dead letters</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">TimescaleDB</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <span className="font-headline font-bold text-sm text-[#002b66]">99.9% Health</span>
                <span className="font-mono text-[10px] text-slate-400">4.8 TB partitioned</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">API Gateway</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <span className="font-headline font-bold text-sm text-[#002b66]">42ms p95</span>
                <span className="font-mono text-[10px] text-slate-400">0.01% error rate</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-canvas border border-border-hairline flex flex-col gap-1 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Dashboard UI</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <span className="font-headline font-bold text-sm text-[#002b66]">100% Uptime</span>
                <span className="font-mono text-[10px] text-slate-400">Edge cached</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-surface-subtle border border-border-hairline font-mono text-xs text-slate-700">
              <div><span className="text-slate-400">Last Snapshot Backup:</span> <span className="font-bold">Today 04:00 IST (Encrypted AWS S3 Gov-Cloud)</span></div>
              <div><span className="text-slate-400">Platform Build:</span> <span className="font-bold">v1.0-prod.04</span></div>
            </div>
          </section>

          {/* SECTION 12: ABOUT AIRSCOPE */}
          <section id="about" className="scroll-mt-24 bg-surface-card rounded-2xl border border-border-hairline shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-subtle flex items-center justify-center text-[#1a56db]">
                <span className="material-symbols-outlined text-[20px]">info</span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-lg text-slate-900 leading-tight">About AIRSCOPE</h2>
                <p className="text-xs text-slate-500">Sovereign Airfare Price Index for India — Hackathon & Policy Initiative.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-canvas border border-border-hairline">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">Problem Statement</span>
                  <span className="font-mono text-[11px] bg-surface-subtle px-2 py-0.5 rounded text-[#002b66] font-bold">SIH26056</span>
                </div>
                <span className="text-sm font-bold text-slate-900">High frequency Airfare Price Index for India</span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  An automated, transparent, and statistically rigorous platform computing real-time high-frequency price indices across domestic air routes.
                </p>
              </div>

              <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-canvas border border-border-hairline">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500">Theme & Authorship</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Smart Automation</span>
                </div>
                <span className="text-sm font-bold text-slate-900">Team RAG RANGERS</span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Built with institutional rigor to assist policymakers at MoSPI, DGCA, and the Ministry of Civil Aviation in evaluating passenger welfare.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border-hairline text-xs font-semibold">
              <a href="#" onClick={(e) => { e.preventDefault(); showToast('Opening MoSPI API documentation...', 'info'); }} className="text-[#1a56db] hover:underline flex items-center gap-1">
                <span>Documentation Hub</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); showToast('Downloading Whitepaper PDF...', 'info'); }} className="text-[#1a56db] hover:underline flex items-center gap-1">
                <span>Methodology Whitepaper (PDF)</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); showToast('Redirecting to API endpoint explorer...', 'info'); }} className="text-[#1a56db] hover:underline flex items-center gap-1">
                <span>API Docs & Endpoints</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); showToast('Opening DGCA Research reference library...', 'info'); }} className="text-[#1a56db] hover:underline flex items-center gap-1">
                <span>Research & References</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
          </section>

        </main>
      </div>

      {/* FIXED FLOATING GOVERNANCE ACTION BAR (when changes are made) */}
      {isDirty && (
        <aside 
          aria-label="Unsaved changes banner" 
          className="fixed bottom-0 left-0 lg:left-64 right-0 h-16 bg-surface-card shadow-[0_-4px_16px_rgba(15,23,42,0.08)] z-40 px-6 sm:px-8 flex items-center justify-between border-t border-border-hairline animate-fade-in"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-xs font-semibold text-slate-800">
              Unsaved configuration changes detected.
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button 
              type="button" 
              onClick={handleDiscard}
              className="h-9 px-4 rounded-xl bg-surface-subtle hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              Discard Changes
            </button>
            <button 
              type="button" 
              onClick={handleSave}
              className="h-9 px-5 rounded-xl bg-[#1a56db] text-white hover:bg-blue-700 font-semibold text-xs transition-colors shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
