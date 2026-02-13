import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0b1220',
        ink: '#0f172a',
      },
      boxShadow: {
        glass: '0 10px 30px rgba(0,0,0,0.3)'
      }
    },
  },
  plugins: [],
} satisfies Config


