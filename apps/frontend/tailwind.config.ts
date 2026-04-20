import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f5fe",
          100: "#dce8fb",
          200: "#b3c8f0",
          300: "#7fa3e3",
          400: "#4f80d6",
          500: "#2563c8",
          600: "#1f52a4",
          700: "#1a4080",
          800: "#153060",
          900: "#0f2143",
          950: "#0a1628",
        },
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        // ── Design system tokens (reference CSS variables from globals.css) ──
        ds: {
          bg:            "var(--bg)",
          bg2:           "var(--bg-2)",
          surface:       "var(--surface)",
          surface2:      "var(--surface-2)",
          border:        "var(--border)",
          "border-strong": "var(--border-strong)",
          text1:         "var(--text-1)",
          text2:         "var(--text-2)",
          text3:         "var(--text-3)",
          brand:         "var(--brand)",
          "brand-dark":  "var(--brand-dark)",
          "brand-mid":   "var(--brand-mid)",
          "brand-amber": "var(--brand-amber)",
          "brand-gold":  "var(--brand-gold)",
          "brand-light": "var(--brand-light)",
        },
        // ── Status semantic tokens ──
        "ds-success": {
          DEFAULT: "var(--success)",
          bg:      "var(--success-bg)",
          border:  "var(--success-border)",
          text:    "var(--success-text)",
        },
        "ds-error": {
          DEFAULT: "var(--error)",
          bg:      "var(--error-bg)",
          border:  "var(--error-border)",
          text:    "var(--error-text)",
        },
        "ds-warning": {
          DEFAULT: "var(--warning)",
          bg:      "var(--warning-bg)",
          border:  "var(--warning-border)",
          text:    "var(--warning-text)",
        },
        "ds-info": {
          DEFAULT: "var(--info)",
          bg:      "var(--info-bg)",
          border:  "var(--info-border)",
          text:    "var(--info-text)",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;