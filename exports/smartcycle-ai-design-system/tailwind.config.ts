/**
 * SmartCycle AI Design System - Tailwind Configuration
 * Version: 1.0.0
 *
 * This configuration extends Tailwind CSS with SmartCycle AI's design tokens.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS variable-based colors (from globals.css)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        // SmartCycle AI brand colors (direct values)
        smartcycle: {
          // Primary purple
          purple: {
            50: "#faf5ff",
            100: "#f3e8ff",
            200: "#e9d5ff",
            300: "#d8b4fe",
            400: "#c084fc",
            500: "#8b5cf6",  // Primary
            600: "#7c3aed",
            700: "#6d28d9",
            800: "#5b21b6",
            900: "#4c1d95",
          },
          // Dark backgrounds
          dark: {
            50: "#fafafa",
            100: "#f5f5f5",
            200: "#e5e5e5",
            300: "#d4d4d4",
            400: "#a3a3a3",
            500: "#737373",
            600: "#525252",  // Border
            700: "#404040",  // Input/Secondary
            800: "#262626",  // Card
            900: "#171717",  // Background
            950: "#0a0a0a",
          },
        },

        // Agent role colors
        agent: {
          coordinator: "#8b5cf6",
          "product-owner": "#3b82f6",
          coder: "#22c55e",
          tester: "#f59e0b",
          security: "#ef4444",
          fixer: "#f97316",
        },
      },

      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      boxShadow: {
        "glow-purple": "0 0 20px rgba(139, 92, 246, 0.3)",
        "glow-green": "0 0 20px rgba(34, 197, 94, 0.3)",
        "glow-blue": "0 0 20px rgba(59, 130, 246, 0.3)",
      },

      animation: {
        "gradient-shimmer": "gradient-shimmer 3s ease infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "status-pulse": "status-pulse 1.5s ease-in-out infinite",
      },

      keyframes: {
        "gradient-shimmer": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "glow-pulse": {
          "0%, 100%": {
            textShadow: "0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)",
            opacity: "1",
          },
          "50%": {
            textShadow: "0 0 20px rgba(139, 92, 246, 0.8), 0 0 40px rgba(139, 92, 246, 0.5)",
            opacity: "0.9",
          },
        },
        "status-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};

export default config;
