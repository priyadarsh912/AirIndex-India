import React from 'react';

export const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: 'grid_view' },
  { id: 'trend', label: 'Airfare Index', icon: 'leaderboard' },
  { id: 'routes', label: 'Route Explorer', icon: 'alt_route' },
  { id: 'elasticity', label: 'Lead-Time Analytics', icon: 'schedule' },
  { id: 'market', label: 'Market Monitor', icon: 'query_stats' },
  { id: 'telemetry', label: 'Anti-Contamination', icon: 'shield_with_heart' },
  { id: 'backtest', label: 'Data Quality', icon: 'verified' },
  { id: 'health', label: 'Collection Monitor', icon: 'hub' },
  { id: 'integrity', label: 'Source Comparison', icon: 'compare_arrows' },
  { id: 'api', label: 'API & Data', icon: 'api' },
  { id: 'explainability', label: 'Policy & Research', icon: 'menu_book' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, setMobileOpen }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Shell */}
      <aside className={`
        fixed left-0 top-0 h-screen w-64 bg-surface-card z-50 flex flex-col justify-between 
        shadow-[0_1px_6px_rgba(0,0,0,0.03)] border-r border-border-hairline overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col">
          {/* Brand Header matching screenshot */}
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="text-[#1a56db] flex items-center justify-center">
                <svg className="w-8 h-8 transform rotate-45" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
              </div>
              <div>
                <span className="font-headline font-black text-xl tracking-tight text-[#002558] block leading-none">
                  AIRSCOPE
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block tracking-normal font-medium">
                  High frequency Airfare Price Index for India
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-3 py-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (setMobileOpen) setMobileOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left text-[13px]
                    ${isActive 
                      ? 'bg-[#1a56db] text-white font-semibold shadow-sm' 
                      : 'text-slate-600 hover:bg-surface-subtle hover:text-slate-900 font-medium'
                    }
                  `}
                >
                  <span className={`material-symbols-outlined text-[19px] ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mission Box Footer */}
        <div className="p-4 border-t border-border-hairline">
          <div className="bg-surface-subtle rounded-xl p-3.5 border border-border-hairline">
            <div className="flex items-center gap-1.5 mb-1 text-[#1a56db]">
              <span className="material-symbols-outlined text-[15px]">public</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Mission</span>
            </div>
            <p className="font-headline text-xs font-semibold text-slate-800">Data for a Better Tomorrow</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Transparent. Comparable. Policy-Ready.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
