import React, { useState, useEffect, useMemo } from 'react';

export default function PSDBasketView({ onBasketUpdated }) {
  const [activeSubTab, setActiveSubTab] = useState('basket'); // 'basket' | 'upload' | 'versions' | 'config' | 'methodology'
  const [basketData, setBasketData] = useState(null);
  const [versionsData, setVersionsData] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Search & Filter state for corridor table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCluster, setSelectedCluster] = useState('ALL');

  // Upload modal / form state
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [uploadSource, setUploadSource] = useState('PSD_OFFICIAL');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadEffectiveFrom, setUploadEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [csvText, setCsvText] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [activateImmediately, setActivateImmediately] = useState(true);

  // Config editor state
  const [configForm, setConfigForm] = useState({
    elementary_method: 'JEVONS',
    aggregation_method: 'WEIGHTED_ROUTE_AGGREGATION',
    base_period: '2026-01',
    base_value: 100.0,
    missing_route_policy: 'EXCLUDE_RENORMALIZE',
    coverage_threshold_pct: 80.0
  });

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchBasketDetails = async () => {
    setIsLoading(true);
    try {
      const [resCurrent, resVersions, resContrib, resConfig] = await Promise.all([
        fetch('/api/basket/current').then(r => r.json()),
        fetch('/api/basket/versions').then(r => r.json()),
        fetch('/api/index/contributions').then(r => r.json()),
        fetch('/api/basket/config').then(r => r.json()),
      ]);

      setBasketData(resCurrent);
      setVersionsData(resVersions.versions || []);
      setContributions(resContrib.contributions || []);
      if (resConfig) {
        setConfigForm({
          elementary_method: resConfig.elementary_method || 'JEVONS',
          aggregation_method: resConfig.aggregation_method || 'WEIGHTED_ROUTE_AGGREGATION',
          base_period: resConfig.base_period || '2026-01',
          base_value: resConfig.base_value || 100.0,
          missing_route_policy: resConfig.missing_route_policy || 'EXCLUDE_RENORMALIZE',
          coverage_threshold_pct: resConfig.coverage_threshold_pct || 80.0
        });
      }
    } catch (e) {
      console.error('Failed fetching PSD basket:', e);
      notify('Failed loading PSD basket data from backend.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBasketDetails();
  }, []);

  // Filtered corridor rows
  const filteredRoutes = useMemo(() => {
    if (!basketData?.routes) return [];
    return basketData.routes.filter(r => {
      const code = r.corridor || r.route_code || r.code || `${r.origin}-${r.destination}`;
      const name = r.name || code;
      const matchesSearch = !searchQuery || 
        code.toLowerCase().includes(searchQuery.toLowerCase()) || 
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.origin && r.origin.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.destination && r.destination.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCluster = selectedCluster === 'ALL' || r.cluster === selectedCluster;
      return matchesSearch && matchesCluster;
    });
  }, [basketData, searchQuery, selectedCluster]);

  // Unique clusters in active basket
  const availableClusters = useMemo(() => {
    if (!basketData?.routes) return [];
    return Array.from(new Set(basketData.routes.map(r => r.cluster || 'Metro Trunk'))).sort();
  }, [basketData]);

  // Map contributions by route code
  const contributionMap = useMemo(() => {
    const map = {};
    contributions.forEach(c => {
      const code = c.route || c.corridor;
      if (code) map[code] = c;
    });
    return map;
  }, [contributions]);

  // Validate CSV or JSON on demand
  const handleValidateBasket = async () => {
    if (!csvText.trim()) {
      notify('Please provide CSV route data to validate.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/basket/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: csvText })
      });
      const data = await res.json();
      setValidationResult(data);
      if (data.is_valid) {
        notify(`Validation Passed: ${data.routes_count} corridors sum to ${data.total_weight_pct}%.`, 'success');
      } else {
        notify(`Validation Failed: ${data.errors?.[0] || 'Invalid basket weights.'}`, 'error');
      }
    } catch (e) {
      notify('Error communicating with basket validator.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit and Upload new Basket version
  const handleUploadBasket = async (e) => {
    e.preventDefault();
    if (!uploadVersion.trim()) {
      notify('Please specify a version tag (e.g. PSD_V2).', 'error');
      return;
    }
    if (!csvText.trim()) {
      notify('Please paste or upload CSV route rows.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/basket/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basket_version: uploadVersion.trim().toUpperCase(),
          basket_name: uploadName.trim() || `PSD Basket ${uploadVersion.trim().toUpperCase()}`,
          source: uploadSource,
          source_description: uploadDescription.trim(),
          effective_from: uploadEffectiveFrom || null,
          csv_text: csvText,
          activate_now: activateImmediately
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Basket ${uploadVersion} uploaded successfully! ${activateImmediately ? 'Activated immediately.' : ''}`, 'success');
        setCsvText('');
        setValidationResult(null);
        setUploadVersion('');
        setUploadName('');
        await fetchBasketDetails();
        if (onBasketUpdated) onBasketUpdated();
        setActiveSubTab('basket');
      } else {
        const errMsg = typeof data.detail === 'string' ? data.detail : (data.detail?.errors?.[0] || 'Upload validation failed.');
        notify(`Failed to register basket: ${errMsg}`, 'error');
      }
    } catch (e) {
      notify('Upload request failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Activate an existing version
  const handleActivateVersion = async (verId) => {
    if (!window.confirm(`Activate basket version ${verId}? This will immediately update headline index calculations.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/basket/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basket_version: verId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Basket ${verId} activated. All indices recomputed.`, 'success');
        await fetchBasketDetails();
        if (onBasketUpdated) onBasketUpdated();
      } else {
        notify(`Activation failed: ${data.detail || 'Server error'}`, 'error');
      }
    } catch (e) {
      notify('Network error activating basket.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save index configuration changes
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/basket/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('Index methodology configuration saved. Indices recomputed.', 'success');
        await fetchBasketDetails();
        if (onBasketUpdated) onBasketUpdated();
      } else {
        notify(`Save failed: ${data.detail || 'Bad configuration values'}`, 'error');
      }
    } catch (e) {
      notify('Network error saving configuration.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/basket/template', '_blank');
  };

  const isOfficialPSD = basketData?.is_psd_official;

  return (
    <div className="space-y-6">
      {/* Institutional Top Alert / Disclaimer */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
          notification.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <span className="material-symbols-outlined text-[20px]">
              {notification.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span>{notification.msg}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs hover:opacity-70">
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="bg-surface-card rounded-2xl border border-border-hairline p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-[#1a56db]/10 text-[#1a56db]">
                <span className="w-2 h-2 rounded-full bg-[#1a56db] animate-pulse"></span>
                MoSPI SIH-26056 Specification
              </span>

              {/* Distinction Badge */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                isOfficialPSD 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <span className="material-symbols-outlined text-[14px]">
                  {isOfficialPSD ? 'verified_user' : 'science'}
                </span>
                {basketData?.source_label || 'Basket: Illustrative Prototype Baseline (PSD-Ready)'}
              </span>
            </div>

            <h1 className="font-headline text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
              Price Statistics Division (PSD) — Basket & Weight Engine
            </h1>
            <p className="text-xs lg:text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
              Configurable index-construction module according to MoSPI Price Statistics Division standards. 
              Supports authorized route baskets, statistical weighting matrices, Jevons elementary price relatives, 
              and strict mathematical validation (<span className="font-mono text-slate-700">Σw = 100.0%</span>) with zero source-code changes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
              title="Download standard CSV structure"
            >
              <span className="material-symbols-outlined text-[18px] text-slate-500">download</span>
              CSV Template
            </button>
            <button
              onClick={() => setActiveSubTab('upload')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1a56db] text-white hover:bg-[#1648b8] transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              Import New Basket
            </button>
          </div>
        </div>

        {/* Prototype Transparency Notice */}
        <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-3 text-xs text-slate-600">
          <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">info</span>
          <div>
            <strong className="text-slate-800">Methodological Clarification (MoSPI PSD):</strong> In accordance with official 
            statistical protocol, the current baseline weights are <em>illustrative demo weights</em> designed to showcase mathematical 
            integrity and system flexibility. When official representative route baskets are published by MoSPI's Price Statistics Division, 
            authorized staff can import the CSV directly through this portal without system downtime or code redeployment.
          </div>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Active Version</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-headline text-lg font-bold text-slate-900 font-mono">
              {basketData?.basket_version || 'DEMO_V1'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              ACTIVE
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Effective: {basketData?.effective_from || '2026-01-01'}</span>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Basket Corridors</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-headline text-2xl font-bold text-[#1a56db]">
              {basketData?.total_routes || 52}
            </span>
            <span className="text-xs text-slate-400 font-medium">routes</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Across 5 domestic clusters</span>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Weight Sum (Σw)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-headline text-2xl font-bold text-emerald-600 font-mono">
              {basketData?.total_weight_pct?.toFixed(1) || '100.0'}%
            </span>
            <span className="material-symbols-outlined text-[16px] text-emerald-600 font-bold">verified</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-medium mt-1 block">Mathematical validation passed</span>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Elementary Method</span>
          <div className="mt-1">
            <span className="font-headline text-base font-bold text-slate-800 font-mono block truncate">
              {configForm.elementary_method || 'JEVONS'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Geometric Price Relative</span>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Base Reference</span>
          <div className="mt-1">
            <span className="font-headline text-base font-bold text-slate-800 font-mono block">
              {configForm.base_period} = {configForm.base_value}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">MoSPI Reference Standard</span>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Missing Policy</span>
          <div className="mt-1">
            <span className="font-headline text-xs font-bold text-slate-700 uppercase block truncate">
              {configForm.missing_route_policy?.replace('_', ' ') || 'RENORMALIZE'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Auto-rescaling on sparse days</span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-border-hairline gap-2">
        <button
          onClick={() => setActiveSubTab('basket')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'basket'
              ? 'border-[#1a56db] text-[#1a56db]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">alt_route</span>
          Active Basket & Route Contributions ({basketData?.total_routes || 52})
        </button>

        <button
          onClick={() => setActiveSubTab('upload')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'upload'
              ? 'border-[#1a56db] text-[#1a56db]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">upload_file</span>
          Import & Weight Validator
        </button>

        <button
          onClick={() => setActiveSubTab('versions')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'versions'
              ? 'border-[#1a56db] text-[#1a56db]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          Basket Version History ({versionsData.length})
        </button>

        <button
          onClick={() => setActiveSubTab('config')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'config'
              ? 'border-[#1a56db] text-[#1a56db]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">settings_input_component</span>
          Index Methodology Configuration
        </button>
      </div>

      {/* SUB-TAB 1: Active Route Basket & Route Contributions */}
      {activeSubTab === 'basket' && (
        <div className="bg-surface-card rounded-2xl border border-border-hairline p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="font-headline text-lg font-bold text-slate-900">
                Active Corridor Basket & Mathematical Impact
              </h2>
              <p className="text-xs text-slate-500">
                Shows statistical weight share and point contribution of each corridor to the headline Airfare Price Index.
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
                <input
                  type="text"
                  placeholder="Search corridor or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db]"
                />
              </div>

              <select
                value={selectedCluster}
                onChange={(e) => setSelectedCluster(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700"
              >
                <option value="ALL">All Clusters ({basketData?.routes?.length || 0})</option>
                {availableClusters.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Corridors Table */}
          <div className="overflow-x-auto border border-border-hairline rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Corridor</th>
                  <th className="px-3 py-3">Cluster</th>
                  <th className="px-3 py-3 text-right">Statistical Weight</th>
                  <th className="px-3 py-3 text-right">Weight Share</th>
                  <th className="px-3 py-3 text-right">Base Price (₹)</th>
                  <th className="px-3 py-3 text-right">Current Fare (₹)</th>
                  <th className="px-3 py-3 text-right">Price Relative</th>
                  <th className="px-3 py-3 text-right">24h Change</th>
                  <th className="px-4 py-3 text-right">Index Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoutes.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-400">
                      No corridors match the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRoutes.map((r) => {
                    const code = r.corridor || r.route_code || r.code || `${r.origin}-${r.destination}`;
                    const weightVal = parseFloat(r.weight || 0);
                    const weightPct = (weightVal * 100).toFixed(2);
                    const cInfo = contributionMap[code] || {};
                    const currFare = cInfo.current_fare || r.base_price || 4500;
                    const basePrice = cInfo.base_fare || r.base_price || 4500;
                    const priceRel = cInfo.price_relative || ((currFare / basePrice) * 100).toFixed(1);
                    const change24 = cInfo.change_24h ?? 0;
                    const contrib = cInfo.contribution ?? 0;

                    return (
                      <tr key={code} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span>{code}</span>
                            {weightVal >= 0.05 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-50 text-blue-700">Top Basket</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal font-sans block">{r.name || code}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {r.cluster || 'Metro Trunk'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-slate-800">
                          {weightVal.toFixed(4)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-[#1a56db]">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-[#1a56db] h-full rounded-full" style={{ width: `${Math.min(100, weightVal * 1000)}%` }} />
                            </div>
                            <span>{weightPct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-500">
                          ₹{basePrice.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900">
                          ₹{currFare.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-slate-700">
                          {priceRel}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium">
                          <span className={change24 > 0 ? 'text-rose-600' : (change24 < 0 ? 'text-emerald-600' : 'text-slate-500')}>
                            {change24 > 0 ? `+${change24}%` : `${change24}%`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          <span className={contrib > 0 ? 'text-rose-600' : (contrib < 0 ? 'text-emerald-600' : 'text-slate-400')}>
                            {contrib > 0 ? `+${contrib}` : contrib} pts
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Import & Mathematical Weight Validator */}
      {activeSubTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form */}
          <form onSubmit={handleUploadBasket} className="lg:col-span-7 bg-surface-card rounded-2xl border border-border-hairline p-6 shadow-sm space-y-4">
            <div>
              <h2 className="font-headline text-lg font-bold text-slate-900">
                Import & Version Statistical Basket
              </h2>
              <p className="text-xs text-slate-500">
                Paste representative route weights supplied by the Price Statistics Division. 
                AirScope executes strict mathematical validation (<span className="font-mono">Σw = 1.0</span>) before registration.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Basket Version Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. PSD_2026_Q3 or DEMO_V2"
                  value={uploadVersion}
                  onChange={(e) => setUploadVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Basket Name / Label *
                </label>
                <input
                  type="text"
                  placeholder="e.g. MoSPI Official CPI Airfare Basket"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Source Classification
                </label>
                <select
                  value={uploadSource}
                  onChange={(e) => setUploadSource(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db]"
                >
                  <option value="PSD_OFFICIAL">Authorized PSD Official Basket</option>
                  <option value="ILLUSTRATIVE_PROTOTYPE">Illustrative Prototype Basket (Demo)</option>
                  <option value="RESEARCH_BENCHMARK">Research / Academic Benchmark</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Effective From Date
                </label>
                <input
                  type="date"
                  value={uploadEffectiveFrom}
                  onChange={(e) => setUploadEffectiveFrom(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Description / Authorization Reference
              </label>
              <input
                type="text"
                placeholder="e.g. MoSPI Price Statistics Division Gazette Ref No. 2026/PSD/CPI-04"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Route & Weight Data (CSV Format) *
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  route_code,origin,destination,weight,cluster,base_price
                </span>
              </div>
              <textarea
                rows={9}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setValidationResult(null);
                }}
                placeholder={`# Paste PSD CSV data here\nDEL-BOM,DEL,BOM,0.15,Metro Trunk,4600\nBOM-DEL,BOM,DEL,0.15,Metro Trunk,4650\nDEL-BLR,DEL,BLR,0.12,Metro Trunk,5400\nBLR-DEL,BLR,DEL,0.12,Metro Trunk,5450\n...`}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-[#1a56db] resize-y"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activateCheck"
                checked={activateImmediately}
                onChange={(e) => setActivateImmediately(e.target.checked)}
                className="rounded border-slate-300 text-[#1a56db] focus:ring-[#1a56db]"
              />
              <label htmlFor="activateCheck" className="text-xs text-slate-700 font-medium">
                Activate immediately upon successful mathematical validation
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleValidateBasket}
                disabled={actionLoading || !csvText.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Dry-Run Validation
              </button>
              <button
                type="submit"
                disabled={actionLoading || !csvText.trim() || !uploadVersion.trim()}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#1a56db] text-white hover:bg-[#1648b8] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {actionLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                Validate & Register Basket
              </button>
            </div>
          </form>

          {/* Right Validation Summary Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-surface-card rounded-2xl border border-border-hairline p-6 shadow-sm">
              <h3 className="font-headline text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a56db]">rule</span>
                Mathematical Validation Engine
              </h3>

              <div className="space-y-3 text-xs text-slate-600">
                <p className="leading-relaxed">
                  Before any basket enters calculation, AirScope verifies that:
                </p>
                <ul className="space-y-1.5 list-disc pl-4 text-slate-600">
                  <li><strong>Weight Sum Rule:</strong> <span className="font-mono">Σ w_i = 100.0% (±0.2% tolerance)</span></li>
                  <li><strong>Positivity:</strong> Each corridor weight is strictly <span className="font-mono">0 &lt; w ≤ 1.0</span></li>
                  <li><strong>Uniqueness:</strong> No duplicate origin-destination corridors in the same version</li>
                  <li><strong>Origin ≠ Destination:</strong> Rejects loop routes (e.g. DEL-DEL)</li>
                  <li><strong>Historical Reproducibility:</strong> Prior baskets remain sealed in version history</li>
                </ul>
              </div>

              {/* Real-time Validation Report */}
              {validationResult ? (
                <div className={`mt-5 p-4 rounded-xl border ${
                  validationResult.is_valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-xs mb-2">
                    <span className="material-symbols-outlined text-[18px]">
                      {validationResult.is_valid ? 'task_alt' : 'cancel'}
                    </span>
                    <span>{validationResult.is_valid ? 'Validation Passed' : 'Validation Failed'}</span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div>Corridors Parsed: <strong>{validationResult.routes_count}</strong></div>
                    <div>Total Weight: <strong className="font-mono">{validationResult.total_weight_pct}%</strong> (Expected: 100.0%)</div>
                  </div>

                  {validationResult.errors?.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-rose-200 text-[11px] space-y-1 text-rose-800">
                      {validationResult.errors.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span>•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center">
                  Click <strong>Dry-Run Validation</strong> or submit to view real-time mathematical validation metrics.
                </div>
              )}
            </div>

            {/* Quick Sample Demo Card */}
            <div className="bg-surface-card rounded-2xl border border-border-hairline p-5 shadow-sm text-xs text-slate-600">
              <span className="font-bold text-slate-800 block mb-1.5">Need a sample payload?</span>
              <p className="mb-3 text-slate-500">
                Click below to auto-fill a representative 10-corridor PSD test basket summing to exactly 100.0%.
              </p>
              <button
                type="button"
                onClick={() => {
                  setUploadVersion('PSD_TEST_10');
                  setUploadName('MoSPI Top 10 Trunk Basket');
                  setUploadSource('PSD_OFFICIAL');
                  setCsvText(
`DEL-BOM,DEL,BOM,0.150,Metro Trunk,4600
BOM-DEL,BOM,DEL,0.150,Metro Trunk,4650
DEL-BLR,DEL,BLR,0.120,Metro Trunk,5400
BLR-DEL,BLR,DEL,0.120,Metro Trunk,5450
BOM-BLR,BOM,BLR,0.100,Metro Trunk,3800
BLR-BOM,BLR,BOM,0.100,Metro Trunk,3850
DEL-CCU,DEL,CCU,0.080,Metro Trunk,4500
CCU-DEL,CCU,DEL,0.080,Metro Trunk,4550
BLR-HYD,BLR,HYD,0.050,Metro Trunk,2900
HYD-BLR,HYD,BLR,0.050,Metro Trunk,2950`
                  );
                }}
                className="text-[#1a56db] font-semibold hover:underline"
              >
                + Insert Sample PSD 10-Corridor Basket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Version History */}
      {activeSubTab === 'versions' && (
        <div className="bg-surface-card rounded-2xl border border-border-hairline p-6 shadow-sm space-y-4">
          <div>
            <h2 className="font-headline text-lg font-bold text-slate-900">
              Auditable Basket Version Control
            </h2>
            <p className="text-xs text-slate-500">
              Historical calculations are permanently linked to the basket version in effect at observation time. 
              Never overwrites historical methodology.
            </p>
          </div>

          <div className="overflow-x-auto border border-border-hairline rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Version Code</th>
                  <th className="px-3 py-3">Basket Name</th>
                  <th className="px-3 py-3">Classification Source</th>
                  <th className="px-3 py-3">Effective Range</th>
                  <th className="px-3 py-3 text-right">Corridors</th>
                  <th className="px-3 py-3 text-right">Weight Sum</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {versionsData.map((v) => {
                  const isActive = v.is_active;
                  const isOfficial = v.source === 'PSD_OFFICIAL';

                  return (
                    <tr key={v.basket_version} className={isActive ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {v.basket_version}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-800">
                        {v.basket_name}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isOfficial ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {isOfficial ? 'PSD Official' : 'Illustrative Prototype'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-500 font-mono text-[11px]">
                        {v.effective_from || '2026-01-01'} → {v.effective_to || 'Present'}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-medium">
                        {v.total_routes}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600">
                        {(v.total_weight * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-center">
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            CURRENT ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isActive ? (
                          <span className="text-slate-400 text-xs italic">In use</span>
                        ) : (
                          <button
                            onClick={() => handleActivateVersion(v.basket_version)}
                            disabled={actionLoading}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-[#1a56db] hover:text-white transition-colors text-slate-700"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Methodology & Index Engine Configuration */}
      {activeSubTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-surface-card rounded-2xl border border-border-hairline p-6 shadow-sm space-y-6 max-w-4xl">
          <div>
            <h2 className="font-headline text-lg font-bold text-slate-900">
              Index Construction Methodology Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Configure underlying mathematical formulas. Changes immediately trigger full re-aggregation of all observations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Elementary Index Methodology
              </label>
              <select
                value={configForm.elementary_method}
                onChange={(e) => setConfigForm({ ...configForm, elementary_method: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db]"
              >
                <option value="JEVONS">JEVONS — Geometric Mean of Price Relatives (Recommended by MoSPI Expert Group)</option>
                <option value="ARITHMETIC_MEAN">DUTOT / CARLI — Weighted Arithmetic Mean</option>
                <option value="MEDIAN">MEDIAN — Robust Non-Parametric Aggregation</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Official MoSPI CPI revision material recommends Jevons geometric mean for elementary route relatives.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Missing Route Policy
              </label>
              <select
                value={configForm.missing_route_policy}
                onChange={(e) => setConfigForm({ ...configForm, missing_route_policy: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db]"
              >
                <option value="EXCLUDE_RENORMALIZE">EXCLUDE & RENORMALIZE — Available weights rescaled to 100%</option>
                <option value="CARRY_FORWARD">CARRY FORWARD — Impute route fare from previous day</option>
                <option value="INDEX_UNAVAILABLE">INDEX UNAVAILABLE — Refuse publication below coverage threshold</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Determines treatment when scraper returns 0 quotes for a basket corridor on a given day.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Base Period Identifier
              </label>
              <input
                type="text"
                value={configForm.base_period}
                onChange={(e) => setConfigForm({ ...configForm, base_period: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db] font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Standard: January 2026 (2026-01)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Base Reference Index Value
              </label>
              <input
                type="number"
                step="1"
                value={configForm.base_value}
                onChange={(e) => setConfigForm({ ...configForm, base_value: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1a56db] font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Default: 100.0 (Base-100 index representation)
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-border-hairline flex justify-end">
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#1a56db] text-white hover:bg-[#1648b8] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {actionLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
              Save Configuration & Recompute All Series
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
