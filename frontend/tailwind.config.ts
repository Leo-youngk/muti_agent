import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './node_modules/streamdown/dist/*.js',
  ],
  theme: {
    extend: {
      // Streamdown 内部按 shadcn 令牌命名取色，这里桥接到本项目的主题变量
      colors: {
        background: 'var(--page)',
        foreground: 'var(--text)',
        muted: {
          DEFAULT: 'var(--bubble)',
          foreground: 'var(--text-muted)',
        },
        border: 'var(--line)',
        sidebar: 'var(--bubble)',
        primary: {
          DEFAULT: 'var(--action)',
          foreground: 'var(--surface)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
      },
      animation: {
        'cursor-blink': 'cursor-blink 0.9s step-end infinite',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
