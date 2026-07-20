import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, '../..');

export default {
  root: appDir,
  resolve: {
    alias: {
      '@qiuai/api-contract': path.resolve(repoRoot, 'packages/api-contract/src/index.ts'),
      '@qiuai/design-tokens': path.resolve(repoRoot, 'packages/design-tokens/src/index.ts'),
      '@qiuai/domain': path.resolve(repoRoot, 'packages/domain/src/index.ts'),
      '@qiuai/ui': path.resolve(repoRoot, 'packages/ui/src/index.ts')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  }
};
