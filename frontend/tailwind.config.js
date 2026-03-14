/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // Palette "Dark Industrial Luxury"
          background: {
            DEFAULT: "#09090b", // Sombre par défaut
            light: "#f4f4f5", // Clair
          },
          surface: {
            DEFAULT: "#18181b", 
            light: "#ffffff",
          },
          surfaceLight: {
            DEFAULT: "#27272a",
            light: "#e4e4e7",
          },
          
          primary: "#f59e0b",    // Or / Ambre (Le côté Cocktail)
          primaryGlow: "rgba(245, 158, 11, 0.5)", 
          
          accent: "#06b6d4",     // Cyan (Le côté Tech)
          danger: "#ef4444",     // Rouge (Erreur)
          
          textMain: {
            DEFAULT: "#f4f4f5",
            light: "#18181b",
          },
          textMuted: {
            DEFAULT: "#a1a1aa",
            light: "#71717a",
          },
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
          mono: ['JetBrains Mono', 'monospace'],
        },
      },
    },
    plugins: [],
  }
  