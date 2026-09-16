---
name: Precision Platform Governance
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434750'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747781'
  outline-variant: '#c4c6d2'
  surface-tint: '#3b5d9e'
  primary: '#002558'
  on-primary: '#ffffff'
  primary-container: '#123b7a'
  on-primary-container: '#87a7ed'
  inverse-primary: '#aec6ff'
  secondary: '#0054cb'
  on-secondary: '#ffffff'
  secondary-container: '#2d6deb'
  on-secondary-container: '#fefcff'
  tertiary: '#002d2e'
  on-tertiary: '#ffffff'
  tertiary-container: '#004546'
  on-tertiary-container: '#45b8ba'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#aec6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#204584'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b1c5ff'
  on-secondary-fixed: '#001847'
  on-secondary-fixed-variant: '#0040a0'
  tertiary-fixed: '#87f4f5'
  tertiary-fixed-dim: '#69d7d9'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#004f51'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system delivers an institutional-grade, mission-critical administrative interface for enterprise aviation oversight, surveillance telemetry, and platform governance. Designed for fleet administrators, compliance officers, and systems engineers, the visual tone conveys structural authority, immaculate data hygiene, and calm operational focus.

Drawing from modern enterprise utility and high-density institutional systems, the visual architecture rejects decorative noise in favor of disciplined alignment, clear state delineation, and optical rhythm. High information density is balanced by a disciplined hierarchy: crisp boundaries, distinct interactive planes, and rigorous typographic structure allow operators to navigate complex compliance matrices and cryptographic configurations without cognitive fatigue.

## Colors
The palette leverages deep institutional tones with high-clarity accents to differentiate navigational architecture from interactive and diagnostic layers:

- **Primary Navy (`#123B7A`):** Anchors core structure, top-level navigation, and primary button actions.
- **Secondary Active Blue (`#2F6FED`):** Drives interactive states, focused focus rings, active rail navigation items, and in-progress workflows.
- **Tertiary Teal (`#159A9C`):** Highlights telemetry flags, verified statuses, and secondary metric badges.
- **Neutral Canvas & Borders:** Background uses pure crisp paper (`#F8FAFC`), surfaces use elevated white (`#FFFFFF`), structural lines use subtle structural slate (`#E2E8F0`), and metadata labels use muted slate (`#64748B`). Text content is anchored in deep graphite (`#0F172A`).
- **Functional Semantics:** Success Emerald (`#16A34A`) for operational validity, Warning Amber (`#F59E0B`) for governance expirations/audit alerts, and Danger Crimson (`#DC2626`) for destructive revocations and access termination.

## Typography
Typographic hierarchy is powered by **IBM Plex Sans** for clear, legible enterprise data processing, coupled with **JetBrains Mono** for cryptographic hashes, API credentials, IP allocations, and tabular governance logs.

All numeric figures within data tables, quotas, and audit trails must enforce tabular lining figures (`font-variant-numeric: tabular-nums`) to preserve optical alignment across dynamic feeds. Monospaced tokens (`code-md`, `code-sm`) are strictly applied to immutable IDs, audit log timestamps, and system tokens.

## Layout & Spacing
The layout leverages an asymmetric split-canvas system optimized for standard enterprise dashboards (1440px standard canvas):

- **Left Settings Rail:** Fixed 280px navigation rail anchoring module categories (Organization, Telemetry Keys, RBAC, Audit Vault).
- **Primary Content Viewport:** Fluid 12-column grid system with 1.5rem (`24px`) gutters and 2rem (`32px`) margins. Spans structured form sets, verification panels, and compliance matrices.
- **Fixed Governance Action Bar:** Anchored 64px bottom execution bar that pins primary mutations (Save Changes, Rollback, Export Keys) across vertical scroll views.
- **Form Groups:** Compact vertical stack spacing (0.5rem between label and input, 1.25rem between field groups) to support efficient single-screen scanning without excess vertical scrolling.
- **Responsive Adaptations:** Below 1024px desktop, the left rail collapses into a slide-over drawer triggered by a secondary header bar, while gutters compress to 1rem.

## Elevation & Depth
Depth is established primarily through **low-contrast outlines** (`1px solid #E2E8F0`) and stacked tonal surfaces, maintaining an analytical plane rather than heavy simulated shadows:

- **Level 0 (Canvas Base):** `#F8FAFC` — un-elevated system foundation.
- **Level 1 (Panels & Cards):** `#FFFFFF` with a crisp `1px solid #E2E8F0` border. Zero drop-shadow in rest state; subtle surface tint on inactive rows (`#F8FAFC`).
- **Level 2 (Dropdowns, Popovers & Context Menus):** `#FFFFFF` with `1px solid #CBD5E1` and an ambient, low-opacity shadow: `0 4px 16px -2px rgba(18, 59, 122, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)`.
- **Level 3 (Modal Dialogs & Confirmation Overlays):** `#FFFFFF` resting over a tinted scrim (`rgba(15, 23, 42, 0.45)`) with an authoritative elevation shadow: `0 20px 25px -5px rgba(18, 59, 122, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)`.
- **Level 4 (Fixed Action Dock):** Elevated bottom bar featuring a distinct top border (`1px solid #E2E8F0`) paired with a reverse ambient drop: `0 -4px 12px rgba(15, 23, 42, 0.04)`.

## Shapes
A conservative, structural roundedness level of `1` (Soft: `0.25rem` / `4px`) is utilized across inputs, buttons, table containers, and alerts. This compact geometry reinforces the technical, institutional aesthetic. 

- **Inputs, Buttons & Badges:** `rounded` (0.25rem / 4px) for precision-cut corners.
- **Cards & Data Grids:** `rounded-lg` (0.5rem / 8px) container bounds with clipped borders.
- **Segmented Control Pills:** Encapsulated within a `rounded` (4px) track containing adjacent `rounded-sm` (2px) interactive active state segments.

## Components

### Buttons
- **Primary:** `#123B7A` background, pure white text, 4px radius, 36px height (medium) or 32px height (compact). Hover transitions to `#1E4E9D`; active state `#0E2E60`.
- **Secondary / Ghost:** Transparent background, `1px solid #E2E8F0`, `#0F172A` text. Hover applies `#F1F5F9` surface fill.
- **Destructive:** White surface with `1px solid #DC2626` outline and `#DC2626` text. Active/hover transitions to `#DC2626` background with pure white text.

### Segmented Controls & Pills
- Inline switchers configured in a single-unit housing with `#F1F5F9` background and 2px inner padding.
- Selected pill assumes `#FFFFFF` background with subtle line border (`#E2E8F0`) and bold active typography, sliding horizontally on state change.

### Form Fields & Inputs
- **Base Text / Select:** 36px height, `#FFFFFF` background, `1px solid #E2E8F0`, `#0F172A` text. Placeholder in `#94A3B8`.
- **Focus State:** 2px ring in Secondary Active Blue (`#2F6FED`) with no optical offset.
- **Help & Validation:** Displayed 4px below field; error triggers `#DC2626` text and border with leading warning icon.

### Checkboxes & Radio Buttons
- 16x16px targets with `#E2E8F0` borders. Checked state fills with `#2F6FED` exhibiting crisp white micro-glyphs (check or dot).

### Data Tables & Governance Lists
- **Header:** Sticky header with `#F8FAFC` background, uppercase tracking (`label-md`), `#64748B` color, bottom boundary `1px solid #E2E8F0`.
- **Rows:** 44px compact height, alternating hover state (`#F8FAFC`). Monospaced figures align right for quantitative values; identifiers display with copy-to-clipboard micro-actions.

### Fixed Bottom Governance Action Bar
- Pinned to the base of the viewport (`height: 64px`, `background: #FFFFFF`, `border-top: 1px solid #E2E8F0`).
- Left quadrant displays state context (e.g., "3 unsaved policy changes"). Right quadrant groups secondary actions ("Discard") next to primary commitment buttons ("Apply Changes").