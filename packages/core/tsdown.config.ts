import copy from 'rollup-plugin-copy';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/xterm.ts', 'src/webcontainer.ts', 'src/monaco.ts'],
  format: ['esm'],
  target: 'es2020',
  sourcemap: true,
  clean: true,
  dts: true,
  external: [/\.css$/],
  plugins: [
    // Don't touch / externalize CSS files
    copy({
      targets: [{ src: 'src/*.css', dest: 'dist' }],
    }),
  ],
});
