import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef1f2",
          100: "#fde6e8",
          200: "#fbd0d5",
          300: "#f8aab3",
          400: "#f27a8a",
          500: "#e84c65",
          600: "#d42a4e",
          700: "#b21e40",
          800: "#951b3b",
          900: "#7f1a38",
          DEFAULT: "#e84c65",
          foreground: "#ffffff",
        },
        default: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          DEFAULT: "#d4d4d8",
        },
        background: "#ffffff",
        foreground: "#18181b",
        focus: "#e84c65",
      },
    },
  },
  darkMode: "class",
  plugins: [],
};

export default config;
