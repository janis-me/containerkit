import { defineConfig } from '@maz-ui/changelogen-monorepo';

export default defineConfig({
  monorepo: {
    versionMode: 'selective',
    packages: ['packages/*'],
  },

  changelog: {
    rootChangelog: false,
    formatCmd: 'pnpm format *.md',
  },
});
