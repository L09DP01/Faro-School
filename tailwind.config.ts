import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* Faro School Dedicated Brand Tokens */
        "navy-deep": "var(--navy-deep)",
        navy: "var(--navy)",
        "navy-hero": "var(--navy-hero)",
        orange: {
          DEFAULT: "var(--orange)",
          strong: "var(--orange-strong)",
          tint: "var(--orange-tint)",
        },
        blue: {
          DEFAULT: "var(--blue)",
          light: "var(--blue-light)",
          tint: "var(--blue-tint)",
        },
        ink: "var(--ink)",
        "muted-faro": "var(--muted)",
        line: "var(--line)",
        bg: "var(--bg)",
        surface: "var(--surface)",
        ok: {
          DEFAULT: "var(--ok)",
          tint: "var(--ok-tint)",
        },
        red: {
          DEFAULT: "var(--red)",
          tint: "var(--red-tint)",
        },
        "chat-bubble-own": "var(--chat-bubble-own)",
        "chat-bg": "var(--chat-bg)",
        "slate-panel": "var(--slate-panel)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "0.75rem", // 12px
        "2xl": "1rem", // 16px
        "3xl": "1.25rem", // 20px
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        heading: ["var(--font-heading)", "Poppins", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(16, 24, 40, 0.05), 0 1px 2px rgba(16, 24, 40, 0.03)",
        card: "0 4px 12px -2px rgba(16, 24, 40, 0.06), 0 2px 6px -2px rgba(16, 24, 40, 0.04)",
        lift: "0 10px 24px -4px rgba(16, 24, 40, 0.08), 0 4px 8px -2px rgba(16, 24, 40, 0.03)",
        orange: "0 8px 20px -4px rgba(255, 127, 14, 0.35)",
      },
      spacing: {
        "container-padding": "var(--container-padding, 1rem)",
      },
    },
  },
  plugins: [],
};

export default config;
