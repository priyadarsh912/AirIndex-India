# System Architecture — AirIndex India (SIH26056)

```text
 ┌────────────────────────────────────────────────────────┐
 │                 DATA SOURCES & CONNECTORS              │
 │  MakeMyTrip (OTA) | Ixigo (OTA) [Playwright Scrapers] │
 │  Airline Direct APIs: Planned (IndiGo, AI, IX, QP)    │
 │  (Rate limiting: 3.0s + jitter, robots.txt compliant) │
 └──────────────────────────┬─────────────────────────────┘
                            ↓
 ┌────────────────────────────────────────────────────────┐
 │             DATA QUALITY & CLEANING ENGINE             │
 │ Missing-Value Flagging | Deduplication | IQR Bounds    │
 │ Quality Scoring (0-100) | Seat Availability Check      │
 └──────────────────────────┬─────────────────────────────┘
                            ↓
 ┌────────────────────────────────────────────────────────┐
 │                STATISTICAL INDEX ENGINE                │
 │ Base-100 Airfare Price Index (APIx)                    │
 │ Jevons Geometric Mean | Fisher Ideal Index             │
 │ Booking Window Elasticity (T+45 to T+1)                │
 └──────────────────────────┬─────────────────────────────┘
                            ↓
 ┌────────────────────────────────────────────────────────┐
 │              ANOMALY & BACKTESTING MODULE              │
 │ 7-Day Rolling Baseline Surge Detection                 │
 │ 30-Day DGCA Benchmark Pearson r & MAPE Evaluation      │
 └──────────────────────────┬─────────────────────────────┘
                            ↓
 ┌────────────────────────────────────────────────────────┐
 │                FASTAPI REST SERVICE                    │
 └──────────────────────────┬─────────────────────────────┘
                            ↓
 ┌────────────────────────────────────────────────────────┐
 │          NEXT.JS / REACT ANALYTICS DASHBOARD           │
 └────────────────────────────────────────────────────────┘
```
