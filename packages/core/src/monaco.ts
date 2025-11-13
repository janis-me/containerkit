import loader, { type Monaco } from '@monaco-editor/loader';
import * as mncn from 'monaco-editor';

self.MonacoEnvironment = {
  getWorker: function (_: string, label: string) {
    // create a new worker from the corresponding monaco editor worker script
    if (label === 'editorWorkerService') {
      const url = new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url);
      return new Worker(url, {
        type: 'module',
      });
    } else if (label === 'typescript') {
      return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url), {
        type: 'module',
      });
    } else if (label === 'javascript') {
      return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url), {
        type: 'module',
      });
    } else if (label === 'css') {
      return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url), {
        type: 'module',
      });
    } else if (label === 'json') {
      return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url), {
        type: 'module',
      });
    }

    throw new Error(`Unknown label ${label} for monaco worker`);
  },
};

loader.config({ monaco: mncn });
const cancelable = loader.init();
export const monaco = await cancelable;

export type { Monaco };
export type { mncn };
