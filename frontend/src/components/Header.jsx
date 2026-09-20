import React, { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// OFFICIAL EMBLEMS & LOGO VECTOR ASSETS (Pixel-Perfect SVG Reproductions)
// ─────────────────────────────────────────────────────────────────────────────
// OFFICIAL LOGO VECTOR ASSETS (Pixel-Perfect Reproductions)
// ─────────────────────────────────────────────────────────────────────────────

// 2. MoSPI Official Logo (Ashoka Chakra, Orange Sun Rays, Green Base, Hindi Slogan)
function MoSPILogoSvg({ className = "h-12 w-auto" }) {
  return (
    <svg viewBox="0 0 140 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Rising Sun Rays (Saffron/Orange) */}
      <path d="M70 48 L70 20 M70 48 L82 23 M70 48 L93 30 M70 48 L100 40 M70 48 L103 52 M70 48 L58 23 M70 48 L47 30 M70 48 L40 40 M70 48 L37 52" stroke="#ff7700" strokeWidth="2.5" strokeLinecap="round" />
      {/* Bar Chart Bars Inside Sunrise */}
      <rect x="52" y="38" width="5" height="14" fill="#ff9933" rx="1" />
      <rect x="60" y="32" width="5" height="20" fill="#ff9933" rx="1" />
      <rect x="68" y="26" width="5" height="26" fill="#ff9933" rx="1" />
      <rect x="76" y="30" width="5" height="22" fill="#ff9933" rx="1" />
      <rect x="84" y="36" width="5" height="16" fill="#ff9933" rx="1" />
      {/* Blue Ashoka Chakra Circle */}
      <circle cx="70" cy="22" r="14" fill="#ffffff" stroke="#003399" strokeWidth="2" />
      <circle cx="70" cy="22" r="3" fill="#003399" />
      {/* Chakra Spokes */}
      {Array.from({ length: 12 }).map((_, i) => (
        <line
          key={i}
          x1="70"
          y1="8"
          x2="70"
          y2="36"
          stroke="#003399"
          strokeWidth="0.9"
          transform={`rotate(${i * 15} 70 22)`}
        />
      ))}
      {/* Dynamic Green Leaf / Base Arch */}
      <path
        d="M34 52 C52 64 88 64 106 52 C94 68 46 68 34 52 Z"
        fill="#138808"
      />
      {/* MoSPI Motto Text: आंकड़े प्रगति के लिए */}
      <text
        x="70"
        y="78"
        textAnchor="middle"
        fontFamily="'Tiro Devanagari Hindi', 'Noto Sans Devanagari', sans-serif"
        fontSize="10"
        fontWeight="bold"
        fill="#003399"
      >
        आंकड़े प्रगति के लिए
      </text>
    </svg>
  );
}

// 3. Swachh Bharat Logo (Gandhi Spectacles with Slogan)
function SwachhBharatSvg({ className = "h-11 w-auto" }) {
  return (
    <svg viewBox="0 0 160 85" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Left Temple Arm */}
      <path d="M22 28 Q35 15 50 25" stroke="#262626" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* Left Spectacle Lens */}
      <circle cx="56" cy="35" r="18" fill="#ffffff" stroke="#262626" strokeWidth="2.8" />
      <text
        x="56"
        y="39"
        textAnchor="middle"
        fontFamily="'Tiro Devanagari Hindi', 'Noto Sans Devanagari', sans-serif"
        fontSize="12"
        fontWeight="bold"
        fill="#138808"
      >
        स्वच्छ
      </text>
      {/* Spectacle Nose Bridge */}
      <path d="M74 32 Q80 26 86 32" stroke="#262626" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* Right Spectacle Lens */}
      <circle cx="104" cy="35" r="18" fill="#ffffff" stroke="#262626" strokeWidth="2.8" />
      <text
        x="104"
        y="39"
        textAnchor="middle"
        fontFamily="'Tiro Devanagari Hindi', 'Noto Sans Devanagari', sans-serif"
        fontSize="12"
        fontWeight="bold"
        fill="#262626"
      >
        भारत
      </text>
      {/* Right Temple Arm */}
      <path d="M138 28 Q125 15 110 25" stroke="#262626" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* Tagline: एक कदम स्वच्छता की ओर */}
      <text
        x="80"
        y="68"
        textAnchor="middle"
        fontFamily="'Tiro Devanagari Hindi', 'Noto Sans Devanagari', sans-serif"
        fontSize="9"
        fontWeight="bold"
        fill="#333333"
      >
        एक कदम स्वच्छता की ओर
      </text>
    </svg>
  );
}

// 4. Stay Safe Online Logo (MeitY / G20 Initiative)
function StaySafeOnlineSvg({ className = "h-11 w-auto" }) {
  return (
    <svg viewBox="0 0 140 85" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Dual Colored Saffron / Cyan Shield Arch */}
      <path
        d="M40 38 C40 22 55 12 70 12 C70 12 70 38 70 38 Z"
        fill="#ff7700"
      />
      <path
        d="M70 12 C85 12 100 22 100 38 L70 38 Z"
        fill="#0099cc"
      />
      {/* Inner White Cutout */}
      <circle cx="70" cy="38" r="16" fill="#ffffff" />
      {/* Computer Mouse Icon */}
      <rect x="65" y="24" width="10" height="15" rx="5" fill="#003366" />
      <line x1="70" y1="24" x2="70" y2="28" stroke="#ffffff" strokeWidth="1.2" />
      {/* WiFi Broadcast Waves */}
      <path d="M96 20 A6 6 0 0 1 106 20" stroke="#0099cc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M93 16 A10 10 0 0 1 109 16" stroke="#0099cc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="101" cy="24" r="1.5" fill="#0099cc" />
      {/* Title */}
      <text
        x="70"
        y="58"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="8.5"
        fontWeight="900"
        fill="#002b66"
        letterSpacing="0.4"
      >
        STAY SAFE ONLINE
      </text>
      <text
        x="70"
        y="70"
        textAnchor="middle"
        fontFamily="'Tiro Devanagari Hindi', 'Noto Sans Devanagari', sans-serif"
        fontSize="7.5"
        fontWeight="bold"
        fill="#555555"
      >
        ऑनलाइन सुरक्षा अपनाएं
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN INSTITUTIONAL HEADER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Header({ 
  activeTab,
  setActiveTab,
  onTriggerScrape, 
  isScraping, 
  healthData,
  sidebarCollapsed, 
  setSidebarCollapsed,
  updateFilter,
  filters = { route: 'ALL', airline: 'ALL' }
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // Mapping Navigation Tabs according to Government Portal specification
  const NAV_LINKS = [
    { id: 'overview', label: 'Real-Time Price Index', targetTab: 'overview' },
    { id: 'routes', label: 'Flight Search', targetTab: 'routes' },
    { id: 'heatmaps', label: 'City-Pair Heatmaps', targetTab: 'routes' },
    { id: 'explorer', label: 'Reports & Data Export', targetTab: 'explorer' },
    { id: 'api', label: 'API Documentation', targetTab: 'api' },
    { id: 'psd_basket', label: 'Methodology', targetTab: 'psd_basket' },
    { id: 'settings', label: 'Contact & Settings', targetTab: 'settings' }
  ];

  const handleNavClick = (link) => {
    if (setActiveTab) {
      setActiveTab(link.targetTab);
    }
  };

  const isNavActive = (link) => {
    if (link.id === 'overview' && (activeTab === 'overview' || activeTab === 'trend')) return true;
    if (link.id === 'routes' && activeTab === 'routes') return true;
    if (link.id === 'heatmaps' && activeTab === 'routes') return false;
    if (link.id === 'explorer' && activeTab === 'explorer') return true;
    if (link.id === 'api' && activeTab === 'api') return true;
    if (link.id === 'psd_basket' && (activeTab === 'psd_basket' || activeTab === 'backtest')) return true;
    if (link.id === 'settings' && activeTab === 'settings') return true;
    return false;
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && updateFilter) {
      updateFilter({ route: searchQuery.trim().toUpperCase(), airline: 'ALL' });
      if (setActiveTab) setActiveTab('overview');
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 left-0 right-0 w-full bg-white shadow-md select-none border-b border-slate-200 z-50">
      
      {/* ─────────────────────────────────────────────────────────────────────
          TIER 1: NATIONAL INSTITUTIONAL LOGO & TITLE ROW (White Background)
          ───────────────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80">
        
        {/* Left Side: National Emblem + Government of India & MoSPI Titles */}
        <div className="flex items-center gap-3.5 sm:gap-4.5">
          {/* Ashoka Lion Capital Emblem */}
          <div className="shrink-0 flex items-center justify-center">
            <img 
              src="/emblem-india.png" 
              alt="State Emblem of India - सत्यमेव जयते" 
              className="h-14 sm:h-16 w-auto object-contain select-none"
            />
          </div>

          {/* Institutional Typography in Devanagari & English */}
          <div className="flex flex-col justify-center">
            <span className="font-hindi text-sm sm:text-base font-bold text-slate-900 tracking-normal leading-tight">
              भारत सरकार
            </span>
            <span className="font-hindi text-base sm:text-lg lg:text-xl font-black text-[#0c2340] tracking-tight leading-snug">
              सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय
            </span>
            <span className="text-[10px] sm:text-[11.5px] font-bold text-[#1e3a8a] tracking-wider uppercase mt-0.5 font-sans leading-none">
              MINISTRY OF STATISTICS & PROGRAMME IMPLEMENTATION
            </span>
          </div>
        </div>

        {/* Right Side: MoSPI, Swachh Bharat & Stay Safe Online Logos */}
        <div className="hidden sm:flex items-center gap-3 md:gap-5 ml-auto shrink-0">
          {/* 1. Official MoSPI Emblem */}
          <div className="flex items-center justify-center hover:opacity-90 transition-opacity">
            <MoSPILogoSvg className="h-12 lg:h-13 w-auto" />
          </div>

          {/* Vertical Hairline Divider */}
          <div className="h-10 w-[1px] bg-slate-200" />

          {/* 2. Swachh Bharat Logo */}
          <div className="flex items-center justify-center hover:opacity-90 transition-opacity">
            <SwachhBharatSvg className="h-11 lg:h-12 w-auto" />
          </div>

          {/* Vertical Hairline Divider */}
          <div className="h-10 w-[1px] bg-slate-200" />

          {/* 3. Stay Safe Online Initiative */}
          <div className="flex items-center justify-center hover:opacity-90 transition-opacity">
            <StaySafeOnlineSvg className="h-11 lg:h-12 w-auto" />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          TIER 2: INSTITUTIONAL BLUE NAVIGATION BAR
          ───────────────────────────────────────────────────────────────────── */}
      <nav className="w-full bg-[#0c2340] text-white px-3 sm:px-6 lg:px-8 py-0 flex items-center justify-between border-t border-slate-800 shadow-inner">
        
        {/* Left Navigation Links */}
        <div className="flex items-center overflow-x-auto no-scrollbar scroll-smooth gap-0.5 py-0">
          {NAV_LINKS.map((link) => {
            const active = isNavActive(link);
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link)}
                className={`
                  px-3.5 sm:px-4 py-2.5 text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-all flex items-center gap-1.5
                  ${active 
                    ? 'bg-[#061629] text-white border-b-2 border-[#ff9933] shadow-inner' 
                    : 'text-slate-200 hover:text-white hover:bg-[#153459]'
                  }
                `}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Right Side Status & User Pills */}
        <div className="flex items-center gap-2.5 shrink-0 pl-3 py-1">
          {/* Quick Corridor Search Trigger */}
          <div className="relative">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center bg-[#07192d] border border-blue-400/40 rounded-lg px-2 py-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter corridor (e.g. DEL-BOM)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-36 sm:w-48 font-mono"
                  autoFocus
                />
                <button type="submit" className="text-slate-300 hover:text-white p-0.5">
                  <span className="material-symbols-outlined text-[16px]">search</span>
                </button>
                <button type="button" onClick={() => setSearchOpen(false)} className="text-slate-400 hover:text-white p-0.5 ml-1">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-[#153459] rounded-md transition"
                title="Search corridor"
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
              </button>
            )}
          </div>

          {/* 1. Live Corridors Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#071626] border border-slate-700 text-[11px] font-bold text-emerald-400 font-mono tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>LIVE: 52 CORRIDORS</span>
          </div>

          {/* 2. User Profile Badge: Subham • RAG RANGERS */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#1d4ed8] text-white text-xs font-semibold shadow-sm border border-blue-400/30">
            <div className="w-5 h-5 rounded-full bg-white text-[#1d4ed8] flex items-center justify-center font-black text-[11px] leading-none shadow-sm">
              S
            </div>
            <span className="whitespace-nowrap tracking-tight text-[11.5px]">
              Subham • RAG RANGERS
            </span>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────────────
          TIER 3: MAROON ALERT TICKER BAR
          ───────────────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[#7a0c10] text-white text-xs px-3 sm:px-6 py-1.5 flex items-center gap-3 overflow-hidden shadow-sm border-t border-red-900/60">
        
        {/* Left Badge: ● LIVE ALERT */}
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#4a0709] border border-red-800/80 text-[#fde047] font-black text-[10px] tracking-wider uppercase shadow-inner">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
          <span>LIVE ALERT</span>
        </div>

        {/* Continuous Animated Marquee Ticker */}
        <div className="overflow-hidden whitespace-nowrap flex-1 relative">
          <div className="inline-block animate-marquee hover:pause text-[11.5px] font-medium text-white/95">
            <span className="text-amber-300 font-bold">Implementation</span>
            <span className="mx-2 text-amber-300 font-bold">◆</span>
            <span>MoSPI Update: Base Year 2012=100 | CPI Airfare Sub-Component Active</span>
            <span className="mx-2 text-amber-300 font-bold">◆</span>
            <span>System Status: Live scraping active across 52 domestic flight corridors</span>
            <span className="mx-2 text-amber-300 font-bold">◆</span>
            <span>High volatility detected on DEL-BOM, DEL-BLR trunk corridors</span>
            <span className="mx-2 text-amber-300 font-bold">◆</span>
            <span>DGCA Validated: Peak season surge elasticity under observation</span>
            <span className="mx-2 text-amber-300 font-bold">◆</span>
            <span>PSD Statistical Basket Active: Baseline weights calibrated to 100.0%</span>
            <span className="mx-2 text-amber-300 font-bold">◆</span>
            <span>MoSPI SIH-26056 Live Algorithmic Surveillance Engine Active</span>
          </div>
        </div>
      </div>

    </header>
  );
}
