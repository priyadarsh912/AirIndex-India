// frontend/src/hooks/useAirScopeData.js
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

function generateRouteTrend(routeKey, airlineKey, frequency = 'Daily') {
  const profile = getProfileForRoute(routeKey, airlineKey);
  const baseIndexVal = profile.baseIndex;
  const avgFare = profile.avgFare || 4800;

  if (frequency === 'Monthly') {
    // 12-Month Macroeconomic CPI Airfare Series (Jan 2026 = 100.0)
    const monthlySchedule = [
      { date: "Oct 2025", full_date: "October 2025 (Festive Peak)", factor: 119.4 },
      { date: "Nov 2025", full_date: "November 2025 (Post-Diwali Correction)", factor: 111.8 },
      { date: "Dec 2025", full_date: "December 2025 (Winter Holiday Travel Surge)", factor: 134.8 },
      { date: "Jan 2026", full_date: "January 2026 (MoSPI Base Period: 100.0)", factor: 100.0, is_base: true },
      { date: "Feb 2026", full_date: "February 2026 (Lean Travel Quarter)", factor: 97.8 },
      { date: "Mar 2026", full_date: "March 2026 (Fiscal Year-End Travel)", factor: 105.2 },
      { date: "Apr 2026", full_date: "April 2026 (Summer Break Advance Bookings)", factor: 113.6 },
      { date: "May 2026", full_date: "May 2026 (Peak Summer School Vacations)", factor: 129.8 },
      { date: "Jun 2026", full_date: "June 2026 (School Reopening & Early Monsoon)", factor: 113.2 },
      { date: "Jul 2026", full_date: "July 2026 (Mid-Monsoon Trough)", factor: 102.6 },
      { date: "Aug 2026", full_date: "August 2026 (Independence Day & Rakhi Holidays)", factor: 116.8 },
      { date: "Sep 2026", full_date: "September 2026 (Current MTD • Pre-Puja Surge)", factor: baseIndexVal }
    ];

    const scale = baseIndexVal / 124.5;
    return monthlySchedule.map(m => {
      const wVal = m.is_base ? 100.0 : (m.date === 'Sep 2026' ? baseIndexVal : parseFloat((m.factor * scale).toFixed(1)));
      return {
        date: m.date,
        full_date: m.full_date,
        weighted_index: wVal,
        jevons_index: parseFloat((wVal - 1.1).toFixed(1)),
        fisher_index: parseFloat((wVal + 0.5).toFixed(1)),
        overall_avg_fare: Math.round(avgFare * (wVal / (baseIndexVal || 100.0))),
        observed_count: 12480
      };
    });
  }

  if (frequency === 'Weekly') {
    // 12-Week Rolling Dynamic Series ending on current reporting week
    const weeklySchedule = [
      { week: 1, range: "Jun 28-Jul 04", full: "Week 1: Jun 28 to Jul 04 (Early monsoon onset)", factor: 105.2 },
      { week: 2, range: "Jul 05-Jul 11", full: "Week 2: Jul 05 to Jul 11 (Monsoon lean period)", factor: 103.1 },
      { week: 3, range: "Jul 12-Jul 18", full: "Week 3: Jul 12 to Jul 18 (Mid-monsoon trough)", factor: 102.4 },
      { week: 4, range: "Jul 19-Jul 25", full: "Week 4: Jul 19 to Jul 25 (Monsoon fare sales)", factor: 104.9 },
      { week: 5, range: "Jul 26-Aug 01", full: "Week 5: Jul 26 to Aug 01 (Corporate travel pick-up)", factor: 108.6 },
      { week: 6, range: "Aug 02-Aug 08", full: "Week 6: Aug 02 to Aug 08 (Pre-holiday booking ramp)", factor: 113.8 },
      { week: 7, range: "Aug 09-Aug 15", full: "Week 7: Aug 09 to Aug 15 (Independence Day surge)", factor: 126.4 },
      { week: 8, range: "Aug 16-Aug 22", full: "Week 8: Aug 16 to Aug 22 (Post-holiday normalization)", factor: 117.2 },
      { week: 9, range: "Aug 23-Aug 29", full: "Week 9: Aug 23 to Aug 29 (Raksha Bandhan travel)", factor: 122.8 },
      { week: 10, range: "Aug 30-Sep 05", full: "Week 10: Aug 30 to Sep 05 (Early September steady)", factor: 118.5 },
      { week: 11, range: "Sep 06-Sep 12", full: "Week 11: Sep 06 to Sep 12 (Fiscal Q2 demand closing)", factor: 122.1 },
      { week: 12, range: "Sep 13-Sep 19", full: "Week 12: Sep 13 to Sep 19 (Current active week)", factor: baseIndexVal }
    ];

    const scale = baseIndexVal / 125.0;
    return weeklySchedule.map(w => {
      const wVal = w.week === 12 ? baseIndexVal : parseFloat((w.factor * scale).toFixed(1));
      return {
        date: `W${w.week} (${w.range})`,
        full_date: w.full,
        weighted_index: wVal,
        jevons_index: parseFloat((wVal - 0.9).toFixed(1)),
        fisher_index: parseFloat((wVal + 0.4).toFixed(1)),
        overall_avg_fare: Math.round(avgFare * (wVal / (baseIndexVal || 100.0))),
        observed_count: 2850 + (w.week * 40)
      };
    });
  }
  
  // Daily Frequency: 30 rolling daily points
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

  // Keep track of active in-flight request to cancel superseded queries
  const activeControllerRef = useRef(null);

  const fetchChartData = useCallback(async (activeFilters) => {
    // Cancel any previous pending request immediately to avoid stale overlap
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;
    const { signal } = controller;

    setIsLoading(true);
    setError(null);

    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

    // 1. History Trend Params
    const params = new URLSearchParams();
    if (activeFilters.route && activeFilters.route !== 'ALL') params.append('route', activeFilters.route);
    if (activeFilters.airline && activeFilters.airline !== 'ALL') params.append('airline', activeFilters.airline);
    if (activeFilters.window && activeFilters.window !== 'ALL') params.append('window', activeFilters.window);
    if (activeFilters.frequency) params.append('frequency', activeFilters.frequency);
    params.append('tz', userTz);

    // 2. Summary KPI Params
    const summaryParams = new URLSearchParams();
    if (activeFilters.route && activeFilters.route !== 'ALL') summaryParams.append('corridor', activeFilters.route);
    if (activeFilters.airline && activeFilters.airline !== 'ALL') summaryParams.append('airline', activeFilters.airline);
    summaryParams.append('tz', userTz);

    // Safety timeout: Never stay stuck on "Calculating Live Index..." if network stalls
    const timeoutId = setTimeout(() => {
      if (activeControllerRef.current === controller) {
        controller.abort();
        setIsLoading(false);
      }
    }, 4500);

    try {
      // Fetch trend series and KPI summary concurrently in parallel
      const trendPromise = (async () => {
        try {
          let res = await fetch(`${apiBaseUrl}/api/v2/index/history?${params.toString()}`, { signal });
          if (!res.ok) {
            res = await fetch(`${apiBaseUrl}/api/index/history?${params.toString()}`, { signal }).catch(() => null);
          }
          if (res && res.ok) {
            const data = await res.json();
            if (data.daily_trend && Array.isArray(data.daily_trend) && data.daily_trend.length > 0) {
              setTrendData(data.daily_trend);
              setIsLiveConnected(true);
            } else {
              setTrendData(generateRouteTrend(activeFilters.route, activeFilters.airline, activeFilters.frequency));
            }
          } else {
            setIsLiveConnected(false);
            setTrendData(generateRouteTrend(activeFilters.route, activeFilters.airline, activeFilters.frequency));
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            setIsLiveConnected(false);
            setTrendData(generateRouteTrend(activeFilters.route, activeFilters.airline, activeFilters.frequency));
          }
        } finally {
          // Immediately unblock the trend chart overlay as soon as trend data is ready!
          if (activeControllerRef.current === controller) {
            setIsLoading(false);
          }
        }
      })();

      const summaryPromise = (async () => {
        try {
          const sumRes = await fetch(`${apiBaseUrl}/api/v2/index/current?${summaryParams.toString()}`, { signal });
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            setIndexSummary(sumData);
          } else {
            setIndexSummary(generateRouteSummary(activeFilters.route, activeFilters.airline));
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            setIndexSummary(generateRouteSummary(activeFilters.route, activeFilters.airline));
          }
        }
      })();

      await Promise.allSettled([trendPromise, summaryPromise]);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to calculate live index');
      }
    } finally {
      clearTimeout(timeoutId);
      if (activeControllerRef.current === controller) {
        setIsLoading(false);
      }
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
