// frontend/src/hooks/useAirScopeData.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_30_DAY_TREND } from '../defaultData';

// Lightweight standalone debounce utility
function debounce(fn, delay) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
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

  // Initialize with verified default 30-day baseline trend so UI is never blank
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
      if (activeFilters.startDate) params.append('start_date', activeFilters.startDate);
      if (activeFilters.endDate) params.append('end_date', activeFilters.endDate);
      params.append('tz', userTz);

      // Try v2 endpoint first
      let res = await fetch(`${apiBaseUrl}/api/v2/index/history?${params.toString()}`);
      
      // If v2 returns 404 or fails, try backward-compatible v1 endpoint
      if (!res.ok) {
        try {
          res = await fetch(`${apiBaseUrl}/api/index/history?${params.toString()}`);
        } catch (e) {
          // Ignore and continue
        }
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.daily_trend && Array.isArray(data.daily_trend) && data.daily_trend.length > 0) {
          setTrendData(data.daily_trend);
          setIsLiveConnected(true);
          setError(null);
        } else {
          // Keep current baseline if empty
          setTrendData(prev => (prev && prev.length > 0 ? prev : DEFAULT_30_DAY_TREND));
        }

        // Concurrently fetch real-time index summary strictly for current day in target timezone
        const summaryParams = new URLSearchParams();
        if (activeFilters.route && activeFilters.route !== 'ALL') summaryParams.append('corridor', activeFilters.route);
        if (activeFilters.airline && activeFilters.airline !== 'ALL') summaryParams.append('airline', activeFilters.airline);
        if (activeFilters.window && activeFilters.window !== 'ALL') summaryParams.append('window', activeFilters.window);
        summaryParams.append('tz', userTz);

        try {
          const sumRes = await fetch(`${apiBaseUrl}/api/v2/index/current?${summaryParams.toString()}`);
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            setIndexSummary(sumData);
          }
        } catch (sumErr) {
          // Non-blocking
        }
      } else {
        // Backend returned non-200 or is unavailable; fallback gracefully to verified baseline
        setIsLiveConnected(false);
        setTrendData(prev => (prev && prev.length > 0 ? prev : DEFAULT_30_DAY_TREND));
      }
    } catch (err) {
      // Network unreachable / cold boot on cloud host
      console.warn('[AirScope Notice] Live API connecting... displaying baseline index series:', err.message);
      setIsLiveConnected(false);
      setTrendData(prev => (prev && prev.length > 0 ? prev : DEFAULT_30_DAY_TREND));
      // Do not block UI with a fatal error card when baseline data is rendered
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  // Debounced trigger to optimize slider and rapid filter changes
  const debouncedFetch = useMemo(
    () => debounce((f) => fetchChartData(f), 250),
    [fetchChartData]
  );

  useEffect(() => {
    debouncedFetch(filters);
    return () => debouncedFetch.cancel();
  }, [filters, debouncedFetch]);

  // Periodically poll to connect to live backend once awake
  useEffect(() => {
    if (isLiveConnected) return;
    const interval = setInterval(() => {
      fetchChartData(filters);
    }, 15000);
    return () => clearInterval(interval);
  }, [isLiveConnected, filters, fetchChartData]);

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
