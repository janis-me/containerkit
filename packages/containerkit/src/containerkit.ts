import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree, FSWatchCallback, FSWatchOptions, SpawnOptions } from '@webcontainer/api';

import type { ABC } from '#abc';
import { Editor } from '#editor';
import type { Monaco } from '#monaco';
import { Terminal } from '#terminal';

import './containerkit.css';

export class Containerkit {
  protected _webContainerinstance: WebContainer | undefined;
  protected _terminal: Terminal | undefined;

  protected _monaco: Monaco | undefined;

  public async init(name: string): Promise<() => void> {
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

  /**
   * Attach a component (Terminal, Editor, etc.) to this Containerkit instance.
   */
  public attach(instance: ABC) {
    if (instance instanceof Terminal) {
      this.attachTerminal(instance);
    } else if (instance instanceof Editor) {
      this.attachEditor(instance);
    } else {
      throw new Error('Unsupported instance type');
    }
  }

  /**
   * Attach a Terminal instance to this Containerkit instance.
   * The same as calling terminal.attach(containerkit).
   */
  public attachTerminal(terminal: Terminal) {
    terminal.attach(this);
  }

  /**
   * Attach an Editor instance to this Containerkit instance.
   * The same as calling editor.attach(containerkit).
   */
  public attachEditor(editor: Editor) {
    editor.attach(this);
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

  public async spawn(command: string, args: string[] = [], options?: SpawnOptions) {
    if (!this._webContainerinstance) {
      throw new Error('Containerkit instance is not initialized');
    }

    return this._webContainerinstance.spawn(command, args, options);
  }
}
