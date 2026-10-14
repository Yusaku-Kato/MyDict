import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// GitHub Pages はリポジトリ名のサブパスで配信される
export default defineConfig({
  base: process.env.VITE_BASE ?? '/MyDict/',
  plugins: [preact()],
  // Mermaid の大きなチャンクは図を表示するときだけ遅延読み込みされる
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
