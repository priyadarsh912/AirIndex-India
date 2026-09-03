import React from 'react';
import { FileCheck, BookOpen, Layers, ShieldCheck, Calculator } from 'lucide-react';

export default function MethodologyView() {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-2xl border-l-4 border-l-purple-500">
        <div className="flex items-center space-x-3 mb-2">
          <BookOpen className="w-6 h-6 text-purple-400" />
          <h2 className="text-lg font-bold text-white">Statistical Methodology & Formula Specifications</h2>
        </div>
        <p className="text-xs text-slate-300">
          Official mathematical formulation for the Airfare Price Index (APIx) designed for MoSPI CPI augmentation.
        </p>
      </div>

      {/* Formulas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formula 1: Base-100 Weighted Index */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-navy-800">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-blue-400" />
              <span>1. Base-100 Weighted Index (APIx)</span>
            </h3>
            <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">Primary Indicator</span>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl font-mono text-xs text-blue-300 mb-3 border border-navy-800">
            APIx_t = Σ ( P_{'{r,t}'} × W_r ) / Σ W_r
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Where <code className="text-white font-mono">P_{'{r,t}'}</code> represents the route price relative <code className="text-slate-300 font-mono">(Fare_{'{r,t}'} / BaseFare_{'{r,0}'}) × 100</code>, and <code className="text-white font-mono">W_r</code> represents the DGCA passenger-traffic weight assigned to corridor <code className="text-slate-300 font-mono">r</code>.
          </p>
        </div>

        {/* Formula 2: Jevons Geometric Index */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-navy-800">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span>2. Jevons Geometric Mean Index</span>
            </h3>
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">Unweighted Benchmark</span>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl font-mono text-xs text-cyan-300 mb-3 border border-navy-800">
            J_t = 100 × ( Π ( Fare_{'{r,t}'} / BaseFare_{'{r,0}'} ) ) ^ (1/N)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Computes the unweighted geometric mean of price relatives, eliminating substitution bias across carrier pricing.
          </p>
        </div>

        {/* Formula 3: IQR Outlier Detection */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-navy-800">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>3. IQR Outlier Bounds</span>
            </h3>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">QA Pipeline</span>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl font-mono text-xs text-amber-300 mb-3 border border-navy-800">
            Bounds = [ Q1 - 1.5 × IQR , Q3 + 1.5 × IQR ]
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Calculated per <code className="text-white font-mono">(corridor, advance_window)</code> cohort to filter out extreme scraping glitches without distorting index values.
          </p>
        </div>

        {/* Formula 4: Quality Score Formula */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-navy-800">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>4. Quality Score (0 - 100)</span>
            </h3>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Data Completeness</span>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl font-mono text-xs text-emerald-300 mb-3 border border-navy-800">
            Score = Source(20) + TotalFare(20) + BaseFare(15) + Taxes(15) + Date(10) + Carrier(10) + Window(10)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ensures that only high-integrity records (<code className="text-emerald-400 font-mono">Score ≥ 70</code>) enter index generation.
          </p>
        </div>
      </div>
    </div>
  );
}
