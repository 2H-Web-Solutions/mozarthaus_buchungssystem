/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#c02a2a',
        'brand-red': '#c02a2a',
        'brand-red-dark': '#8b1e1e',
        'brand-sidebar': '#bababa',
        'brand-main': '#ffffff',
      },
      fontFamily: {
        sans: ['Serif', 'serif'], // Body Font
        heading: ['Roboto', 'sans-serif'], // Heading Font
      }
    },
  },
  plugins: [],
}
