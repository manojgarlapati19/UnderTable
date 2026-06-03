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
          DEFAULT: "#A78BFA",
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
        accent: {
          DEFAULT: "#A78BFA",
          hover: "#F0ABFC",
        },
        glass: {
          white: "rgba(255,255,255,0.05)",
          light: "rgba(255,255,255,0.08)",
          medium: "rgba(255,255,255,0.1)",
          border: "rgba(255,255,255,0.08)",
          "border-light": "rgba(255,255,255,0.1)",
          "border-medium": "rgba(255,255,255,0.16)",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "rgba(255,255,255,0.7)",
          muted: "rgba(255,255,255,0.45)",
          hint: "rgba(255,255,255,0.35)",
          lavender: "#C4B5FD",
        },
        status: {
          online: "#34D399",
          idle: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, #A78BFA, #F0ABFC)",
        "primary-gradient-hover": "linear-gradient(135deg, #B99BFC, #F5BCFC)",
        "message-own": "linear-gradient(135deg, #A78BFA, #F0ABFC)",
      },
      boxShadow: {
        glow: "0 8px 32px rgba(167,139,250,0.5)",
        "glow-sm": "0 4px 16px rgba(167,139,250,0.3)",
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
          "0%": { backgroundColor: "rgba(167, 139, 250, 0.15)" },
          "100%": { backgroundColor: "transparent" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-6px)" },
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
        "bounce-dot": "bounce-dot 1.4s infinite ease-in-out both",
      },
      borderRadius: {
        "bubble": "17px",
        "input": "13px",
        "icon": "11px",
        "card": "14px",
        "auth": "24px",
        "full": "50%",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
