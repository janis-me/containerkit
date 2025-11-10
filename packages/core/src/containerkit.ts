import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree, FSWatchCallback, FSWatchOptions } from '@webcontainer/api';

import { Terminal } from '#terminal';

export class Containerkit {
  protected _webContainerinstance: WebContainer | undefined;
  protected _terminal: Terminal | undefined;

  public async init(name: string) {
    if (this._webContainerinstance) {
      throw new Error('Instance is already initialized');
    }

    this._webContainerinstance = await WebContainer.boot({
      workdirName: name,
    });

    return () => {
      this.dispose();
    };
  }

  public dispose() {
    this._terminal?.dispose();
    this._webContainerinstance?.teardown();
  }

  public async attachTerminal(terminal: Terminal) {
    if (!this._webContainerinstance) throw new Error('Instance not initialized');
    const xterm = terminal.getXTermInstance();

    const terminalReady = Promise.withResolvers<void>();
    let isInteractive = false;

    const outputStream = new WritableStream<string>({
      write(data) {
        if (!isInteractive) {
          const [, osc] = /\x1b\]654;([^\x07]+)\x07/.exec(data) ?? [];

          if (osc === 'interactive') {
            // wait until we see the interactive OSC
            isInteractive = true;

            terminalReady.resolve();
          }
        }

        xterm.write(data);
      },
    });

    const inputStream = new TransformStream<string, string>();
    const inputStreamWriter = inputStream.writable.getWriter();
    xterm.onData(data => {
      void inputStreamWriter.write(data);
    });

    this.terminal.registerTerminalStreams(outputStream, inputStream.readable);

    await terminalReady.promise;
  }

  // Utility methods

  public async mount(files: FileSystemTree) {
    await this._webContainerinstance?.mount(files);
  }

  public watch(path: string, options?: FSWatchOptions, listener?: FSWatchCallback) {
    return this._webContainerinstance?.fs.watch(path, options, listener);
  }

  public async writeFile(path: string, content: string) {
    return this._webContainerinstance?.fs.writeFile(path, content);
  }

  public async readFile(path: string) {
    return this._webContainerinstance?.fs.readFile(path, 'utf8');
  }
}
