/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        maji: {
          50:  '#f0fdf8',
          100: '#d0f5e9',
          200: '#a4ebd4',
          300: '#6cd7b7',
          400: '#3cbf96',
          500: '#2daf87',
          600: '#2d9d78',
          700: '#237b5e',
          800: '#1b5e47',
          900: '#154b39',
        },
      },
    },
  },
  plugins: [],
}
