import React from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Plane } from 'lucide-react';
import AirlineComparisonChart from './AirlineComparisonChart';

export default function RouteDetailModal({ activeDetails, onClose, airlineData, selectedAirline, onSelectAirline }) {
  if (!activeDetails) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#070d1e] border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden my-auto"
      >
        {/* Top subtle highlight */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"></div>

        {/* Modal Header */}
        <div className="bg-[#091126] border-b border-slate-800/80 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xl font-black text-white tracking-wide">{activeDetails.item.route}</span>
            <span className="text-sm text-slate-400 font-sans">({activeDetails.item.name})</span>
            
            <div className="flex items-center gap-2 ml-1">
              <span className="text-xs font-mono bg-blue-950/80 text-blue-300 border border-blue-500/40 px-3 py-1 rounded-full font-semibold">
                CPI: {activeDetails.cpiIndex} ({activeDetails.cpiChangePct >= 0 ? `+${activeDetails.cpiChangePct}%` : `${activeDetails.cpiChangePct}%`})
              </span>
              <span className="text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md font-semibold">
                Weight: {Math.round((activeDetails.item.weight || 0.05) * 100)}%
              </span>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Grid */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6 custom-scrollbar">
          {/* Left Column: Price Breakdown, Elasticity & Flights */}
          <div className="space-y-5">
            {/* 4 Primary Tariff Cards Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3.5 bg-[#0b142d] rounded-xl border border-slate-800/90 shadow-inner">
                <span className="text-[11px] font-sans text-slate-400 block mb-1">Total Fare</span>
                <span className="text-xl font-bold text-white tracking-tight">₹{activeDetails.currentFare.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3.5 bg-[#0b142d] rounded-xl border border-slate-800/90 shadow-inner">
                <span className="text-[11px] font-sans text-slate-400 block mb-1">Air Basefare</span>
                <span className="text-xl font-bold text-cyan-400 tracking-tight">₹{activeDetails.baseComponent.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3.5 bg-[#0b142d] rounded-xl border border-slate-800/90 shadow-inner">
                <span className="text-[11px] font-sans text-slate-400 block mb-1">Taxes (GST/UDF)</span>
                <span className="text-xl font-bold text-emerald-400 tracking-tight">₹{activeDetails.taxesComponent.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3.5 bg-[#0b142d] rounded-xl border border-slate-800/90 shadow-inner">
                <span className="text-[11px] font-sans text-slate-400 block mb-1">Fees/Surcharges</span>
                <span className="text-xl font-bold text-amber-400 tracking-tight">₹{activeDetails.feesComponent.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Advance Booking Window Price Elasticity */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                ADVANCE BOOKING WINDOW PRICE ELASTICITY
              </div>
              <div className="grid grid-cols-5 gap-2 text-center font-mono">
                {activeDetails.windowBreakdown.map((w) => (
                  <div key={w.window} className="p-2 bg-[#0b142d] rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-amber-400 block font-bold mb-0.5">{w.window}</span>
                    <span className="text-xs font-bold text-white">₹{w.fare}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operating Flight Numbers & Providers Table */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5 font-mono">
                <Plane className="w-3.5 h-3.5 text-blue-400" />
                OPERATING FLIGHT NUMBERS & PROVIDERS ({activeDetails.flightsList.length})
              </div>
              <div className="max-h-[190px] overflow-y-auto pr-1 scrollbar-thin border border-slate-800/80 rounded-xl bg-[#081024]">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead className="sticky top-0 bg-[#0b142d] z-10">
                    <tr className="text-slate-400 border-b border-slate-800 text-[10px]">
                      <th className="py-2 px-3">Flight No</th>
                      <th className="py-2 px-2">Airline</th>
                      <th className="py-2 px-2">Provider</th>
                      <th className="py-2 px-2 text-right">Base</th>
                      <th className="py-2 px-2 text-right">Tax</th>
                      <th className="py-2 px-2 text-right">Total</th>
                      <th className="py-2 px-3 text-center">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-[11px]">
                    {activeDetails.flightsList.map((f, i) => (
                      <tr key={i} className="hover:bg-blue-950/30 transition-colors">
                        <td className="py-2 px-3 font-bold text-white">{f.flight_number}</td>
                        <td className="py-2 px-2 text-slate-200">{f.airline}</td>
                        <td className="py-2 px-2 text-slate-400 text-[10px]">{f.source}</td>
                        <td className="py-2 px-2 text-right text-slate-300">₹{f.base_fare}</td>
                        <td className="py-2 px-2 text-right text-emerald-400">₹{f.taxes}</td>
                        <td className="py-2 px-2 text-right font-bold text-white">₹{f.fare}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider">
                            {f.integrity_status || 'CARRIER_MISMATCH'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Airline Carrier Comparison */}
          <div className="flex flex-col h-full min-h-[360px]">
             <AirlineComparisonChart 
                airlineData={airlineData} 
                selectedAirline={selectedAirline} 
                onSelectAirline={onSelectAirline} 
             />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
