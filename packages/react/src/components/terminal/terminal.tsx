import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { XtermOptions } from '@containerkit/core';
import { Terminal as _Terminal } from '@containerkit/core';

import { useContainerkit } from '#context';

export interface TerminalProps {
  xtermOptions?: XtermOptions | undefined;
  /** Pass an existing Terminal instance instead of creating a new one */
  instance?: _Terminal | undefined;
  /** Callback fired when the terminal is mounted and ready */
  onMount?: ((terminal: _Terminal) => void) | undefined;
}

/**
 * Imperative handle exposed via ref for the Terminal component.
 * Use this to access the underlying Terminal instance programmatically.
 *
 * @example
 * const terminalRef = useRef<TerminalHandle>(null);
 *
 * // Later:
 * await terminalRef.current?.write('npm install\n');
 */
export interface TerminalHandle {
  /** Get the underlying Terminal instance */
  getInstance: () => _Terminal | null;
  /** Write data to the terminal */
  write: (data: string) => Promise<void>;
  /** Wait for the terminal to be ready for input */
  waitForReady: () => Promise<void>;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { xtermOptions, instance, onMount },
  ref,
) {
  const containerkitInstance = useContainerkit();

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<_Terminal | null>(instance ?? null);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      getInstance: () => terminalInstanceRef.current,
      write: async (data: string) => {
        if (!terminalInstanceRef.current) {
          throw new Error('Terminal instance is not initialized');
        }
        return terminalInstanceRef.current.write(data);
      },
      waitForReady: async () => {
        if (!terminalInstanceRef.current) {
          throw new Error('Terminal instance is not initialized');
        }
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        return terminalInstanceRef.current.waitForReady();
      },
    }),
    [],
  );

  useEffect(() => {
    if (!terminalContainerRef.current || !containerkitInstance) return;

    // Use provided instance or create a new one
    const terminalInstance = instance ?? new _Terminal(containerkitInstance, xtermOptions);
    terminalInstanceRef.current = terminalInstance;

    const initPromise = terminalInstance
      .init(terminalContainerRef.current)
      .then(() => {
        containerkitInstance.attach(terminalInstance);
        onMount?.(terminalInstance);
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize Terminal instance:', error);
      });

    return () => {
      // Only dispose if we created the instance (not if it was provided)
      if (!instance) {
        void initPromise.then(() => {
          terminalInstance.dispose();
        });
      }
    };
  }, [xtermOptions, containerkitInstance, instance, onMount]);

  return <div ref={terminalContainerRef}></div>;
});
