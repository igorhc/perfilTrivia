/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // No GitHub Pages o site fica em https://igorhc.github.io/perfilTrivia/
  base: command === 'build' ? '/perfilTrivia/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
}));
