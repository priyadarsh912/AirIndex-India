import React from 'react';

export default function Header({ onTriggerScrape, isScraping, setMobileOpen }) {
  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface-card/95 backdrop-blur-md z-40 px-4 sm:px-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)] border-b border-border-hairline flex items-center justify-between gap-3">
      {/* Left: Mobile Menu Toggle & Search Bar */}
      <div className="flex items-center gap-3 w-full max-w-xs sm:max-w-sm lg:max-w-md">
        <button 
          onClick={() => setMobileOpen(prev => !prev)}
          className="lg:hidden p-2 text-slate-600 hover:bg-surface-subtle rounded-lg transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search route (e.g. DEL-BOM), airline..."
            className="w-full h-9.5 pl-10 pr-4 rounded-xl bg-surface-canvas text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 border border-border-hairline focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Center: Integrated Flight Surveillance Aircraft Telemetry Badge */}
      <div className="hidden md:flex items-center gap-2.5 px-3 py-1 rounded-xl bg-surface-subtle/80 border border-border-hairline shadow-[0_1px_3px_rgba(0,0,0,0.02)] shrink-0 group hover:border-blue-300/80 hover:bg-surface-subtle transition-all duration-300">
        <div className="relative w-24 xl:w-32 h-9 flex items-center justify-center shrink-0">
          <img 
            src="/flight-header-transparent.png" 
            alt="AirIndex Flight Surveillance Aircraft" 
            className="w-full h-full object-contain filter contrast-[1.08] brightness-[0.98] drop-shadow-[0_4px_8px_rgba(26,86,219,0.18)] animate-flight-float transition-transform duration-500"
          />
        </div>
        <div className="hidden lg:flex flex-col text-left pr-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="font-headline font-bold text-[11px] uppercase tracking-wider text-slate-800 leading-none">
              Surveillance Aircraft
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
            52 DGCA Corridors Live
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Scrape Trigger CTA Button */}
        <button
          onClick={onTriggerScrape}
          disabled={isScraping}
          className={`
            hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm
            ${isScraping 
              ? 'bg-amber-500 text-white cursor-not-allowed opacity-90' 
              : 'bg-[#1a56db] text-white hover:bg-blue-700 active:scale-95'
            }
          `}
          title="Trigger live OTA scrape"
        >
          {isScraping ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[15px]">sync</span>
              <span>Sync Live Fares</span>
            </>
          )}
        </button>

        {/* Live Data Telemetry Box */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-subtle border border-border-hairline">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10b981]"></span>
          </span>
          <div className="flex flex-col text-left">
            <span className="font-bold text-xs text-slate-800 leading-none">
              Live Data
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight font-medium">
              Last updated<br className="sm:hidden" /> Today
            </span>
          </div>
        </div>

        {/* Notification Bell with Red Badge "3" */}
        <button 
          aria-label="Notifications" 
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-surface-subtle hover:text-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#ef4444] text-white font-bold text-[9px] flex items-center justify-center shadow-sm">
            3
          </span>
        </button>

        {/* User Profile: Subham / Team RAG RANGERS */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-border-hairline">
          <div className="w-9 h-9 rounded-full bg-[#1a56db] text-white font-headline font-bold text-sm flex items-center justify-center shadow-sm">
            S
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
              Subham
            </span>
            <span className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
              Team RAG RANGERS
            </span>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-[18px] cursor-pointer hover:text-slate-700 transition-colors">
            keyboard_arrow_down
          </span>
        </div>
      </div>
    </header>
  );
}

