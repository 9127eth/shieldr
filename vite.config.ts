import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      phaser: path.resolve(__dirname, 'node_modules/phaser/dist/phaser.esm.js'),
    },
  },
});
