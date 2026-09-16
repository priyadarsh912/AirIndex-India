import React from 'react';

export default function MethodologyView() {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm border-l-4 border-l-primary">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="p-2.5 bg-primary-container text-on-primary rounded-lg shadow-sm">
            <span className="material-symbols-outlined text-[24px]">menu_book</span>
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold text-text-primary">Statistical Methodology & Formula Specifications</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Official mathematical formulation for the Airfare Price Index (APIx) designed for MoSPI CPI augmentation.
            </p>
          </div>
        </div>
      </div>

      {/* Formulas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formula 1 */}
        <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-hairline">
            <h3 className="font-headline text-sm font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">calculate</span>
              <span>1. Base-100 Weighted Index (APIx)</span>
            </h3>
            <span className="text-[10px] font-semibold bg-surface-subtle text-primary px-2 py-0.5 rounded-full border border-border-hairline">Primary Indicator</span>
          </div>
          <div className="bg-surface-canvas p-4 rounded-lg font-mono text-xs text-primary mb-3 border border-border-hairline">
            APIx_t = Σ ( P_{'{r,t}'} × W_r ) / Σ W_r
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Where <code className="text-text-primary font-mono">P_{'{r,t}'}</code> represents the route price relative <code className="text-text-secondary font-mono">(Fare_{'{r,t}'} / BaseFare_{'{r,0}'}) × 100</code>, and <code className="text-text-primary font-mono">W_r</code> represents the DGCA passenger-traffic weight assigned to corridor <code className="text-text-secondary font-mono">r</code>.
          </p>
        </div>

        {/* Formula 2 */}
        <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-hairline">
            <h3 className="font-headline text-sm font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">calculate</span>
              <span>2. Jevons Geometric Mean Index</span>
            </h3>
            <span className="text-[10px] font-semibold bg-surface-subtle text-secondary px-2 py-0.5 rounded-full border border-border-hairline">Unweighted Benchmark</span>
          </div>
          <div className="bg-surface-canvas p-4 rounded-lg font-mono text-xs text-secondary mb-3 border border-border-hairline">
            J_t = 100 × ( Π ( Fare_{'{r,t}'} / BaseFare_{'{r,0}'} ) ) ^ (1/N)
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Computes the unweighted geometric mean of price relatives, eliminating substitution bias across carrier pricing.
          </p>
        </div>

        {/* Formula 3 */}
        <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-hairline">
            <h3 className="font-headline text-sm font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-metric-warning text-[18px]">filter_alt</span>
              <span>3. IQR Outlier Bounds</span>
            </h3>
            <span className="text-[10px] font-semibold bg-badge-warning-bg text-metric-warning px-2 py-0.5 rounded-full">QA Pipeline</span>
          </div>
          <div className="bg-surface-canvas p-4 rounded-lg font-mono text-xs text-metric-warning mb-3 border border-border-hairline">
            Bounds = [ Q1 - 1.5 × IQR , Q3 + 1.5 × IQR ]
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Calculated per <code className="text-text-primary font-mono">(corridor, advance_window)</code> cohort to filter out extreme scraping glitches without distorting index values.
          </p>
        </div>

        {/* Formula 4 */}
        <div className="bg-surface-card p-6 rounded-xl border border-border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-hairline">
            <h3 className="font-headline text-sm font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-metric-positive text-[18px]">verified</span>
              <span>4. Quality Score (0 - 100)</span>
            </h3>
            <span className="text-[10px] font-semibold bg-badge-positive-bg text-metric-positive px-2 py-0.5 rounded-full">Completeness</span>
          </div>
          <div className="bg-surface-canvas p-4 rounded-lg font-mono text-xs text-metric-positive mb-3 border border-border-hairline">
            Score = Source(20) + TotalFare(20) + BaseFare(15) + Taxes(15) + Date(10) + Carrier(10) + Window(10)
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Ensures that only high-integrity records (<code className="text-metric-positive font-mono">Score ≥ 70</code>) enter index generation.
          </p>
        </div>
      </div>
    </div>
  );
}
