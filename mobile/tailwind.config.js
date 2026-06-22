/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'power-orange': '#E97316',
        'deep-slate': '#0F172A',
        'ghost-white': '#F8FAFC',
        'turf-green': '#22C55E',
        'error-red': '#EF4444',
        background: '#f4f7ff',
        foreground: '#111827',
        border: '#E5E7EB',
        muted: '#6B7280',
        card: '#FFFFFF',
        'card-foreground': '#111827',
        primary: '#0F172A',
        'primary-foreground': '#F8FAFC',
      },
    },
  },
  plugins: [],
};
