/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral ink and surfaces with one accent blue; values swap per theme in main.css.
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)'
        },
        paper: 'var(--paper)',
        plane: 'var(--plane)',
        sunken: 'var(--sunken)',
        subtle: { DEFAULT: 'var(--subtle)', 2: 'var(--subtle-2)' },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          fg: 'var(--primary-fg)'
        },
        rule: {
          DEFAULT: 'var(--rule)',
          strong: 'var(--rule-strong)'
        },
        spot: {
          DEFAULT: 'var(--spot)',
          ink: 'var(--spot-ink)',
          soft: 'var(--spot-soft)'
        },
        good: { DEFAULT: 'var(--good)', bg: 'var(--good-bg)' },
        watch: { DEFAULT: 'var(--watch)', bg: 'var(--watch-bg)' },
        risk: { DEFAULT: 'var(--risk)', bg: 'var(--risk-bg)' },
        bad: { DEFAULT: 'var(--bad)', bg: 'var(--bad-bg)' },
        series: {
          pv: 'var(--series-pv)',
          ev: 'var(--series-ev)',
          ac: 'var(--series-ac)',
          bac: 'var(--series-bac)',
          fav: 'var(--series-fav)',
          unfav: 'var(--series-unfav)'
        }
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        display: ['"Geist Variable"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', '"SFMono-Regular"', 'monospace']
      },
      // Fixed rem scale, ~1.15 ratio. Nothing under 12px: this app is read on projectors.
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1rem' }],
        small: ['0.8125rem', { lineHeight: '1.125rem' }],
        body: ['0.875rem', { lineHeight: '1.3125rem' }],
        ui: ['0.9375rem', { lineHeight: '1.375rem' }],
        h3: ['1.0625rem', { lineHeight: '1.5rem' }],
        h2: ['1.25rem', { lineHeight: '1.75rem' }],
        h1: ['1.625rem', { lineHeight: '2rem' }],
        figure: ['1.75rem', { lineHeight: '2.125rem' }],
        hero: ['2.5rem', { lineHeight: '2.75rem' }]
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px'
      },
      boxShadow: {
        panel: 'var(--shadow-card)',
        lift: 'var(--shadow-float)',
        drawer: 'var(--shadow-float)'
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.99)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'slide-in-right': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' }
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } }
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'rise-in': 'rise-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.4s infinite'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
