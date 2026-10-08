// Compila el proceso principal, el preload y el motor. La interfaz la compila apps/web con Vite.
import { build } from 'esbuild';

/** Quedan fuera del bundle: Electron, el módulo nativo y el SDK del agente (que trae su propia CLI). */
const external = ['electron', 'node-pty', '@anthropic-ai/claude-agent-sdk', 'electron-updater'];
const common = { bundle: true, platform: 'node', target: 'node24', sourcemap: true, external, logLevel: 'info' };

await Promise.all([
  build({
    ...common,
    format: 'esm',
    entryPoints: { main: 'src/main.ts', engine: 'src/engine.ts' },
    outdir: 'out',
    outExtension: { '.js': '.mjs' },
    // Algunas dependencias empaquetadas usan require: se lo damos en ESM.
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  }),
  build({ ...common, format: 'cjs', entryPoints: { preload: 'src/preload.ts' }, outdir: 'out', outExtension: { '.js': '.cjs' } }),
]);
