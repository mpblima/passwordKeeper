import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['node_modules/**', 'dist/**', 'src-tauri/**', 'Conteúdo do Arquivo `src/tests/**', 'Conteúdo do arquivo `src/tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src-tauri/',
        'dist/',
        '.git/',
        'src/setupTests.ts',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ]
    }
  }
});