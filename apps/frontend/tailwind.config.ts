import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: false,
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