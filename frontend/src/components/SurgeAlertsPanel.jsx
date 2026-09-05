import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, ArrowUpRight, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';

export default function SurgeAlertsPanel({ anomalies }) {
  const [selectedAlert, setSelectedAlert] = useState(null);

  const defaultAnomalies = [
    { event_id: 'SRG-501', route: 'DEL-BOM', airline: 'IndiGo', booking_window: 'T+1', travel_date: '2026-09-04', observed_price: 7850, expected_price: 6150, deviation_pct: 27.6, severity: 'HIGH', driver: 'T+1 Short-Notice Booking Surge', timestamp: '2026-09-03T18:30:00Z', source: 'Direct Airline API' },
    { event_id: 'SRG-502', route: 'BLR-HYD', airline: 'Air India', booking_window: 'T+7', travel_date: '2026-09-10', observed_price: 4420, expected_price: 3600, deviation_pct: 22.8, severity: 'HIGH', driver: 'Demand Spurt on BLR-HYD corridor', timestamp: '2026-09-03T19:15:00Z', source: 'OTA Portal A' },
    { event_id: 'SRG-503', route: 'DEL-BLR', airline: 'Akasa Air', booking_window: 'T+1', travel_date: '2026-09-04', observed_price: 7120, expected_price: 6200, deviation_pct: 14.8, severity: 'MEDIUM', driver: 'T+1 Short-Notice Booking Surge', timestamp: '2026-09-03T20:00:00Z', source: 'OTA Portal B' },
    { event_id: 'SRG-504', route: 'MAA-DEL', airline: 'Air India Express', booking_window: 'T+15', travel_date: '2026-09-18', observed_price: 6100, expected_price: 5350, deviation_pct: 14.0, severity: 'MEDIUM', driver: 'Mid-month Holiday Travel Surge', timestamp: '2026-09-03T21:10:00Z', source: 'Direct Airline API' },
  ];

  const alerts = (anomalies && anomalies.length > 0) ? anomalies : defaultAnomalies;

  return (
    <div className="gov-card p-6 rounded-2xl mb-6 border border-rose-500/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-rose-500 to-amber-500"></div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Airfare Surge & Anomaly Intelligence Center</span>
          </h3>
          <p className="text-xs text-slate-400">Automated deviation detection against 7-day rolling median baselines</p>
        </div>
        <span className="text-xs font-mono text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-500/30 font-semibold">
          {alerts.length} Active Alerts Detected
        </span>
      </div>

      {/* Alert Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.slice(0, 6).map((alert) => {
          const isHigh = alert.severity === 'HIGH';
          const badgeClass = isHigh
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

          return (
            <div
              key={alert.event_id}
              onClick={() => setSelectedAlert(alert)}
              className="p-4 rounded-xl bg-navy-900/90 border border-navy-800 hover:border-navy-700 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${isHigh ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-mono text-sm font-bold text-white">{alert.route}</span>
                    <span className="text-xs text-slate-400">• {alert.airline} ({alert.booking_window})</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">{alert.driver}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    Observed: ₹{alert.observed_price?.toLocaleString('en-IN')} vs Baseline: ₹{alert.expected_price?.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end space-y-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                  +{alert.deviation_pct?.toFixed(1)}%
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700 max-w-md w-full rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedAlert(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white bg-navy-950 border border-navy-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Surge Alert Details</h4>
                <p className="text-xs font-mono text-slate-400">Event ID: {selectedAlert.event_id}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono bg-navy-950 p-4 rounded-xl border border-navy-800 mb-5">
              <div className="flex justify-between border-b border-navy-800 pb-2">
                <span className="text-slate-400">Corridor:</span>
                <span className="text-white font-bold">{selectedAlert.route}</span>
              </div>
              <div className="flex justify-between border-b border-navy-800 pb-2">
                <span className="text-slate-400">Airline Carrier:</span>
                <span className="text-white">{selectedAlert.airline}</span>
              </div>
              <div className="flex justify-between border-b border-navy-800 pb-2">
                <span className="text-slate-400">Advance Window:</span>
                <span className="text-amber-400">{selectedAlert.booking_window}</span>
              </div>
              <div className="flex justify-between border-b border-navy-800 pb-2">
                <span className="text-slate-400">Observed Airfare:</span>
                <span className="text-rose-400 font-extrabold text-sm">₹{selectedAlert.observed_price?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between border-b border-navy-800 pb-2">
                <span className="text-slate-400">7-Day Rolling Median:</span>
                <span className="text-slate-300">₹{selectedAlert.expected_price?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Deviation Spike:</span>
                <span className="text-rose-400 font-bold">+{selectedAlert.deviation_pct?.toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl mb-5 text-xs text-blue-300 flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Primary Driver:</strong> {selectedAlert.driver}. High-frequency pricing algorithms detected a demand spike.</span>
            </div>

            <button
              onClick={() => setSelectedAlert(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
            >
              Acknowledge Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
