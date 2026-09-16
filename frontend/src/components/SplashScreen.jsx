import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SplashScreen({ onComplete }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 700);
    const timer2 = setTimeout(() => setStage(2), 1500);
    const timerComplete = setTimeout(() => {
      onComplete?.();
    }, 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timerComplete);
    };
  }, [onComplete]);

  return (
    <motion.div
      key="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[#F3F4F1] text-slate-800 select-none overflow-hidden py-10 px-6"
    >
      {/* Background Ambient Radial Glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[800px] h-[500px] bg-gradient-to-r from-blue-100/40 via-amber-50/30 to-emerald-100/40 rounded-full blur-[130px]" />
      </div>

      {/* Top Header Accreditation */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex items-center gap-3 px-4 py-2 rounded-full bg-surface-card border border-border-hairline shadow-sm"
      >
        <div className="w-5 h-5 rounded-full bg-[#002b66] text-white flex items-center justify-center font-bold text-[10px]">
          🇮🇳
        </div>
        <span className="text-xs font-semibold text-slate-700 tracking-wide">
          Government of India • MoSPI SIH-26056
        </span>
      </motion.div>

      {/* Main Center Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center text-center max-w-lg w-full"
      >
        {/* Transparent Airliner Floating Graphic */}
        <div className="relative w-64 sm:w-80 h-auto mb-5 flex items-center justify-center pointer-events-none">
          <img 
            src="/flight-header-transparent.png" 
            alt="AirScope Airliner" 
            className="w-full h-auto object-contain filter contrast-[1.06] brightness-[0.98] drop-shadow-[0_12px_24px_rgba(15,23,42,0.14)] animate-flight-float"
          />
        </div>

        {/* Brand Name */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <h1 className="font-headline font-black text-3xl sm:text-4xl tracking-tight text-[#002b66]">
            AIRSCOPE
          </h1>
          <span className="px-2 py-0.5 rounded-md bg-[#1a56db] text-white text-[10px] font-bold uppercase tracking-wider">
            APIx India
          </span>
        </div>

        <p className="text-xs sm:text-sm font-semibold text-[#1a56db] mb-6 tracking-wide">
          Real-Time Airfare Price Index & Analytics Engine
        </p>

        {/* Telemetry Feature Chips */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6">
          <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-hairline text-[11px] font-medium text-slate-600 shadow-xs">
            ✈️ 52 DGCA Corridors
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-hairline text-[11px] font-medium text-slate-600 shadow-xs">
            🛡️ Zero-Contamination
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-hairline text-[11px] font-medium text-slate-600 shadow-xs">
            📊 Calendar Day Sync
          </span>
        </div>

        {/* Progress Loading Bar */}
        <div className="w-72 sm:w-80 bg-surface-subtle rounded-full h-2 overflow-hidden mb-3.5 border border-border-hairline p-0.5 shadow-inner">
          <motion.div
            initial={{ width: "10%" }}
            animate={{ 
              width: stage === 0 ? "45%" : stage === 1 ? "85%" : "100%" 
            }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-[#1a56db] to-[#2F6FED] rounded-full shadow-sm"
          />
        </div>

        {/* Status Text */}
        <div className="h-6 flex items-center justify-center text-xs text-slate-600 font-medium">
          <AnimatePresence mode="wait">
            {stage === 0 && (
              <motion.span
                key="loading-models"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                className="flex items-center gap-2 text-slate-700"
              >
                <span className="w-2 h-2 rounded-full bg-[#1a56db] animate-ping" />
                Connecting to Live OTA Data Feeds...
              </motion.span>
            )}

            {stage === 1 && (
              <motion.span
                key="syncing-dgca"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                className="flex items-center gap-2 text-[#1a56db] font-semibold"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Calibrating DGCA Route Weights & Index Base...
              </motion.span>
            )}

            {stage >= 2 && (
              <motion.span
                key="ready"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-emerald-700 font-bold"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                System Calibrated • Launching Dashboard
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer Accreditation & Tricolor Strip */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 flex flex-col items-center gap-2 w-full max-w-md"
      >
        <div className="h-1 w-32 rounded-full flex overflow-hidden shadow-xs">
          <div className="w-1/3 bg-[#ff9933]"></div>
          <div className="w-1/3 bg-white"></div>
          <div className="w-1/3 bg-[#138808]"></div>
        </div>
        <div className="flex flex-col items-center text-[11px] text-slate-500 font-sans">
          <span className="font-semibold text-slate-700">Ministry of Statistics & Programme Implementation</span>
          <span className="text-[10px] text-slate-400">National Airfare Price Index & Algorithmic Surveillance Platform</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

