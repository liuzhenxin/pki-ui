import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
export default defineConfig({
  root: here,
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@/store/modules/user', replacement: path.join(here, 'user.ts') },
      { find: '@/utils/request', replacement: path.join(here, 'request.ts') },
      { find: '@', replacement: path.join(root, 'src') }
    ]
  },
  server: { fs: { allow: [root] } }
});
