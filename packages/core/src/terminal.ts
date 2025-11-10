import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { ITerminalOptions as XtermOptions } from '@xterm/xterm';
import { Terminal as XTerm } from '@xterm/xterm';

export interface TerminalListenerCallbacks {
  onResize: (terminalMeta: { rows: number; cols: number }) => void;
  onMount: (xterm: XTerm) => void;
}

export type TerminalListener = keyof TerminalListenerCallbacks;

export type TerminalListeners = {
  [K in keyof TerminalListenerCallbacks]?: TerminalListenerCallbacks[K] | undefined;
};

const DEFAULT_XTERM_OPTIONS = {
  cursorBlink: true,
  convertEol: true,
} satisfies XtermOptions;

export class Terminal {
  private _xterm: XTerm;
  private _fitAddon: FitAddon;
  private _webLinksAddon: WebLinksAddon;
  private _resizeObserver: ResizeObserver | undefined;

  private _shellProcess: WebContainerProcess | undefined;
  private _shellProcessWriter: WritableStreamDefaultWriter<string> | undefined;
  private _pendingReadyResolvers: Array<() => void> = [];
  private _outputStream: WritableStream<string> | undefined;

  private _listeners: TerminalListeners = {};

  constructor(xtermOptions: XtermOptions = DEFAULT_XTERM_OPTIONS) {
    this._xterm = new XTerm(xtermOptions);
    this._fitAddon = new FitAddon();
    this._webLinksAddon = new WebLinksAddon();

    this._xterm.loadAddon(this._fitAddon);
    this._xterm.loadAddon(this._webLinksAddon);
  }

  /**
   * Mount this Terminal to a given HTML element.
   *
   * @returns A cleanup function to dispose the terminal and its addons.
   */
  public init(element: HTMLElement) {
    this._xterm.open(element);
    this._fitAddon.fit();

    this._resizeObserver = new ResizeObserver(() => {
      this._fitAddon.fit();

      this._listeners.onResize?.({ rows: this._xterm.rows, cols: this._xterm.cols });
    });

    this._resizeObserver.observe(element);

    this._listeners.onMount?.(this._xterm);

    return () => {
      this.dispose();
    };
  }

  public registerTerminalStreams(outputStream: WritableStream<string>, inputStream: ReadableStream<string>) {
    // Create an intercepting output stream that monitors for interactive OSC
    this._outputStream = new WritableStream<string>({
      write: data => {
        // Check for prompt OSC code (terminal ready for input)
        // eslint-disable-next-line no-control-regex
        const [, osc] = /\x1b\]654;([^\x07]+)/.exec(data) ?? [];

        if (osc === 'prompt') {
          // Resolve all pending waitForReady promises
          const resolvers = [...this._pendingReadyResolvers];
          this._pendingReadyResolvers.length = 0; // Clear the array
          resolvers.forEach(resolve => {
            resolve();
          });
        }

        // Forward the data to the original output stream
        const writer = outputStream.getWriter();
        void writer.write(data).finally(() => {
          writer.releaseLock();
        });
      },
    });

    void this._shellProcess.output.pipeTo(this._outputStream);

    this._shellProcessWriter = this._shellProcess.input.getWriter();
    void inputStream.pipeTo(
      new WritableStream({
        write: chunk => {
          if (this._shellProcessWriter) {
            void this._shellProcessWriter.write(chunk);
          }
        },
      }),
    );
  }

  public dispose() {
    this._resizeObserver?.disconnect();
    this._xterm.dispose();
    this._fitAddon.dispose();
    this._webLinksAddon.dispose();
  }

  public setListener<TEvent extends TerminalListener>(event: TEvent, callback: TerminalListenerCallbacks[TEvent]) {
    this._listeners[event] = callback;
  }

  public getXTermInstance(): XTerm {
    return this._xterm;
  }
}
