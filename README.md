# AirIndex India — High-Frequency Airfare Price Intelligence for India  

**SIH26056** — *Development of a Real-time Airfare Price Index for India through Automated Web Scraping of Airline and Online Travel Aggregator Portals for Augmentation of the Consumer Price Index (CPI).*

**Organization:** Ministry of Statistics & Programme Implementation (MoSPI)  
**Department:** Data Informatics & Innovation Division (DIID)  
**Category:** Software | **Theme:** Travel & Tourism

---

## Executive Overview

AirIndex India is an institutional statistical intelligence platform designed to augment the official Consumer Price Index (CPI) with high-frequency, dynamic airfare observations. It automatically collects fare observations across domestic flight corridors, normalizes base fare, taxes, and fees, applies IQR outlier detection and quality scoring (0–100), and computes a **Weighted Base-100 Airfare Price Index (APIx)** alongside Jevons and Fisher index variants.

---

## Key Features

1. **Base-100 Weighted Airfare Price Index (APIx):** Real-time national index tracking airfare price trends relative to a defined base period (January 2026 = 100.0).
2. **Representative Basket & Route Weights:** Tracks 6 high-traffic corridors (DEL-BOM 25%, DEL-BLR 20%, BOM-BLR 15%, DEL-CCU 15%, BLR-HYD 10%, MAA-DEL 15%) across 4 major domestic carriers (IndiGo, Air India, Air India Express, Akasa Air).
3. **Advance Purchase Elasticity Curve:** Captures fare progression across 5 booking windows ($T+1$, $T+7$, $T+15$, $T+30$, $T+45$).
4. **Data Cleaning & Quality Pipeline:**
   - Schema validation & deduplication
   - IQR outlier bounds ($[Q_1 - 1.5\text{IQR}, Q_3 + 1.5\text{IQR}]$)
   - 0–100 quality scoring based on metadata completeness
5. **AI-Assisted Surge & Anomaly Detection:** Real-time alert engine flagging price spikes against 7-day rolling median baselines with severity scoring (HIGH, MEDIUM, NORMAL).
6. **30-Day DGCA Backtest Validation:** Evaluates prototype index values against public DGCA monthly average-fare statistics ($r \ge 0.84$, $\text{MAPE} \le 5.84\%$).
7. **Index Explainability ("Why did the index move?"):** Decomposes index movement into route-level and airline-level contribution points.
8. **Raw Data Explorer & Export:** Filterable, searchable observation registry with CSV export capability.
9. **Institutional REST API:** Exposes endpoints (`/api/index/current`, `/api/index/history`, `/api/anomalies`, `/api/backtest`, etc.) for MoSPI/RBI data consumption.
10. **Hybrid Collection Strategy:** Toggle between Live Connector mode (ethical scraping with rate limiting & `robots.txt` compliance) and Demo Fixture mode (12,000+ observations over 30 days).

---

## Tech Stack

- **Backend:** Python 3.11, FastAPI, Pandas, NumPy, SciPy, Pydantic
- **Frontend:** React, Tailwind CSS, Lucide Icons, Recharts, Vite
- **Data Engineering:** IQR outlier engine, Base-100 weighted index engine, Jevons geometric mean, Fisher ideal index

---

## Project Structure

```text
sih/
├── backend/
│   ├── main.py                # FastAPI REST API service
│   ├── data_generator.py      # 30-day realistic fixture & DGCA benchmark generator
│   ├── quality_engine.py       # Deduplication, IQR outlier detection, 0-100 quality score
│   ├── index_engine.py         # Base-100 weighted index, Jevons, Fisher, elasticity
│   ├── anomaly_engine.py       # Rolling median surge alert detection
│   ├── backtest_engine.py      # 30-day DGCA benchmark comparison (Pearson r, MAPE)
│   ├── connectors/            # Scraper connectors (IndiGo, Air India, Akasa Air)
│   └── test_backend.py        # Backend unit tests
├── frontend/
│   ├── src/
│   │   ├── components/        # KPICards, IndexTrendChart, RouteHeatmap, SurgeAlerts, etc.
│   │   ├── App.jsx            # Main dashboard shell
│   │   └── index.css          # Government dark navy styling tokens
│   └── package.json           # Frontend dependencies
├── ARCHITECTURE.md            # System architecture specification
├── METHODOLOGY.md           # Statistical index methodology & formulas
└── README.md
```

---

## How to Run Locally

### 1. Run Backend Service (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
python main.py
```
Backend API will run at `http://localhost:8000`. Documentation available at `http://localhost:8000/docs`.

### 2. Run Frontend Dashboard (Vite + React)
```bash
cd frontend
npm install
npm run dev
```
Frontend UI will run at `http://localhost:3000`.

---

## Institutional Value

- **MoSPI / NSO:** High-frequency transport price measurement to augment monthly CPI.
- **RBI / Policymakers:** Early detection of transport-driven inflation shocks and travel demand surges.
- **Aviation Analysts:** Transparent corridor-level price pressure and carrier market dynamics.
