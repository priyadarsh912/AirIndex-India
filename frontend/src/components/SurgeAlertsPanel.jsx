import React, { useState } from 'react';

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
    <div className="bg-surface-card rounded-xl p-5 sm:p-6 shadow-sm border border-border-hairline mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border-hairline">
        <div>
          <h3 className="font-headline text-base font-bold text-text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-metric-negative">warning</span>
            <span>Surge & Anomaly Intelligence Center</span>
          </h3>
          <p className="text-xs text-text-muted">Automated deviation detection against 7-day rolling median baselines</p>
        </div>
        <span className="text-xs font-semibold text-metric-negative bg-badge-negative-bg px-2.5 py-1 rounded-lg border border-border-hairline">
          {alerts.length} Active Alerts
        </span>
      </div>

      {/* Alert Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.slice(0, 6).map((alert) => {
          const isHigh = alert.severity === 'HIGH';
          return (
            <div
              key={alert.event_id}
              onClick={() => setSelectedAlert(alert)}
              className="p-4 rounded-lg bg-surface-canvas border border-border-hairline hover:border-border-focus transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isHigh ? 'bg-badge-negative-bg text-metric-negative' : 'bg-badge-warning-bg text-metric-warning'}`}>
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-headline text-sm font-bold text-text-primary">{alert.route}</span>
                    <span className="text-xs text-text-muted">• {alert.airline} ({alert.booking_window})</span>
                  </div>
                  <p className="text-xs text-text-secondary font-medium">{alert.driver}</p>
                  <p className="text-[11px] text-text-muted mt-1 tabular-nums">
                    Observed: ₹{alert.observed_price?.toLocaleString('en-IN')} vs Baseline: ₹{alert.expected_price?.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isHigh ? 'bg-badge-negative-bg text-metric-negative' : 'bg-badge-warning-bg text-metric-warning'
                }`}>
                  +{alert.deviation_pct?.toFixed(1)}%
                </span>
                <span className="material-symbols-outlined text-text-muted group-hover:text-primary transition-colors text-[18px]">
                  chevron_right
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border-hairline max-w-md w-full rounded-xl p-6 shadow-xl relative animate-fade-in">
            <button
              onClick={() => setSelectedAlert(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-badge-negative-bg text-metric-negative">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h4 className="font-headline text-base font-bold text-text-primary">Surge Alert Details</h4>
                <p className="text-xs text-text-muted">Event ID: {selectedAlert.event_id}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-surface-canvas p-4 rounded-lg border border-border-hairline mb-4 font-medium">
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-muted">Corridor:</span>
                <span className="text-text-primary font-bold">{selectedAlert.route}</span>
              </div>
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-muted">Carrier:</span>
                <span className="text-text-primary">{selectedAlert.airline}</span>
              </div>
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-muted">Window:</span>
                <span className="text-primary font-semibold">{selectedAlert.booking_window}</span>
              </div>
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-muted">Observed Fare:</span>
                <span className="text-metric-negative font-bold tabular-nums">₹{selectedAlert.observed_price?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between border-b border-border-hairline pb-2">
                <span className="text-text-muted">7-Day Baseline:</span>
                <span className="text-text-primary tabular-nums">₹{selectedAlert.expected_price?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Deviation:</span>
                <span className="text-metric-negative font-bold">+{selectedAlert.deviation_pct?.toFixed(1)}%</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedAlert(null)}
              className="w-full py-2.5 bg-primary-container hover:bg-primary text-on-primary font-semibold text-xs rounded-lg transition-all"
            >
              Acknowledge Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
