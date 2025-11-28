import { defineConfig } from 'relizy';

export default defineConfig({
  monorepo: {
    versionMode: 'selective',
    packages: ['packages/*'],
    ignorePackageNames: ['@surimi/docs'],
  },

  publish: {
    access: 'public',
    safetyCheck: true,
  },

  changelog: {
    rootChangelog: false,
    formatCmd: 'pnpm format *.md',
  },
});
