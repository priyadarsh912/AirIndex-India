import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import KPICards from './components/KPICards';
import IndexTrendChart from './components/IndexTrendChart';
import RouteHeatmap from './components/RouteHeatmap';
import AirlineComparisonChart from './components/AirlineComparisonChart';
import BookingWindowElasticity from './components/BookingWindowElasticity';
import SurgeAlertsPanel from './components/SurgeAlertsPanel';
import ExplainabilityView from './components/ExplainabilityView';
import BacktestValidationView from './components/BacktestValidationView';
import DataExplorerView from './components/DataExplorerView';
import MethodologyView from './components/MethodologyView';
import PipelineHealthView from './components/PipelineHealthView';
import APIDocsView from './components/APIDocsView';
import CorridorClusteringView from './components/CorridorClusteringView';

// Dynamic API Base URL configuration: uses VITE_API_URL env variable if set, otherwise defaults to live Render backend in production
export const API_BASE_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://airindex-india-181v.onrender.com' : 'http://localhost:8000');

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [liveMode, setLiveMode] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeNotification, setScrapeNotification] = useState(null);

  const [indexData, setIndexData] = useState(null);
  const [routesData, setRoutesData] = useState([]);
  const [clusterData, setClusterData] = useState(null);
  const [airlineData, setAirlineData] = useState([]);
  const [elasticityData, setElasticityData] = useState([]);
  const [anomaliesData, setAnomaliesData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [rawObservations, setRawObservations] = useState([]);
  const [backtestData, setBacktestData] = useState(null);
  const [explainabilityData, setExplainabilityData] = useState(null);
  const [healthData, setHealthData] = useState(null);

  // Global Interactive Filters State
  const [filters, setFilters] = useState({
    route: 'ALL',
    airline: 'ALL',
    window: 'ALL',
    frequency: 'Daily'
  });

  // Base Data Fetch
  const fetchBaseData = useCallback(async () => {
    try {
      const [resIdx, resRoutes, resClusters, resAirlines, resElas, resAnom, resObs, resBack, resExp, resHealth] = await Promise.all([
        fetch(`${API_BASE_URL}/api/index/current`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/routes`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/clusters`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/airlines`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/elasticity`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/anomalies`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/observations?limit=150`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/backtest`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/explainability`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE_URL}/api/health`).then(r => r.ok ? r.json() : null),
      ]);

      if (resIdx) setIndexData(resIdx);
      if (resRoutes?.routes) setRoutesData(resRoutes.routes);
      if (resClusters) setClusterData(resClusters);
      if (resAirlines?.airlines) setAirlineData(resAirlines.airlines);
      if (resElas?.elasticity) setElasticityData(resElas.elasticity);
      if (resAnom?.anomalies) setAnomaliesData(resAnom.anomalies);
      if (resObs?.observations) setRawObservations(resObs.observations);
      if (resBack) setBacktestData(resBack);
      if (resExp) setExplainabilityData(resExp);
      if (resHealth) {
        setHealthData(resHealth);
        if (resHealth.last_scrape_status === 'running') setIsScraping(true);
      }
    } catch (err) {
      console.error('Failed to fetch base data from backend:', err);
    }
  }, []);

  // Trigger Live Scraping via Backend
  const handleTriggerScrape = async () => {
    if (isScraping) return;
    setIsScraping(true);
    setScrapeNotification({ type: 'info', message: 'Triggered 50+ route scrape background job...' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/scrape/trigger`, { method: 'POST' });
      if (res.ok) {
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await fetch(`${API_BASE_URL}/api/scrape/status`);
            if (statusRes.ok) {
              const status = await statusRes.json();
              if (status.status === 'idle' || status.status === 'completed') {
                clearInterval(interval);
                setIsScraping(false);
                setScrapeNotification({ type: 'success', message: 'Scrape completed! Refreshing metrics.' });
                fetchBaseData();
                fetchHistoryData();
                setTimeout(() => setScrapeNotification(null), 5000);
              }
            }
          } catch (e) {
            console.error('Error polling scrape status:', e);
          }
          if (attempts > 30) {
            clearInterval(interval);
            setIsScraping(false);
            setScrapeNotification({ type: 'warning', message: 'Scrape job sent to backend worker.' });
          }
        }, 3000);
      } else {
        setIsScraping(false);
        setScrapeNotification({ type: 'error', message: `Scrape error (HTTP ${res.status}): Failed to trigger backend scraper.` });
      }
    } catch (err) {
      setIsScraping(false);
      setScrapeNotification({ type: 'error', message: `Could not connect to backend scraper trigger at ${API_BASE_URL}. Ensure VITE_API_URL is configured on Vercel.` });
    }
  };

  // Fetch History / Filtered Trend Data
  const fetchHistoryData = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.route !== 'ALL') queryParams.append('route', filters.route);
      if (filters.airline !== 'ALL') queryParams.append('airline', filters.airline);
      if (filters.window !== 'ALL') queryParams.append('window', filters.window);
      if (filters.frequency) queryParams.append('frequency', filters.frequency);

      const res = await fetch(`${API_BASE_URL}/api/index/history?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTrendData(data.daily_trend || []);
      }
    } catch (err) {
      console.error('Failed to fetch index history:', err);
    }
  }, [filters]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Banner / Scrape Notification */}
      {scrapeNotification && (
        <div className={`py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 ${
          scrapeNotification.type === 'success' ? 'bg-emerald-600 text-white' :
          scrapeNotification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-cyan-600 text-white'
        }`}>
          {isScraping && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
          <span>{scrapeNotification.message}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        liveMode={liveMode}
        setLiveMode={setLiveMode}
        onTriggerScrape={handleTriggerScrape}
        isScraping={isScraping}
        healthData={healthData}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs */}
        {activeTab === 'overview' && (
          <>
            {/* Top KPI Cards */}
            <KPICards
              indexData={indexData}
              routes={routesData}
              filters={filters}
              healthData={healthData}
              rawObsCount={rawObservations.length}
            />

            {/* Main Interactive Index Trend Chart */}
            <IndexTrendChart
              trendData={trendData}
              filters={filters}
              onFilterChange={handleFilterChange}
              routes={routesData}
            />

            {/* Grid 1: Route Heatmap & Airline Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RouteHeatmap routes={routesData} />
              <AirlineComparisonChart airlines={airlineData} />
            </div>

            {/* Grid 2: Elasticity & Surge Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BookingWindowElasticity elasticityData={elasticityData} />
              <SurgeAlertsPanel anomalies={anomaliesData} />
            </div>
          </>
        )}

        {activeTab === 'clustering' && (
          <CorridorClusteringView clusterData={clusterData} routesData={routesData} />
        )}

        {activeTab === 'explorer' && (
          <DataExplorerView observations={rawObservations} routes={routesData} />
        )}

        {activeTab === 'explainability' && (
          <ExplainabilityView data={explainabilityData} />
        )}

        {activeTab === 'backtest' && (
          <BacktestValidationView data={backtestData} />
        )}

        {activeTab === 'methodology' && (
          <MethodologyView />
        )}

        {activeTab === 'health' && (
          <PipelineHealthView healthData={healthData} />
        )}

        {activeTab === 'api' && (
          <APIDocsView />
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AirIndex India — Real-Time Airfare Price Index Platform (MoSPI Compliant)</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            System API Status: Operational ({API_BASE_URL || 'Local Prototyping'})
          </span>
        </div>
      </footer>
    </div>
  );
}
