/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#c02a2a',
          sidebar: '#bababa',
          main: '#ffffff',
        }
      },
      fontFamily: {
        sans: ['Serif', 'serif'], // Body Font
        heading: ['Roboto', 'sans-serif'], // Heading Font
      }
    },
  },
  plugins: [],
}
