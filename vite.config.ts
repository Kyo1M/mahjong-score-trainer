import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // .claude/worktrees に残る過去セッションのコピーを拾わない。
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
})
