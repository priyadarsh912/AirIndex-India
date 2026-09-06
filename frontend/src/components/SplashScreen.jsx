import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldCheck, Plane, CheckCircle2 } from 'lucide-react';

export default function SplashScreen({ onComplete }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Step 1: Initial load
    const timer1 = setTimeout(() => setStage(1), 700);
    // Step 2: Verification / System initialization
    const timer2 = setTimeout(() => setStage(2), 1600);
    // Step 3: Complete and dismiss
    const timerComplete = setTimeout(() => {
      onComplete?.();
    }, 2600);

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
      exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.5, ease: "easeInOut" } }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030712] text-white select-none overflow-hidden"
    >
      {/* Background Ambient Glows & Grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-10 right-1/4 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[90px]" />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* Top Tiranga Ribbon Accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 tiranga-ribbon shadow-sm z-10" />

      {/* Main Card Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg w-full"
      >
        {/* Government Emblem / Emblem Header Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 text-xs tracking-wider mb-6 font-medium shadow-inner">
          <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-[9px] text-slate-950 font-bold">
            🏛️
          </span>
          <span>भारत सरकार • Government of India</span>
        </div>

        {/* Central Logo & Pulse Halo */}
        <div className="relative mb-6">
          <motion.div
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.6, 0.3] 
            }}
            transition={{ 
              duration: 2.4, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 blur-xl opacity-40"
          />

          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 p-0.5 shadow-2xl border border-blue-400/40 flex items-center justify-center">
            <div className="w-full h-full rounded-[22px] bg-[#070e24] flex items-center justify-center relative overflow-hidden">
              <motion.div
                initial={{ rotate: -20, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="relative z-10"
              >
                <Activity className="w-12 h-12 text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
              </motion.div>

              <motion.div 
                animate={{ 
                  x: [-60, 100],
                  y: [40, -60],
                  opacity: [0, 0.8, 0]
                }}
                transition={{ 
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute text-blue-400/30"
              >
                <Plane className="w-8 h-8" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Brand Names & Subtitle */}
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1.5"
        >
          AirIndex <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">India</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto mb-6"
        >
          National Airfare Price Index & Algorithmic Surveillance Engine
        </motion.p>

        {/* Progress Loading Bar */}
        <div className="w-64 sm:w-72 bg-slate-900/90 rounded-full h-1.5 border border-slate-800 overflow-hidden mb-4 shadow-inner">
          <motion.div
            initial={{ width: "10%" }}
            animate={{ 
              width: stage === 0 ? "35%" : stage === 1 ? "75%" : "100%" 
            }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 rounded-full"
          />
        </div>

        {/* Dynamic Status Badges */}
        <div className="h-6 flex items-center justify-center font-mono text-xs text-slate-400">
          <AnimatePresence mode="wait">
            {stage === 0 && (
              <motion.span
                key="loading-models"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1.5 text-blue-300/90"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                Initializing National Index Matrix...
              </motion.span>
            )}

            {stage === 1 && (
              <motion.span
                key="syncing-dgca"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1.5 text-cyan-300/90"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Calibrating MoSPI / DGCA weights...
              </motion.span>
            )}

            {stage >= 2 && (
              <motion.span
                key="ready"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-emerald-400 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                System Ready • Launching Portal
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer Credentials */}
      <div className="absolute bottom-6 flex flex-col items-center gap-1 text-[11px] text-slate-400 font-mono tracking-wide">
        <span>Ministry of Statistics & Programme Implementation (MoSPI)</span>
        <span className="text-slate-400">SIH-26056 • High-Frequency Economic Indicator</span>
      </div>
    </motion.div>
  );
}
