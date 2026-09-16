/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#002558",
        "on-primary": "#ffffff",
        "primary-container": "#123b7a",
        "on-primary-container": "#87a7ed",
        secondary: "#0054cb",
        "on-secondary": "#ffffff",
        "secondary-container": "#2d6deb",
        "on-secondary-container": "#fefcff",
        tertiary: "#002d2b",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#004543",
        "on-tertiary-container": "#39b9b4",
        surface: "#F3F4F1",
        "on-surface": "#191c1e",
        "on-surface-variant": "#434750",
        "surface-canvas": "#F3F4F1",
        "surface-card": "#FAF9F5",
        "surface-subtle": "#E7E9E3",
        "surface-variant": "#DFE2DA",
        "border-hairline": "#D9DCD4",
        "border-focus": "#1a56db",
        "text-primary": "#0F172A",
        "text-secondary": "#475569",
        "text-muted": "#64748B",
        "metric-positive": "#16A34A",
        "metric-warning": "#EA580C",
        "metric-negative": "#DC2626",
        "badge-positive-bg": "#DCFCE7",
        "badge-warning-bg": "#FFEDD5",
        "badge-negative-bg": "#FEE2E2",
        "chart-accent-cyan": "#38BDF8",
        outline: "#747781",
        "outline-variant": "#c4c6d2"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        "gutter-dense": "0.5rem",
        "space-lg": "1rem",
        "space-xl": "1.5rem",
        gutter: "1rem",
        "space-xs": "0.25rem",
        "space-md": "0.75rem",
        "space-sm": "0.5rem",
        margin: "1.5rem",
        "margin-mobile": "1rem"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        headline: ["IBM Plex Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      }
    },
  },
  plugins: [],
}
