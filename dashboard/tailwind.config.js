/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mono: {
          bg: "#000000",
          card: "#09090b",
          surface: "#121214",
          border: "#27272a",
          borderHover: "#3f3f46",
          muted: "#71717a",
          text: "#f4f4f5",
          white: "#ffffff",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
