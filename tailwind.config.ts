import type { Config } from "tailwindcss";
import { heroui } from "@heroui/theme";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
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
            focus: "#e84c65",
          },
        },
      },
    }),
  ],
};

export default config;
