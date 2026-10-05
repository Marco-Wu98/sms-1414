import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: "#16332f", mint: "#d9f3e8", canvas: "#f4f7f4" }, boxShadow: { card: "0 12px 36px rgba(17, 48, 41, .07)" } } },
  plugins: [],
} satisfies Config;
