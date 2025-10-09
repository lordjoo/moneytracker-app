module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          DEFAULT: '#1d4ed8',
          dark: '#1e3a8a'
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('daisyui')],
  daisyui: {
    themes: [
      {
        'mymoney-light': {
          primary: '#1d4ed8',
          'primary-content': '#f8fafc',
          secondary: '#f97316',
          accent: '#0ea5e9',
          neutral: '#1f2937',
          'neutral-content': '#f8fafc',
          'base-100': '#f8fafc',
          'base-200': '#e2e8f0',
          'base-300': '#cbd5f5',
          'base-content': '#0f172a',
          info: '#38bdf8',
          success: '#16a34a',
          warning: '#f97316',
          error: '#dc2626'
        }
      },
      {
        'mymoney-dark': {
          primary: '#60a5fa',
          'primary-content': '#0f172a',
          secondary: '#fbbf24',
          accent: '#22d3ee',
          neutral: '#0f172a',
          'neutral-content': '#e2e8f0',
          'base-100': '#0b1120',
          'base-200': '#111827',
          'base-300': '#1f2937',
          'base-content': '#f8fafc',
          info: '#0ea5e9',
          success: '#22c55e',
          warning: '#facc15',
          error: '#f87171'
        }
      },
      'light',
      'dark'
    ]
  }
};
