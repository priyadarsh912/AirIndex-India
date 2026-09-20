import React from 'react';

export const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: 'grid_view' },
  { id: 'trend', label: 'Airfare Index', icon: 'leaderboard' },
  { id: 'routes', label: 'Route Explorer', icon: 'alt_route' },
  { id: 'psd_basket', label: 'PSD Basket & Weights', icon: 'tune' },
  { id: 'explorer', label: 'Fare Ledger', icon: 'receipt_long' },
  { id: 'elasticity', label: 'Lead-Time Analytics', icon: 'schedule' },
  { id: 'market', label: 'Market Monitor', icon: 'query_stats' },
  { id: 'monitoring', label: 'Data Monitoring', icon: 'security' },
  { id: 'backtest', label: 'Data Quality', icon: 'verified' },
  { id: 'integrity', label: 'Source Comparison', icon: 'compare_arrows' },
  { id: 'api', label: 'API & Data', icon: 'api' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  mobileOpen, 
  setMobileOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  appSettings
}) {
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
        fixed left-0 top-[138px] h-[calc(100vh-138px)] bg-surface-card z-40 flex flex-col justify-between 
        shadow-[0_1px_6px_rgba(0,0,0,0.03)] border-r border-border-hairline overflow-y-auto overflow-x-hidden
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'lg:w-16 w-64' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col">
          {/* Brand Header */}
          <div 
            onClick={() => setSidebarCollapsed && setSidebarCollapsed(!sidebarCollapsed)}
            className={`px-4 pt-5 pb-4 border-b border-border-hairline flex items-center justify-between cursor-pointer hover:bg-surface-subtle/50 transition-colors ${sidebarCollapsed ? 'lg:px-2 lg:justify-center' : ''}`}
            title={sidebarCollapsed ? "Click to Expand Sidebar" : "Click to Minimize Sidebar"}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="text-[#1a56db] flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 transform rotate-45" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>
              </div>

              {!sidebarCollapsed && (
                <div className="truncate">
                  <span className="font-headline font-black text-lg tracking-tight text-[#002558] block leading-none">
                    {appSettings?.general?.appName || 'AIRSCOPE'}
                  </span>
                  <span className="text-[9px] text-slate-400 mt-1 block tracking-normal font-medium truncate">
                    {appSettings?.general?.appSub || 'High frequency Airfare Price Index'}
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Minimize/Maximize Button inside Sidebar */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSidebarCollapsed && setSidebarCollapsed(!sidebarCollapsed);
              }}
              className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-surface-subtle transition-all shrink-0"
              title={sidebarCollapsed ? "Expand Sidebar" : "Minimize Sidebar"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-2 py-3">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (setMobileOpen) setMobileOpen(false);
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-[13px]
                    ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}
                    ${isActive 
                      ? 'bg-[#1a56db] text-white font-semibold shadow-sm' 
                      : 'text-slate-600 hover:bg-surface-subtle hover:text-slate-900 font-medium'
                    }
                  `}
                >
                  <span className={`material-symbols-outlined text-[20px] shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mission Box Footer */}
        <div className="p-3 border-t border-border-hairline">
          {sidebarCollapsed ? (
            <div className="flex items-center justify-center p-2 text-[#1a56db]" title="Mission: Data for a Better Tomorrow">
              <span className="material-symbols-outlined text-[20px]">public</span>
            </div>
          ) : (
            <div className="bg-surface-subtle rounded-xl p-3 border border-border-hairline">
              <div className="flex items-center gap-1.5 mb-1 text-[#1a56db]">
                <span className="material-symbols-outlined text-[15px]">public</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Mission</span>
              </div>
              <p className="font-headline text-xs font-semibold text-slate-800">Data for a Better Tomorrow</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">Transparent. Comparable. Policy-Ready.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
