/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        night: {
          950: '#05070F',
          900: '#060A14',
          800: '#0A101F',
          700: '#0F1830',
          600: '#16203D',
          500: '#223056',
        },
        champagne: {
          200: '#F4E3B5',
          300: '#ECCF94',
          400: '#E4C580',
          500: '#D4AF6A',
          600: '#BC944F',
          700: '#93723C',
        },
        ink: {
          DEFAULT: '#EAF0FA',
          2: '#A6B2C8',
          3: '#6B7A93',
        },
        line: {
          DEFAULT: 'rgba(148, 163, 184, 0.10)',
          strong: 'rgba(148, 163, 184, 0.18)',
        },
        success: { 500: '#10B981' },
        warning: { 500: '#F59E0B' },
        error: { 500: '#EF4444' },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-in-out',
        slideInUp: 'slideInUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideInUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
