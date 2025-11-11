import { Containerkit, Editor, Terminal } from 'containerkit';

import 'containerkit/styles';
import './main.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}
const containerkit = new Containerkit();
await containerkit.init('vite-vanilla-test');

const terminal = new Terminal(containerkit);
const editor = new Editor();

const editorContainer = document.createElement('div');
const terminalContainer = document.createElement('div');

editorContainer.id = 'editor-container';
terminalContainer.id = 'terminal-container';

root.appendChild(editorContainer);
root.appendChild(terminalContainer);

terminal.init(terminalContainer);
editor.init(editorContainer);
