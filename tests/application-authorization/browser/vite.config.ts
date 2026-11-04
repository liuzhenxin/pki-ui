import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(currentDirectory, '../../..');
export default defineConfig({
  root: currentDirectory,
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@/utils/request', replacement: path.join(currentDirectory, 'fixtureRequest.ts') },
      { find: '@', replacement: path.join(root, 'src') }
    ]
  },
  server: { fs: { allow: [root] } }
});
