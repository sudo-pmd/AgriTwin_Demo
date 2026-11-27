/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#15803d',
          600: '#166534',
          700: '#14532d',
          800: '#0f3d22',
          900: '#0a2a17',
        },
        slateink: {
          800: '#0f172a',
          700: '#1e293b',
        },
        tech: '#0284c7',
        line: '#e3e9f1',
      },
      fontFamily: {
        sans: ['Public Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 32, 24, 0.04), 0 14px 30px -22px rgba(16, 32, 24, 0.35)',
        window:
          '0 1px 2px rgba(16, 32, 24, 0.05), 0 18px 38px -26px rgba(16, 32, 24, 0.42)',
        lift: '0 2px 5px rgba(16, 32, 24, 0.06), 0 26px 48px -28px rgba(16, 32, 24, 0.5)',
        inset: 'inset 0 1px 2px rgba(16, 32, 24, 0.06)',
      },
      keyframes: {
        equalize: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 0.7, 0.3, 1)',
      },
      animation: {
        equalize: 'equalize 0.9s ease-in-out infinite',
        pulseSoft: 'pulseSoft 1.8s ease-in-out infinite',
        rise: 'rise 0.3s cubic-bezier(0.22, 0.7, 0.3, 1) both',
        pop: 'pop 0.16s ease-out both',
      },
    },
  },
  plugins: [],
};
