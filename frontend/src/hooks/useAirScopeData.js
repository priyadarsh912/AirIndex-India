// frontend/src/hooks/useAirScopeData.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_30_DAY_TREND, DEFAULT_52_ROUTES } from '../defaultData';

function debounce(fn, delay) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

// Build dynamic profile map for all 52 domestic flight corridors
const ROUTE_PROFILE_MAP = {};
DEFAULT_52_ROUTES.forEach(r => {
  ROUTE_PROFILE_MAP[r.route] = {
    baseIndex: r.price_relative || 115.0,
    change24h: r.change_24h || 1.5,
    change7d: parseFloat(((r.change_24h || 1.5) * 0.6).toFixed(1)),
    avgFare: r.current_fare || 4500,
    baseFare: r.base_fare || 4000,
    obsCount: Math.round(1000 + (r.weight || 0.02) * 20000),
    name: r.name || r.route,
    cluster: r.cluster || 'Metro Trunk'
  };
});

function getProfileForRoute(routeKey, airlineKey) {
  if (routeKey && ROUTE_PROFILE_MAP[routeKey]) {
    return ROUTE_PROFILE_MAP[routeKey];
  }
  return {
    baseIndex: 124.5,
    change24h: 1.8,
    change7d: 1.1,
    avgFare: 4500,
    obsCount: 1450,
    name: routeKey !== 'ALL' ? routeKey : (airlineKey !== 'ALL' ? `${airlineKey} Fleet` : 'Selected Corridor')
  };
}

function generateRouteTrend(routeKey, airlineKey) {
  const profile = getProfileForRoute(routeKey, airlineKey);
  const baseIndexVal = profile.baseIndex;
  
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date('2026-09-01T00:00:00Z');
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    
    const sineFactor = Math.sin(i / 3.2) * 4.2;
    const noise = (i % 3 === 0 ? 1.2 : -0.8);
    const weighted = parseFloat((baseIndexVal + sineFactor + noise).toFixed(2));
    const jevons = parseFloat((weighted - 1.1).toFixed(2));
    const fisher = parseFloat((weighted + 0.6).toFixed(2));
    const dailyAvgFare = Math.round(profile.avgFare * (weighted / (baseIndexVal || 100.0)));

    return {
      date: dateStr,
      full_date: dateStr,
      weighted_index: weighted,
      jevons_index: jevons,
      fisher_index: fisher,
      overall_avg_fare: dailyAvgFare,
      observed_count: Math.round(120 + Math.cos(i) * 35)
    };
  });
}

function generateRouteSummary(routeKey, airlineKey) {
  if (routeKey === 'ALL' && airlineKey === 'ALL') return null;

  const profile = getProfileForRoute(routeKey, airlineKey);

  return {
    index_name: `APIx Airfare Index (${profile.name || routeKey})`,
    current_index: profile.baseIndex,
    change_24h_pct: profile.change24h,
    change_7d_pct: profile.change7d || 1.2,
    overall_avg_fare_inr: profile.avgFare,
    total_observations: profile.obsCount || 1850,
    usable_observations: Math.round((profile.obsCount || 1850) * 0.95),
    tracked_routes_count: routeKey !== 'ALL' ? 1 : 52,
    tracked_airlines_count: airlineKey !== 'ALL' ? 1 : 4,
    primary_driver_corridor: routeKey !== 'ALL' ? routeKey : 'DEL-BOM'
  };
}

export function useAirScopeData(apiBaseUrl = '') {
  const [filters, setFilters] = useState({
    route: 'ALL',
    airline: 'ALL',
    window: 'ALL',
    frequency: 'Daily',
    startDate: null,
    endDate: null
  });

  const [trendData, setTrendData] = useState(DEFAULT_30_DAY_TREND);
  const [indexSummary, setIndexSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const fetchChartData = useCallback(async (activeFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

      const params = new URLSearchParams();
      if (activeFilters.route && activeFilters.route !== 'ALL') params.append('route', activeFilters.route);
      if (activeFilters.airline && activeFilters.airline !== 'ALL') params.append('airline', activeFilters.airline);
      if (activeFilters.window && activeFilters.window !== 'ALL') params.append('window', activeFilters.window);
      if (activeFilters.frequency) params.append('frequency', activeFilters.frequency);
      params.append('tz', userTz);

      let res = await fetch(`${apiBaseUrl}/api/v2/index/history?${params.toString()}`);
      if (!res.ok) {
        try {
          res = await fetch(`${apiBaseUrl}/api/index/history?${params.toString()}`);
        } catch (e) {}
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.daily_trend && Array.isArray(data.daily_trend) && data.daily_trend.length > 0) {
          setTrendData(data.daily_trend);
          setIsLiveConnected(true);
        } else {
          setTrendData(generateRouteTrend(activeFilters.route, activeFilters.airline));
        }

        const summaryParams = new URLSearchParams();
        if (activeFilters.route && activeFilters.route !== 'ALL') summaryParams.append('corridor', activeFilters.route);
        if (activeFilters.airline && activeFilters.airline !== 'ALL') summaryParams.append('airline', activeFilters.airline);
        summaryParams.append('tz', userTz);

        try {
          const sumRes = await fetch(`${apiBaseUrl}/api/v2/index/current?${summaryParams.toString()}`);
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            setIndexSummary(sumData);
          } else {
            setIndexSummary(generateRouteSummary(activeFilters.route, activeFilters.airline));
          }
        } catch (sumErr) {
          setIndexSummary(generateRouteSummary(activeFilters.route, activeFilters.airline));
        }
      } else {
        setIsLiveConnected(false);
        if (activeFilters.route !== 'ALL' || activeFilters.airline !== 'ALL') {
          setTrendData(generateRouteTrend(activeFilters.route, activeFilters.airline));
          setIndexSummary(generateRouteSummary(activeFilters.route, activeFilters.airline));
        } else {
          setTrendData(DEFAULT_30_DAY_TREND);
          setIndexSummary(null);
        }
      }
    } catch (err) {
      setIsLiveConnected(false);
      if (activeFilters.route !== 'ALL' || activeFilters.airline !== 'ALL') {
        setTrendData(generateRouteTrend(activeFilters.route, activeFilters.airline));
        setIndexSummary(generateRouteSummary(activeFilters.route, activeFilters.airline));
      } else {
        setTrendData(DEFAULT_30_DAY_TREND);
        setIndexSummary(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const debouncedFetch = useMemo(
    () => debounce((f) => fetchChartData(f), 150),
    [fetchChartData]
  );

  useEffect(() => {
    debouncedFetch(filters);
    return () => debouncedFetch.cancel();
  }, [filters, debouncedFetch]);

  const updateFilter = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return {
    filters,
    updateFilter,
    trendData,
    indexSummary,
    isLoading,
    error,
    isLiveConnected,
    refresh: () => fetchChartData(filters)
  };
}
