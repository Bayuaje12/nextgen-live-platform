import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F6F7F2",
        surface: "#FFFFFF",
        ink: "#141414",
        muted: "#5E625A",
        lime: "#C7F000",
        violet: "#7C4DFF",
        danger: "#FF4D4D",
        success: "#1DB954",
      },
      boxShadow: {
        brutal: "4px 4px 0 0 #141414",
        "brutal-sm": "2px 2px 0 0 #141414",
        "brutal-lg": "8px 8px 0 0 #141414",
      },
      borderWidth: {
        3: "3px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
