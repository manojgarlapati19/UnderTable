import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#7C3AED",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
        },
        // Design system custom colors
        dark: {
          bg: "#07070D",
          "bg-alt": "#0B0B14",
          "bg-main": "#0E0E1A",
          surface: "#13131F",
          bubble: "#16162A",
          border: "#18182A",
          "border-hover": "#22223A",
        },
        accent: {
          DEFAULT: "#7C3AED",
          hover: "#A855F7",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#8888A0",
          muted: "#56566E",
          hint: "#4A4A60",
        },
        status: {
          online: "#22C55E",
          idle: "#F59E0B",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          hover: "var(--sidebar-hover)",
          active: "var(--sidebar-active)",
        },
        card: {
          DEFAULT: "var(--card-bg)",
          foreground: "var(--card-foreground)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #7C3AED, #9333EA)",
        "accent-gradient-hover": "linear-gradient(135deg, #7C3AED, #A855F7)",
        "auth-bg": "radial-gradient(circle at 50% 30%, #1A1530 0%, #0B0B14 100%)",
        "message-own": "linear-gradient(135deg, #7C3AED, #9333EA)",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        "pulse-dot": {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%": { transform: "scale(1)" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "message-highlight-anim": {
          "0%": { backgroundColor: "rgba(124, 58, 237, 0.15)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "bounce-in": "bounce-in 0.3s ease-out",
        "pulse-dot": "pulse-dot 1.4s infinite ease-in-out both",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "message-highlight": "message-highlight-anim 2s ease-out",
      },
      borderRadius: {
        "bubble": "16px",
        "input": "12px",
        "icon": "11px",
        "full": "50%",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
