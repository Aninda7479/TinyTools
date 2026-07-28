/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgba(30, 30, 30, 0.8)",
          solid: "#1e1e1e",
          hover: "rgba(50, 50, 50, 0.8)",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.1)",
          hover: "rgba(255, 255, 255, 0.2)",
        },
      },
      backdropBlur: {
        xl: "20px",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
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
