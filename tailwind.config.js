/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#07060c',
        panel: '#0d0b15',
        card: '#14111f',
        raised: '#1a1628',
        line: 'rgba(255,255,255,0.07)',
        primary: {
          50: '#f3efff',
          100: '#e9e2ff',
          200: '#d4c8ff',
          300: '#b7a5fe',
          400: '#9a7bfb',
          500: '#8257f5',
          600: '#7038e8',
          700: '#5f28c9',
        },
        accent: {
          DEFAULT: '#f59e0b',
          soft: '#fbbf24',
        },
        mint: '#4ade80',
        teal2: '#2dd4bf',
        rose2: '#fb7185',
        sky2: '#38bdf8',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(139,92,246,0.55)',
        'glow-sm': '0 0 22px -8px rgba(139,92,246,0.7)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        wave: {
          '0%, 60%, 100%': { transform: 'rotate(0deg)' },
          '10%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '30%': { transform: 'rotate(14deg)' },
          '40%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(10deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease both',
        wave: 'wave 2.4s ease-in-out infinite',
        shimmer: 'shimmer 2.6s linear infinite',
        'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
