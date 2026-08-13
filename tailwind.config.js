/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        hanken: ["'Hanken Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "rgba(30, 30, 30, 0.8)",
          solid: "#0c1324",
          hover: "rgba(50, 50, 50, 0.8)",
          dim: "#0c1324",
          bright: "#33394c",
          container: "#191f31",
          "container-low": "#151b2d",
          "container-high": "#23293c",
          "container-highest": "#2e3447",
        },
        card: {
          DEFAULT: "#1E293B",
          hover: "#283548",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.1)",
          hover: "rgba(255, 255, 255, 0.2)",
        },
        "primary-blue": "#3B82F6",
        "surface-tint": "#adc6ff",
        "on-surface": "#dce1fb",
        "on-surface-variant": "#c2c6d6",
        "outline-variant": "#424754",
      },
      backdropBlur: {
        xl: "20px",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      spacing: {
        "unit": "4px",
        "container-padding": "16px",
        "card-gap": "12px",
        "section-margin": "24px",
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
