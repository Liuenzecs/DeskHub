/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        panel: '0 4px 24px rgba(0, 0, 0, 0.06)',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"PingFang SC"', '"Microsoft YaHei UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
