# AirScope Fare Intelligence Specification

## 1. Executive Overview & Architecture

The AirScope Fare Intelligence layer provides an end-to-end, auditable, and regulatory-grade pipeline for parsing, standardizing, validating, and monitoring Indian domestic airfares across airline direct portals and Online Travel Aggregators (OTAs).

### Core Pillars
1. **Fare-Class & Fare-Family Taxonomy**: Standardizes brand offerings (e.g., IndiGo Saver/Flexi/Super6E, Air India Comfort/Comfort Plus/Flex) into deterministic canonical tiers without fabrication.
2. **Component Breakdown**: Rigorously separates base fare, statutory aviation taxes (User Development Fee, Passenger Service Fee, GST), airline fuel/carrier surcharges (YQ/YR), and checkout convenience fees (OTA vs Airline direct).
3. **Strict Truth in Data (No Dummy Values)**: Where fee breakdowns or convenience fees are undisclosed prior to final checkout, fields remain strictly `NULL`. The engine attaches quality flags (`TAX_BREAKDOWN_UNAVAILABLE`, `CONVENIENCE_FEE_NOT_DISCLOSED`) rather than injecting arbitrary percentages or zeros.
4. **Availability & Inventory Lifecycle**: Fully captures cancelled flights, sold-out inventories, and technical fetch failures. These records maintain `availability_status = "SOLD_OUT"` or `"CANCELLED"` with `total_fare = None`. They are **never** treated as ₹0, **never** dropped, and **excluded** from price index math while powering availability analytics.
5. **Arithmetic Integrity**: Employs automated reconciliation:
   $$\text{Total Fare} \approx \text{Base Fare} + \text{Taxes} + \text{Surcharges} + \text{Fees}$$
   Discrepancies exceeding ₹1.0 trigger `TOTAL_FARE_MISMATCH` flags and mark data status as `PARTIAL`.

---

## 2. Canonical Data Model

| Field | Type | Description | Nullable / Example |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR / UUID` | Unique observation identifier | `PK, e.g. "IND-6E-DEL-BOM-20261015-0800"` |
| `flight_hash` | `CHAR(64)` | SHA-256 fingerprint for deduplication | `b5a98...` |
| `origin` | `VARCHAR(3)` | IATA code of origin airport | `DEL` |
| `destination` | `VARCHAR(3)` | IATA code of destination airport | `BOM` |
| `route` | `VARCHAR(7)` | Directional corridor key | `DEL-BOM` |
| `airline` | `VARCHAR(50)` | Marketing carrier name | `IndiGo` |
| `flight_number` | `VARCHAR(20)` | Published flight number | `6E 2045` |
| `departure_time` | `TIMESTAMPTZ` | Scheduled departure time | `2026-10-15T08:00:00+05:30` |
| `arrival_time` | `TIMESTAMPTZ` | Scheduled arrival time | `2026-10-15T10:15:00+05:30` |
| `source` | `VARCHAR(50)` | Data acquisition provider | `MakeMyTrip`, `IndiGo Direct` |
| `source_type` | `VARCHAR(20)` | Origin type | `OTA`, `AIRLINE` |
| `cabin_class` | `VARCHAR(20)` | Canonical cabin class | `ECONOMY`, `PREMIUM_ECONOMY`, `BUSINESS`, `FIRST`, `UNKNOWN` |
| `fare_family` | `VARCHAR(30)` | Canonical product tier | `SAVER`, `FLEXI`, `REGULAR`, `CORPORATE`, `UNKNOWN` |
| `fare_brand` | `VARCHAR(50)` | Commercial branded fare name | `Super 6E`, `Flexi Plus`, `Comfort` |
| `fare_basis` | `VARCHAR(20)` | IATA fare basis code | `V21SAV`, `YFLEX`, or `NULL` |
| `raw_fare_class` | `VARCHAR(10)` | Single-letter booking code | `V`, `Q`, `M`, `Y`, `J`, or `NULL` |
| `base_fare` | `FLOAT` | Core airline inventory tariff | `₹4,250.00` (or `NULL` if unavailable) |
| `taxes` | `FLOAT` | Statutory government / airport charges (GST, UDF, PSF) | `₹650.00` (or `NULL`) |
| `surcharges` | `FLOAT` | Carrier airline fuel surcharges (YQ/YR) | `₹350.00` (or `NULL`) |
| `other_charges` | `FLOAT` | Ancillaries, baggage fees, seat selection charges | `₹0.00` (or `NULL`) |
| `convenience_fee` | `FLOAT` | Booking/payment processing fee | `₹399.00` (or `NULL` if undisclosed) |
| `total_fare` | `FLOAT` | Final payable consumer tariff | `₹5,250.00` (strictly `NULL` if sold out) |
| `currency` | `VARCHAR(3)` | ISO currency code | `INR` |
| `availability_status`| `VARCHAR(20)` | Flight operational & booking state | `AVAILABLE`, `SOLD_OUT`, `CANCELLED`, `UNAVAILABLE` |
| `seats_remaining` | `INT` | Remaining seats in fare bucket | `3` (or `NULL` if not broadcast) |
| `data_quality_status`| `VARCHAR(20)` | Verification rating | `VALID`, `PARTIAL`, `INVALID`, `UNAVAILABLE`, `ERROR` |
| `quality_flags` | `TEXT[]` | Explanatory defect / audit annotations | `['TAX_BREAKDOWN_UNAVAILABLE']` |
| `quality_score` | `INT` | Quantitative score (0-100) | `100` (or degraded) |
| `advance_purchase_days` | `INT` | Booking horizon window in days | `14` |
| `observation_timestamp` | `TIMESTAMPTZ` | Capture timestamp | Current UTC |

---

## 3. Cabin & Fare-Family Normalization Rules

Standardization logic resides in [`backend/fare_normalizer.py`](file:///c:/Users/spriy/Downloads/sih/backend/fare_normalizer.py).

### 3.1 Cabin Class Mapping
- **`ECONOMY`**: Economy, Coach, Standard, Main Cabin, Eco, Saver.
- **`PREMIUM_ECONOMY`**: Premium Economy, Prem Eco, Economy Plus, Comfort Plus.
- **`BUSINESS`**: Business, Club, Executive, Premiere, Biz, J Class.
- **`FIRST`**: First, Suites, First Class.
- **`UNKNOWN`**: Assigned when no reliable keyword or booking code is present. Never guessed.

### 3.2 Fare Family Mapping
- **`SAVER`**: Saver, Lite, Basic, Hand Baggage Only, Super Saver, Economy Lite.
- **`REGULAR`**: Regular, Standard, Classic, Comfort, Value, Normal.
- **`FLEXI`**: Flexi, Flex, Flexible, Super 6E, Comfort Plus, Flexi Plus.
- **`CORPORATE`**: Corporate, SME, Biz Fare, Business Flex.
- **`UNKNOWN`**: When unspecified by the source.

---

## 4. Fee Decomposition & Arithmetic Integrity

Validation logic resides in [`backend/fare_validator.py`](file:///c:/Users/spriy/Downloads/sih/backend/fare_validator.py).

### 4.1 Reconciliation Equation
$$\text{Expected Total} = \text{base\_fare} + \text{taxes} + \text{surcharges} + \text{other\_charges} + \text{convenience\_fee}$$

### 4.2 Discrepancy Handling
- **Threshold**: Allowed rounding tolerance is $\le ₹1.00$.
- **Error Flag**: If $|\text{Total} - \text{Expected}| > 1.0$, the engine emits `TOTAL_FARE_MISMATCH`.
- **Status Degradation**: `data_quality_status` degrades from `VALID` to `PARTIAL`, deducting 25 quality points.

### 4.3 Convenience Fee Segregation
- **OTA Portals**: Convenience fees range between ₹299–₹450 per passenger for domestic sectors. When the source does not expose this charge prior to checkout step 3, `convenience_fee` is set to `None` with `CONVENIENCE_FEE_NOT_DISCLOSED`.
- **Airline Direct**: May waive convenience fees on UPI/NetBanking or charge ₹200–₹300 on credit cards. Strictly stored as `0.0` only when explicitly published as waived, otherwise `None`.

---

## 5. Handling Unavailable, Sold-Out, & Cancelled Inventories

### 5.1 Retention Mandate
AirScope strictly forbids pruning or filtering out unavailable flights during ingestion:
1. **Sold-Out Flights (`SOLD_OUT`)**: `total_fare = None`, `base_fare = None`. Represents genuine inventory depletion during peak demand.
2. **Cancelled Flights (`CANCELLED`)**: Retained to track carrier schedule reliability and operational disruption.
3. **Capture Errors (`UNAVAILABLE` / `ERROR`)**: Preserved with error trace in `quality_flags` for collector observability.

### 5.2 Index Engine Treatment
In [`backend/index_engine.py`](file:///c:/Users/spriy/Downloads/sih/backend/index_engine.py):
- **Excluded From Price Averaging**: Flights where `availability_status != "AVAILABLE"` or `total_fare is None` are filtered out before calculating geometric or arithmetic mean airfares.
- **Included In Availability Analytics**:
  $$\text{Availability Rate (\%)} = \frac{N_{\text{AVAILABLE}}}{N_{\text{Total Obs}}} \times 100$$
  $$\text{Sold Out Rate (\%)} = \frac{N_{\text{SOLD\_OUT}}}{N_{\text{Total Obs}}} \times 100$$
  $$\text{Cancellation Rate (\%)} = \frac{N_{\text{CANCELLED}}}{N_{\text{Total Obs}}} \times 100$$

---

## 6. REST API Endpoints

AirScope backend exposes comprehensive fare intelligence queries in [`backend/main.py`](file:///c:/Users/spriy/Downloads/sih/backend/main.py):

| Endpoint | Method | Key Parameters | Description |
| :--- | :--- | :--- | :--- |
| `/api/fares` | `GET` | `page, limit, route, airline, cabin_class, fare_family, availability_status, data_quality_status` | Paginated fare ledger with granular filters |
| `/api/fares/{fare_id}` | `GET` | `fare_id` (Path) | Full record lookup with audit metadata |
| `/api/fares/{fare_id}/breakdown` | `GET` | `fare_id` (Path) | Unbundled breakdown with arithmetic verification |
| `/api/fares/availability` | `GET` | `route, start_date, end_date` | Aggregate availability, sold-out & cancellation statistics |
| `/api/fares/quality` | `GET` | `source, start_date, end_date` | Data quality score, status distribution & flag breakdown |
| `/api/routes/{route}/price-history` | `GET` | `route, cabin_class, fare_family` | Time-series historical pricing filtered by fare tier |
| `/api/routes/{route}/availability` | `GET` | `route, days` | Corridor-specific inventory availability telemetry |
| `/api/index/airfare` | `GET` | `frequency, base_period, cabin_class` | Regulatory airfare index with component price movement decomposition |

---

## 7. Quality Flags Taxonomy

- `TOTAL_FARE_MISMATCH`: Sum of price components differs from total fare by $> ₹1.0$.
- `TAX_BREAKDOWN_UNAVAILABLE`: Total fare provided without itemized statutory tax breakdown.
- `CONVENIENCE_FEE_NOT_DISCLOSED`: Upfront quote omits downstream payment/convenience surcharge.
- `SOLD_OUT_FLIGHT`: Flight inventory has zero seats remaining; pricing disabled.
- `CANCELLED_FLIGHT`: Flight scheduled but officially cancelled by operating carrier.
- `UNREALISTIC_FARE`: Total fare is below statutory minimum floor (₹500) or above ceiling (₹150,000).
- `OUTLIER_FARE`: Price falls beyond $1.5 \times \text{IQR}$ for the specific route and horizon tranche.
- `DUPLICATE_OBSERVATION`: Observation hash collision detected within the same collection window.
