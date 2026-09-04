import React, { useState } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Database, RefreshCw, Layers, Terminal, AlertTriangle, FileCheck, CheckCircle2, Loader2 } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, liveMode, setLiveMode, lastUpdated, isScraping, onTriggerScrape }) {
  return (
    <header className="border-b border-navy-800 bg-navy-900/90 backdrop-blur-md sticky top-0 z-50">
      {/* Top Government Emblem Bar */}
      <div className="bg-navy-950 px-4 py-1.5 border-b border-navy-800 flex justify-between items-center text-xs text-slate-400">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-blue-400 font-semibold">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Ministry of Statistics & Programme Implementation (MoSPI)</span>
          </div>
          <span className="text-navy-700">|</span>
          <span className="text-slate-400 hidden md:inline">Data Informatics & Innovation Division (DIID)</span>
          <span className="text-navy-700 hidden md:inline">|</span>
          <span className="text-amber-400 font-medium hidden lg:inline">SIH26056 Prototype</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-300 font-mono">System Online</span>
          </div>
          <span className="text-navy-700">|</span>
          <div className="text-slate-400 font-mono text-[11px]">
            Updated: <span className="text-slate-200">{lastUpdated || '03 Sep 2026, 21:42 IST'}</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                AirIndex <span className="text-blue-400">India</span>
              </h1>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                APIx v1.1
              </span>
            </div>
            <p className="text-xs text-slate-400">Real-Time Airfare Price Index & Statistical Intelligence Platform</p>
          </div>
        </div>

        {/* Live Scraper Controls & Mode Switcher */}
        <div className="flex items-center space-x-3 bg-navy-950 p-1.5 rounded-xl border border-navy-800">
          <button
            onClick={() => setLiveMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
              !liveMode
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Fixture Data</span>
          </button>
          
          <button
            onClick={() => {
              setLiveMode(true);
              if (onTriggerScrape) onTriggerScrape();
            }}
            disabled={isScraping}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
              liveMode
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            } ${isScraping ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {isScraping ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span className="text-amber-200 font-semibold">Scraping MMT & Ixigo...</span>
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

      {/* Tabs Menu */}
      <div className="max-w-7xl mx-auto px-4 flex space-x-1 overflow-x-auto text-xs font-medium scrollbar-none border-t border-navy-800/60 pt-1">
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
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-t-lg transition-all border-b-2 font-medium whitespace-nowrap ${
                isActive
                  ? 'border-blue-500 bg-navy-850 text-blue-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-navy-850/50'
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
