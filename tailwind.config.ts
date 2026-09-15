import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        danger: "#ef4444",
        success: "#22c55e",
      },
    },
  },
  plugins: [],
};

export default config;
