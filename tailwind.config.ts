import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        up: "#059669",
        down: "#dc2626",
      },
    },
  },
  plugins: [],
};
export default config;
