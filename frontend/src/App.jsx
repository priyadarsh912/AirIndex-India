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
        fetch('http://localhost:8000/api/index/current').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/routes').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/clusters').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/airlines').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/elasticity').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/anomalies').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/observations?limit=150').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/backtest').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/explainability').then(r => r.ok ? r.json() : null),
        fetch('http://localhost:8000/api/health').then(r => r.ok ? r.json() : null),
      ]);

      if (resIdx) setIndexData(resIdx);
      if (resRoutes?.routes) setRoutesData(resRoutes.routes);
      if (resClusters) setClusterData(resClusters);
      if (resAirlines?.airlines) setAirlineData(resAirlines.airlines);
      if (resElas?.booking_windows) setElasticityData(resElas.booking_windows);
      if (resAnom?.anomalies) setAnomaliesData(resAnom.anomalies);
      if (resObs?.data) setRawObservations(resObs.data);
      if (resBack) setBacktestData(resBack);
      if (resExp) setExplainabilityData(resExp);
      if (resHealth) setHealthData(resHealth);
    } catch (err) {
      console.log("Backend offline or loading, using fixture datasets.");
    }
  }, []);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData, liveMode]);

  // Live Scrape Trigger Handler across major corridors
  const handleTriggerScrape = async () => {
    setIsScraping(true);
    setScrapeNotification("Initiating Playwright scraper for MakeMyTrip & Ixigo across major domestic corridors...");

    try {
      const res = await fetch('http://localhost:8000/api/scrape/trigger', { method: 'POST' });
      const data = await res.json();
      setScrapeNotification(data.message || "Scrape job running in background.");

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch('http://localhost:8000/api/scrape/status');
          const statusData = await statusRes.json();

          if (!statusData.in_progress) {
            clearInterval(interval);
            setIsScraping(false);
            setScrapeNotification(`Scrape complete! Loaded ${statusData.total_live_scraped_observations} live observations.`);
            fetchBaseData();
            setTimeout(() => setScrapeNotification(null), 5000);
          }
        } catch (e) {
          clearInterval(interval);
          setIsScraping(false);
        }
      }, 3000);

    } catch (err) {
      setIsScraping(false);
      setScrapeNotification("Could not connect to backend scraper trigger.");
      setTimeout(() => setScrapeNotification(null), 4000);
    }
  };

  // Dynamic Query when Filters Change
  useEffect(() => {
    const fetchFilteredTrend = async () => {
      try {
        const queryParams = new URLSearchParams({
          route: filters.route,
          airline: filters.airline,
          window: filters.window,
          frequency: filters.frequency
        });

        const res = await fetch(`http://localhost:8000/api/index/history?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setTrendData(json.history || []);
          if (json.stats) {
            setIndexData(prev => ({
              ...prev,
              current_index: json.stats.current_index ?? prev?.current_index,
              change_24h_pct: json.stats.change_24h ?? prev?.change_24h_pct,
              change_7d_pct: json.stats.change_7d ?? prev?.change_7d_pct,
              overall_avg_fare_inr: json.stats.overall_avg_fare ?? prev?.overall_avg_fare_inr,
              usable_observations: json.stats.usable_observations ?? prev?.usable_observations,
            }));
          }
          if (json.routes && json.routes.length > 0 && filters.route === 'ALL') {
            setRoutesData(json.routes);
          }
          if (json.airlines && json.airlines.length > 0 && filters.airline === 'ALL') {
            setAirlineData(json.airlines);
          }
          if (json.elasticity && json.elasticity.length > 0 && filters.window === 'ALL') {
            setElasticityData(json.elasticity);
          }
        }
      } catch (err) {
        console.log("Filter query fallback to local state.");
      }
    };

    fetchFilteredTrend();
  }, [filters, liveMode]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleRouteSelect = useCallback((routeCode) => {
    setFilters(prev => ({ ...prev, route: routeCode }));
  }, []);

  const handleAirlineSelect = useCallback((airlineName) => {
    setFilters(prev => ({ ...prev, airline: airlineName }));
  }, []);

  const handleWindowSelect = useCallback((windowCode) => {
    setFilters(prev => ({ ...prev, window: windowCode }));
  }, []);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        liveMode={liveMode}
        setLiveMode={setLiveMode}
        lastUpdated={indexData?.last_updated}
        isScraping={isScraping}
        onTriggerScrape={handleTriggerScrape}
      />

      {/* Scrape Notification Banner */}
      {scrapeNotification && (
        <div className="bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-navy-900 border-b border-blue-500/30 px-4 py-2 text-center text-xs font-mono text-blue-200 flex items-center justify-center space-x-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
          <span>{scrapeNotification}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-6">
            <KPICards data={indexData} filters={filters} />
            <IndexTrendChart
              trendData={trendData}
              routes={routesData}
              airlines={airlineData}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AirlineComparisonChart
                airlineData={airlineData}
                selectedAirline={filters.airline}
                onSelectAirline={handleAirlineSelect}
              />
              <BookingWindowElasticity
                elasticityData={elasticityData}
                selectedWindow={filters.window}
                onSelectWindow={handleWindowSelect}
              />
            </div>
            <RouteHeatmap
              routes={routesData}
              selectedRoute={filters.route}
              onSelectRoute={handleRouteSelect}
            />
            <SurgeAlertsPanel anomalies={anomaliesData} />
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="animate-fadeIn space-y-6">
            <CorridorClusteringView
              clusterData={clusterData}
              routes={routesData}
              selectedRoute={filters.route}
              onSelectRoute={handleRouteSelect}
            />
            <RouteHeatmap
              routes={routesData}
              selectedRoute={filters.route}
              onSelectRoute={handleRouteSelect}
            />
          </div>
        )}

        {activeTab === 'explainability' && (
          <div className="animate-fadeIn">
            <ExplainabilityView explainabilityData={explainabilityData} />
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div className="animate-fadeIn">
            <SurgeAlertsPanel anomalies={anomaliesData} />
          </div>
        )}

        {activeTab === 'backtest' && (
          <div className="animate-fadeIn">
            <BacktestValidationView backtestData={backtestData} />
          </div>
        )}

        {activeTab === 'explorer' && (
          <div className="animate-fadeIn">
            <DataExplorerView observations={rawObservations} routes={routesData} />
          </div>
        )}

        {activeTab === 'methodology' && (
          <div className="animate-fadeIn">
            <MethodologyView />
          </div>
        )}

        {activeTab === 'health' && (
          <div className="animate-fadeIn">
            <PipelineHealthView healthData={healthData} />
          </div>
        )}

        {activeTab === 'api' && (
          <div className="animate-fadeIn">
            <APIDocsView />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-800 bg-navy-900/50 py-4 text-center text-xs text-slate-500 font-mono">
        <p>AirIndex India — Real-Time Airfare Price Index & Intelligence Platform (MoSPI / DIID — SIH26056)</p>
      </footer>
    </div>
  );
}
