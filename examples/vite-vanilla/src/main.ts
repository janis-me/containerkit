import { Containerkit, Editor, Terminal } from '@containerkit/core';

import './main.css';

async function setupEditor(instance: Containerkit, root: HTMLElement) {
  const editorContainer = document.createElement('div');
  editorContainer.id = 'editor-container';
  root.appendChild(editorContainer);

  const editor = new Editor(
    instance,
    {
      language: 'cpp',
      path: 'index.cpp',
      value: 'const x = 2; // test',
    },
    {
      theme: 'vs-dark',
    },
  );

  editor.setListener('onSave', (value: string) => {
    console.log('File saved with content:', value);
  });

  return editor.init(editorContainer);
}

async function setupTerminal(instance: Containerkit, root: HTMLElement) {
  const terminalContainer = document.createElement('div');
  terminalContainer.id = 'terminal-container';
  root.appendChild(terminalContainer);

  const terminal = new Terminal(instance, {
    theme: {
      background: '#1e1e1e',
      foreground: '#c5c5c5',
      cursor: '#c5c5c5',
      blue: '#569cd6',
    },
  });
  return terminal.init(terminalContainer);
}

async function main() {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element not found');
  }

  const containerkit = new Containerkit();
  await containerkit.init('vite-vanilla-test');

  const cleanupEditor = await setupEditor(containerkit, root);
  const cleanupTerminal = await setupTerminal(containerkit, root);

  return () => {
    cleanupEditor();
    cleanupTerminal();
    containerkit.dispose();
  };
}

await main();
