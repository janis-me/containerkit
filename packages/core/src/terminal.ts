import type { WebContainerProcess } from '@webcontainer/api';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { ITerminalOptions as XtermOptions } from '@xterm/xterm';
import { Terminal as XTerm } from '@xterm/xterm';

import { ABC } from '#abc';
import type { Containerkit } from '#containerkit';
import { parseOSCSequence, type OSCSequenceType } from '#utils/xterm';

export type { XtermOptions };

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

/**
 * Terminal state machine states
 */
enum TerminalState {
  INITIALIZING = 'INITIALIZING',
  IDLE = 'IDLE', // Ready for input (prompt shown)
  BUSY = 'BUSY', // Command executing
  ERROR = 'ERROR',
}

/**
 * Represents a queued write operation
 */
interface WriteOperation {
  data: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class Terminal extends ABC {
  protected _xterm: XTerm;
  protected _fitAddon: FitAddon;
  protected _webLinksAddon: WebLinksAddon;
  protected _resizeObserver: ResizeObserver | undefined;

  private _shellProcess: WebContainerProcess | undefined;
  private _shellProcessWriter: WritableStreamDefaultWriter<string> | undefined;
  private _outputStream: WritableStream<string> | undefined;

  private _state: TerminalState = TerminalState.INITIALIZING;
  private _writeQueue: WriteOperation[] = [];
  private _isProcessingQueue = false;

  protected _listeners: TerminalListeners = {};

  constructor(instance?: Containerkit, xtermOptions: XtermOptions = DEFAULT_XTERM_OPTIONS) {
    super(instance);

    this._containerKitInstance = instance;

    this._xterm = new XTerm({ ...DEFAULT_XTERM_OPTIONS, ...xtermOptions });
    this._fitAddon = new FitAddon();
    this._webLinksAddon = new WebLinksAddon();

    this._xterm.loadAddon(this._fitAddon);
    this._xterm.loadAddon(this._webLinksAddon);

    if (instance) {
      this.attach(instance);
    }
  }

  /**
   * Update the terminal state based on OSC sequence
   */
  private _updateState(oscType: OSCSequenceType): void {
    const prevState = this._state;

    switch (oscType) {
      case 'prompt-start':
        this._state = TerminalState.IDLE;
        break;
      case 'command-start':
        this._state = TerminalState.BUSY;
        break;
      case 'command-end':
        this._state = TerminalState.IDLE;
        break;
      case 'none':
        // No state change
        break;
    }

    // If we transitioned to IDLE, process any queued writes
    if (prevState !== TerminalState.IDLE && this._state === TerminalState.IDLE) {
      void this._processWriteQueue();
    }
  }

  /**
   * Process the write queue when terminal is ready
   */
  private async _processWriteQueue(): Promise<void> {
    // Prevent concurrent queue processing
    if (this._isProcessingQueue || this._writeQueue.length === 0) {
      return;
    }

    // Only process queue when terminal is idle
    if (this._state !== TerminalState.IDLE) {
      return;
    }

    this._isProcessingQueue = true;

    try {
      // Process writes while queue is not empty and terminal remains idle
      // (state could change to BUSY during write processing)
      while (this._writeQueue.length > 0) {
        // Check if terminal is still idle before processing next item
        // State can change during async operations, so this check is necessary
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this._state !== TerminalState.IDLE) {
          break;
        }

        const operation = this._writeQueue.shift();
        if (!operation) break;

        try {
          await this._writeToStream(operation.data);
          operation.resolve();
        } catch (error) {
          operation.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    } finally {
      this._isProcessingQueue = false;
    }
  }

  /**
   * Actually write data to the stream (internal method)
   * This is for programmatic writes only (not user typing)
   */
  private async _writeToStream(data: string): Promise<void> {
    if (!this._shellProcessWriter) {
      throw new Error('Shell process writer is not available');
    }

    try {
      await this._shellProcessWriter.ready;
      await this._shellProcessWriter.write(data);

      // After writing a command, transition to BUSY
      // Terminal will transition back to IDLE when we receive the next 'prompt' OSC sequence
      this._state = TerminalState.BUSY;
    } catch (error) {
      this._state = TerminalState.ERROR;
      throw new Error(`Failed to write to terminal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  protected async _initTerminalStreams(command: string, args: string[]) {
    if (!this._containerKitInstance) {
      throw new Error('Containerkit instance is not initialized');
    }

    this._shellProcess = await this._containerKitInstance.spawn(command, args, {
      terminal: {
        cols: this._xterm.cols,
        rows: this._xterm.rows,
      },
    });

    // Acquire a persistent writer for the process input stream
    this._shellProcessWriter = this._shellProcess.input.getWriter();

    // Create an intercepting output stream that monitors for OSC sequences
    this._outputStream = new WritableStream<string>({
      write: data => {
        // Parse OSC sequences and update state
        const oscType = parseOSCSequence(data);
        this._updateState(oscType.type);

        // Always write to xterm
        this._xterm.write(data);
      },
    });

    void this._shellProcess.output.pipeTo(this._outputStream);

    // Wire up user input from xterm directly to shell process
    // User typing should NOT go through the write queue - only programmatic writes should
    this._xterm.onData(async data => {
      try {
        if (this._shellProcessWriter) {
          await this._shellProcessWriter.ready;
          await this._shellProcessWriter.write(data);
        }
      } catch (error) {
        console.error('Failed to write user input to terminal:', error);
      }
    });
  }

  public attach(instance: Containerkit) {
    instance.attach(this);
  }

  /**
   * Mount this Terminal to a given HTML element.
   *
   * @returns A cleanup function to dispose the terminal and its addons.
   */
  public init(element: HTMLElement, command = '/bin/jsh', args: string[] = []): Promise<() => void> {
    if (!this._containerKitInstance) {
      throw new Error('Terminal instance is not attached to a Containerkit instance');
    }

    element.classList.add('containerkit-terminal');

    this._xterm.open(element);
    this._fitAddon.fit();

    this._resizeObserver = new ResizeObserver(() => {
      this._fitAddon.fit();
      const dimensions = { rows: this._xterm.rows, cols: this._xterm.cols };
      this._shellProcess?.resize(dimensions);

      this._listeners.onResize?.(dimensions);
    });

    this._resizeObserver.observe(element);

    this._listeners.onMount?.(this._xterm);

    // Ensure --osc flag is included for jsh to send OSC sequences
    const shellArgs = command === '/bin/jsh' ? ['--osc', ...args] : args;
    void this._initTerminalStreams(command, shellArgs);

    return Promise.resolve(() => {
      this.dispose();
    });
  }

  public dispose() {
    super.dispose();

    if (this._shellProcessWriter) {
      void this._shellProcessWriter.close();
      this._shellProcessWriter = undefined;
    }

    this._writeQueue.forEach(op => {
      op.reject(new Error('Terminal disposed'));
    });
    this._writeQueue = [];

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

  public get process(): WebContainerProcess | undefined {
    return this._shellProcess;
  }

  /**
   * Write data to the terminal.
   * This method queues the write and returns a promise that resolves when the data is written.
   * The write will be deferred until the terminal is ready (in IDLE state).
   */
  public async write(data: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const operation: WriteOperation = { data, resolve, reject };
      this._writeQueue.push(operation);

      // Immediately try to process if terminal is idle
      if (this._state === TerminalState.IDLE) {
        void this._processWriteQueue();
      }
    });
  }

  /**
   * Wait for the terminal to be ready for input.
   * With the new queue system, this is mostly for backwards compatibility.
   * @deprecated Use write() directly - it automatically waits for the terminal to be ready
   */
  public async waitForReady(): Promise<void> {
    // If already idle, resolve immediately
    if (this._state === TerminalState.IDLE) {
      return Promise.resolve();
    }

    // Wait for the next state transition to IDLE
    return new Promise<void>(resolve => {
      const checkState = () => {
        if (this._state === TerminalState.IDLE) {
          resolve();
        } else {
          // Check again soon
          setTimeout(checkState, 10);
        }
      };
      checkState();
    });
  }
}
