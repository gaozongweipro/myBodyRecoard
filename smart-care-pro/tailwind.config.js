/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',   // Blue-500
        secondary: '#10B981', // Emerald-500
        accent: '#8B5CF6',    // Violet-500
        background: '#F8FAFC',// Slate-50
      }
    },
  },
  plugins: [],
}
