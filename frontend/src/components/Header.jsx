import React, { useState, useRef, useEffect } from 'react';

export default function Header({ 
  onTriggerScrape, 
  isScraping, 
  setMobileOpen, 
  sidebarCollapsed, 
  setSidebarCollapsed,
  setActiveTab
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [toastMessage, setToastMessage] = useState(null);

  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  const [notificationsList, setNotificationsList] = useState([
    {
      id: 1,
      title: 'Scraper Pipeline Synced',
      message: '30-Day Selenium scraper collected 120 observations for DEL-BOM.',
      time: '5m ago',
      unread: true,
      type: 'success',
      icon: 'sync'
    },
    {
      id: 2,
      title: 'Price Anomaly Flagged',
      message: 'Surge detected on DEL-BLR route (+14.2% above rolling 7d median).',
      time: '18m ago',
      unread: true,
      type: 'warning',
      icon: 'warning'
    },
    {
      id: 3,
      title: 'Supabase Sync Completed',
      message: 'Database client upserted observations to table flight_observations.',
      time: '1h ago',
      unread: true,
      type: 'info',
      icon: 'database'
    }
  ]);

  // Click Outside Handlers for Dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const markAllAsRead = () => {
    setNotificationsList(prev => prev.map(n => ({ ...n, unread: false })));
    setUnreadCount(0);
    triggerToast('All notifications marked as read.');
  };

  const handleNotificationClick = (id) => {
    setNotificationsList(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <header className={`fixed top-0 left-0 ${sidebarCollapsed ? 'lg:left-16' : 'lg:left-64'} right-0 h-16 bg-surface-card/95 backdrop-blur-md z-40 px-4 sm:px-6 shadow-[0_1px_4px_rgba(0,0,0,0.03)] border-b border-border-hairline flex items-center justify-between gap-3 transition-all duration-300 ease-in-out`}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-18 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-slate-700 animate-fade-in flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

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
              Last updated Today
            </span>
          </div>
        </div>

        {/* 1. Interactive Message / Notification Bell Popover */}
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => {
              setShowNotifications(prev => !prev);
              setShowProfileMenu(false);
            }}
            aria-label="Notifications" 
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-surface-subtle hover:text-slate-900 transition-colors border border-transparent hover:border-border-hairline"
            title="Notifications & System Alerts"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#ef4444] text-white font-bold text-[9px] flex items-center justify-center shadow-sm animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Modal */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-card rounded-2xl shadow-xl border border-border-hairline z-50 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 bg-slate-50 border-b border-border-hairline flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-headline text-sm font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[11px] text-[#1a56db] font-semibold hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="divide-y divide-border-hairline max-h-80 overflow-y-auto">
                {notificationsList.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleNotificationClick(item.id)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition ${item.unread ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`p-2 rounded-lg text-white shrink-0 ${
                      item.type === 'success' ? 'bg-emerald-600' :
                      item.type === 'warning' ? 'bg-amber-500' : 'bg-blue-600'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{item.message}</p>
                    </div>
                    {item.unread && (
                      <span className="w-2 h-2 rounded-full bg-[#1a56db] shrink-0 mt-1"></span>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-slate-50 border-t border-border-hairline text-center">
                <button 
                  onClick={() => {
                    setShowNotifications(false);
                    if (setActiveTab) setActiveTab('backtest');
                  }}
                  className="text-xs font-semibold text-[#1a56db] hover:underline"
                >
                  View Data Quality Logs →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Interactive User Profile Section: Subham / Team RAG RANGERS */}
        <div className="relative" ref={profileRef}>
          <div 
            onClick={() => {
              setShowProfileMenu(prev => !prev);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 pl-2 border-l border-border-hairline cursor-pointer group py-1 px-1.5 rounded-xl hover:bg-surface-subtle transition-all"
            title="User Profile & Account Options"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-[#1a56db] text-white font-headline font-bold text-sm flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                S
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"></span>
            </div>

            <div className="hidden xl:flex flex-col text-left">
              <span className="font-bold text-xs sm:text-sm text-slate-900 leading-tight group-hover:text-[#1a56db] transition-colors">
                Subham
              </span>
              <span className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                Team RAG RANGERS
              </span>
            </div>

            <span className={`material-symbols-outlined text-slate-400 text-[18px] group-hover:text-slate-700 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`}>
              keyboard_arrow_down
            </span>
          </div>

          {/* User Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-surface-card rounded-2xl shadow-xl border border-border-hairline z-50 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-border-hairline">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#1a56db] text-white font-headline font-bold text-lg flex items-center justify-center shadow-md">
                    S
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-sm text-slate-900">Subham</h4>
                    <p className="text-[11px] text-slate-600 font-medium">Team RAG RANGERS</p>
                    <span className="inline-block text-[9px] bg-blue-100 text-[#1a56db] font-bold px-2 py-0.5 rounded-md mt-1">
                      MoSPI / DIID — SIH26056
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2 text-xs space-y-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (setActiveTab) setActiveTab('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition text-left font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px] text-slate-500">settings</span>
                  <span>Account & Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (setActiveTab) setActiveTab('api');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition text-left font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px] text-slate-500">key</span>
                  <span>API Keys & Integration</span>
                </button>

                <button
                  onClick={() => {
                    triggerToast('FastAPI Backend: Online (Port 8000)');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 transition text-left font-semibold"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                    <span>System Status</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Online
                  </span>
                </button>
              </div>

              <div className="p-2 border-t border-border-hairline bg-slate-50">
                <button
                  onClick={() => {
                    triggerToast('Active Session: Subham (Team RAG RANGERS)');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-left font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Session Information</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
