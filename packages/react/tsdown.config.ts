import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/xterm.ts', 'src/webcontainer.ts', 'src/monaco.ts'],
  format: ['esm'],
  target: 'es2020',
  sourcemap: true,
  clean: true,
  dts: true,
});
