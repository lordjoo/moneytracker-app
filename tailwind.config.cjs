module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      colors: {
        brand: {
          DEFAULT: '#D9694A',
          dark: '#B84E32'
        }
      },
      boxShadow: {
        // Soft, warm, low shadows — depth without heaviness.
        sm: '0 1px 2px 0 rgba(58, 42, 32, 0.05)',
        DEFAULT: '0 1px 3px rgba(58, 42, 32, 0.06), 0 1px 2px -1px rgba(58, 42, 32, 0.05)',
        md: '0 4px 10px -2px rgba(58, 42, 32, 0.08), 0 2px 4px -2px rgba(58, 42, 32, 0.05)',
        lg: '0 10px 24px -6px rgba(58, 42, 32, 0.10), 0 4px 8px -4px rgba(58, 42, 32, 0.06)',
        xl: '0 20px 40px -12px rgba(58, 42, 32, 0.16)',
        glow: '0 8px 28px -6px rgba(217, 105, 74, 0.40)'
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-rise': 'fade-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both'
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('daisyui')],
  daisyui: {
    themes: [
      {
        'mymoney-light': {
          primary: '#D9694A',
          'primary-content': '#FFF7F3',
          secondary: '#E3963A',
          'secondary-content': '#3A2810',
          accent: '#C2542E',
          'accent-content': '#FFF6F1',
          neutral: '#382F2A',
          'neutral-content': '#F6F0EB',
          'base-100': '#FEFCFB',
          'base-200': '#F4F1ED',
          'base-300': '#E4DDD6',
          'base-content': '#2B2420',
          info: '#3F7C8A',
          'info-content': '#FFFFFF',
          success: '#3F8F5E',
          'success-content': '#FFFFFF',
          warning: '#D98A2B',
          'warning-content': '#2A1C06',
          error: '#CC4B4B',
          'error-content': '#FFFFFF',
          '--rounded-box': '1rem',
          '--rounded-btn': '0.7rem',
          '--rounded-badge': '1.9rem',
          '--tab-radius': '0.7rem',
          '--border-btn': '1px',
          '--animation-btn': '0.2s',
          '--animation-input': '0.2s'
        }
      },
      {
        'mymoney-dark': {
          primary: '#E8825F',
          'primary-content': '#2A1409',
          secondary: '#E8A85A',
          'secondary-content': '#2A1C08',
          accent: '#E8825F',
          'accent-content': '#2A1409',
          neutral: '#2A2420',
          'neutral-content': '#EFE7E0',
          'base-100': '#211C19',
          'base-200': '#1A1613',
          'base-300': '#322B26',
          'base-content': '#ECE4DC',
          info: '#5FA3B0',
          'info-content': '#08191C',
          success: '#5FB07F',
          'success-content': '#06251A',
          warning: '#E8B05A',
          'warning-content': '#2A1C06',
          error: '#E86B6B',
          'error-content': '#2A0A0A',
          '--rounded-box': '1rem',
          '--rounded-btn': '0.7rem',
          '--rounded-badge': '1.9rem',
          '--tab-radius': '0.7rem',
          '--border-btn': '1px',
          '--animation-btn': '0.2s',
          '--animation-input': '0.2s'
        }
      },
      'light',
      'dark'
    ]
  }
};
