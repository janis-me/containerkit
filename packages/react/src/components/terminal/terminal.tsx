import { useEffect, useRef } from 'react';

import type { XtermOptions } from '@containerkit/core';
import { Terminal as _Terminal } from '@containerkit/core';

import { useContainerkit } from '#context';

export interface TerminalProps {
  xtermOptions?: XtermOptions | undefined;
}

export function Terminal({ xtermOptions }: TerminalProps) {
  const containerkitInstance = useContainerkit();

  const terminalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalContainerRef.current || !containerkitInstance) return;

    const terminalInstance = new _Terminal(containerkitInstance, xtermOptions);
    terminalInstance
      .init(terminalContainerRef.current)
      .then(() => {
        containerkitInstance.attach(terminalInstance);
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize Terminal instance:', error);
      });
  }, [xtermOptions, containerkitInstance]);

  return <div ref={terminalContainerRef}></div>;
}
