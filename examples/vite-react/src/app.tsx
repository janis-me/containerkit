import { useEffect, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import type { TerminalHandle } from '@containerkit/react';
import { Editor, Terminal } from '@containerkit/react';

import { Explorer } from './components/explorer';

const TERMINAL_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selection: 'rgba(255, 255, 255, 0.3)',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
};

function App() {
  const [selectedFile, setSelectedFile] = useState('/src/index.ts');
  const terminalRef = useRef<TerminalHandle>(null);

  useEffect(() => {
    const to = setTimeout(() => {
      const instance = terminalRef.current?.getInstance();
      if (!instance) return;

      void instance.write(`echo "test"\n`);
    }, 3_000);

    return () => {
      clearTimeout(to);
    };
  }, []);

  return (
    <PanelGroup direction="horizontal" id="container">
      <Panel defaultSize={20} minSize={10}>
        <Explorer onFileClick={setSelectedFile} />
      </Panel>
      <PanelResizeHandle className="resize-handle" />
      <Panel defaultSize={80} minSize={10}>
        <PanelGroup direction="vertical">
          <Panel defaultSize={70} minSize={10}>
            <Editor monacoOptions={{ theme: 'vs-dark' }} path={selectedFile} />
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel defaultSize={30} minSize={10}>
            <Terminal
              ref={terminalRef}
              xtermOptions={{
                theme: TERMINAL_THEME,
              }}
            />
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}

export default App;
