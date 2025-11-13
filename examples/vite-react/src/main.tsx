import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Containerkit, ContainerkitProvider } from '@containerkit/react';

import App from './app';

import './main.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Failed to find root element');

const instance = new Containerkit();
await instance.boot('test-project');
await instance.mount({
  src: {
    directory: {
      'index.ts': {
        file: {
          contents: `\
const x = 1;
const y = 2;
console.log(x + y);
`,
        },
      },
      'index.css': {
        file: {
          contents: `\
body {
  font-family: sans-serif;
}
`,
        },
      },
      components: {
        directory: {
          'hello.ts': {
            file: {
              contents: `\
export function hello() {
  console.log('Hello, Containerkit!');
}
`,
            },
          },
        },
      },
    },
  },
});

createRoot(rootEl).render(
  <StrictMode>
    <ContainerkitProvider instance={instance}>
      <App />
    </ContainerkitProvider>
  </StrictMode>,
);
