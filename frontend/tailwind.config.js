/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // Palette "Dark Industrial Luxury"
          background: "#09090b", // Noir profond
          surface: "#18181b",    // Gris sombre
          surfaceLight: "#27272a", 
          
          primary: "#f59e0b",    // Or / Ambre (Le côté Cocktail)
          primaryGlow: "rgba(245, 158, 11, 0.5)", 
          
          accent: "#06b6d4",     // Cyan (Le côté Tech)
          danger: "#ef4444",     // Rouge (Erreur)
          
          textMain: "#f4f4f5",   // Blanc cassé
          textMuted: "#a1a1aa",  // Gris clair
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
          mono: ['JetBrains Mono', 'monospace'],
        },
      },
    },
    plugins: [],
  }
  