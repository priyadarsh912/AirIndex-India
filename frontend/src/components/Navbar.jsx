import React from 'react';
import { Activity, ShieldCheck, ShieldAlert, Database, RefreshCw, Layers, Terminal, AlertTriangle, FileCheck, CheckCircle2, Loader2, Landmark } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, liveMode, setLiveMode, isScraping, onTriggerScrape }) {
  return (
    <header className="border-b border-slate-800/80 bg-[#070e22]/95 backdrop-blur-xl sticky top-0 z-50 shadow-2xl">
      {/* Tiranga National Ribbon */}
      <div className="tiranga-ribbon"></div>

      {/* Top Government Official Authority Bar */}
      <div className="bg-[#030712] px-4 sm:px-6 py-2 border-b border-slate-800/90 flex flex-wrap justify-between items-center text-xs text-slate-300">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-amber-400 font-semibold tracking-wide">
            {/* Ashoka Stambh / Government of India Motif */}
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-[#040814] shadow-sm font-bold text-[10px]">
              🏛️
            </div>
            <span className="text-slate-100 font-medium">भारत सरकार | Government of India</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="text-slate-300 hidden md:inline font-medium">
            Ministry of Statistics & Programme Implementation (MoSPI)
          </span>
          <span className="text-slate-700 hidden lg:inline">|</span>
          <span className="text-blue-400 hidden lg:inline font-mono text-[11px]">
            National Statistical Office (NSO) • DIID
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold tracking-tight">NATIONAL CLOUD LIVE</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="hidden sm:inline-block text-[11px] text-amber-400/90 font-mono tracking-wider">
            SIH-26056 OFFICIAL
          </span>
        </div>
      </div>

      {/* Main Brand & Controls Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo & Title with Government Seal Styling */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-950 flex items-center justify-center shadow-lg shadow-blue-900/30 border border-blue-400/40 relative group">
            <div className="absolute inset-0 bg-blue-400/10 rounded-xl blur-sm group-hover:bg-blue-400/20 transition-all"></div>
            <Activity className="w-6 h-6 text-cyan-300 relative z-10 drop-shadow" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                AirIndex <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">India</span>
              </h1>
              <span className="bg-blue-950/80 text-blue-300 border border-blue-500/30 text-[10px] font-mono px-2 py-0.5 rounded-md uppercase tracking-wider font-bold">
                APIx v1.2
              </span>
              <span className="bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold hidden md:inline">
                DGCA Validated
              </span>
            </div>
            <p className="text-xs text-slate-400 font-normal">
              High-Frequency Airfare Consumer Price Index & Algorithmic Surveillance Engine
            </p>
          </div>
        </div>

        {/* Live Scraper Controls & Mode Switcher */}
        <div className="flex items-center space-x-2.5 bg-[#030712]/90 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setLiveMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
              !liveMode
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Benchmark Data</span>
          </button>
          
          <button
            onClick={() => {
              setLiveMode(true);
              if (onTriggerScrape) onTriggerScrape();
            }}
            disabled={isScraping}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
              liveMode
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            } ${isScraping ? 'opacity-85 cursor-not-allowed' : ''}`}
          >
            {isScraping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span className="text-amber-200 font-semibold">Harvesting Corridors...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Live OTA Scraper</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex space-x-1 overflow-x-auto text-xs font-medium scrollbar-none border-t border-slate-800/70 pt-1">
        {[
          { id: 'overview', label: 'National Dashboard', icon: Activity },
          { id: 'routes', label: 'Corridor Analytics', icon: Layers },
          { id: 'explainability', label: 'Index Explainability', icon: FileCheck },
          { id: 'anomalies', label: 'Surge Intelligence', icon: AlertTriangle },
          { id: 'backtest', label: 'DGCA 30-Day Backtest', icon: CheckCircle2 },
          { id: 'explorer', label: 'Data Explorer', icon: Database },
          { id: 'integrity', label: 'Data Integrity', icon: ShieldAlert },
          { id: 'methodology', label: 'Methodology', icon: FileCheck },
          { id: 'health', label: 'Pipeline Status', icon: ShieldCheck },
          { id: 'api', label: 'Institutional API', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-t-lg transition-all border-b-2 whitespace-nowrap text-xs ${
                isActive
                  ? 'border-blue-400 bg-gradient-to-t from-blue-950/60 to-transparent text-blue-300 font-bold shadow-[0_2px_12px_rgba(59,130,246,0.15)]'
                  : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 font-medium'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
