/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC",
        line: "#CBD5E1",
        ink: { DEFAULT: "#0F172A", body: "#334155", muted: "#64748B" },
        crimson: { 50: "#FEF2F2", 100: "#FEE2E2", 200: "#FECACA", 500: "#EF4444", 600: "#DC2626", 700: "#B91C1C", 800: "#991B1B" },
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "crimson-grad": "linear-gradient(135deg, #991B1B 0%, #DC2626 60%, #EF4444 100%)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.12)",
        lift: "0 2px 4px rgba(15,23,42,.06), 0 18px 40px -16px rgba(15,23,42,.25)",
      },
    },
  },
  plugins: [],
};
