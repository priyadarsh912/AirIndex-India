// frontend/src/hooks/useAirScopeData.js
import { useState, useEffect, useCallback, useMemo } from 'react';

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

  const [trendData, setTrendData] = useState([]);
  const [indexSummary, setIndexSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

      const res = await fetch(`${apiBaseUrl}/api/v2/index/history?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: Failed to fetch live index data`);
      }
      const data = await res.json();
      setTrendData(data.daily_trend || []);

      // Concurrently fetch real-time index summary strictly for current day in target timezone
      const summaryParams = new URLSearchParams();
      if (activeFilters.route && activeFilters.route !== 'ALL') summaryParams.append('corridor', activeFilters.route);
      if (activeFilters.airline && activeFilters.airline !== 'ALL') summaryParams.append('airline', activeFilters.airline);
      if (activeFilters.window && activeFilters.window !== 'ALL') summaryParams.append('window', activeFilters.window);
      summaryParams.append('tz', userTz);

      const sumRes = await fetch(`${apiBaseUrl}/api/v2/index/current?${summaryParams.toString()}`);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setIndexSummary(sumData);
      }
    } catch (err) {
      console.error('[AirScope API Error] Failed to update trend:', err);
      setError(err.message);
      setTrendData([]); // Clean empty state; zero fake data injected
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
    refresh: () => fetchChartData(filters)
  };
}
