import * as esbuild from 'esbuild';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const outDir = join(root, 'server-bundled');

// Clean output
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true });
}
mkdirSync(outDir, { recursive: true });

console.log('Bundling server...');

esbuild.build({
  entryPoints: [join(root, 'server', 'dist', 'index.js')],
  outfile: join(outDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: [],
  allowOverwrite: true,
  sourcemap: false,
  minify: false,
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
}).then(() => {
  // Write package.json to mark as ESM
  writeFileSync(
    join(outDir, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2)
  );
  console.log('Server bundled successfully to server-bundled/index.js');
}).catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
