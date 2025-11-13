import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree, FSWatchCallback, FSWatchOptions, SpawnOptions } from '@webcontainer/api';

import type { ABC } from '#abc';
import { Editor } from '#editor';
import { monaco } from '#monaco';
import { Terminal } from '#terminal';

import './containerkit.css';

export class Containerkit {
  protected _webContainerinstance: WebContainer | undefined;

  protected _editors: Set<Editor> = new Set();
  protected _terminals: Set<Terminal> = new Set();

  protected _booting: boolean = false;

  protected async _getSymlinkType(path: string) {
    if (!this._webContainerinstance) {
      throw new Error('Webcontainer instance is not initialized');
    }

    // try to read a directory at the path and catch the error,
    // In case of error, try to instead read it as a file
    // if both fail, return 'none'
    try {
      await this._webContainerinstance.fs.readdir(path);
      return 'dir';
    } catch {
      try {
        await this._webContainerinstance.fs.readFile(path);
        return 'file';
      } catch {
        return 'none';
      }
    }
  }

  public async boot(name: string): Promise<() => void> {
    if (this._webContainerinstance) {
      throw new Error('Instance is already initialized');
    }

    this._booting = true;

    this._webContainerinstance = await WebContainer.boot({
      workdirName: name,
    });

    this._booting = false;

    return () => {
      this.dispose();
    };
  }

  public dispose() {
    this._webContainerinstance?.teardown();
  }

  public get booting() {
    return this._booting;
  }

  public get booted() {
    return !this.booting && this._webContainerinstance !== undefined;
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

  public detach(instance: ABC) {
    if (instance instanceof Terminal) {
      this._terminals.delete(instance);
    } else if (instance instanceof Editor) {
      this._editors.delete(instance);
    }
  }

  /**
   * Attach a Terminal instance to this Containerkit instance.
   * The same as calling terminal.attach(containerkit).
   */
  public attachTerminal(terminal: Terminal) {
    terminal.setInstance(this);
    this._terminals.add(terminal);
  }

  /**
   * Attach an Editor instance to this Containerkit instance.
   * The same as calling editor.attach(containerkit).
   */
  public attachEditor(editor: Editor) {
    editor.setInstance(this);
    this._editors.add(editor);
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

  public get fs() {
    return this._webContainerinstance?.fs;
  }

  /**
   * Returns the file system tree starting from the given path.
   * File contents are not included, only the structure.
   */
  public async getFileSystemTree(from: string): Promise<FileSystemTree> {
    if (!this._webContainerinstance) {
      throw new Error('Webcontainer instance is not initialized');
    }

    const buildTree = async (fs: WebContainer['fs'], currentPath: string): Promise<FileSystemTree> => {
      const result: FileSystemTree = {};

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;

          if (entry.isDirectory()) {
            // Recursively build tree for directories
            const subTree = await buildTree(fs, entryPath);
            result[entry.name] = {
              directory: subTree,
            };
          } else if (entry.isFile()) {
            // Regular file without contents (empty string as placeholder)
            result[entry.name] = {
              file: {
                contents: '',
              },
            };
          } else {
            // This is a symlink - resolve its type
            const symlinkType = await this._getSymlinkType(entryPath);

            if (symlinkType === 'dir') {
              // Symlink points to a directory - recursively build tree
              const subTree = await buildTree(fs, entryPath);
              result[entry.name] = {
                directory: subTree,
              };
            } else if (symlinkType === 'file') {
              // Symlink points to a file - add without contents
              result[entry.name] = {
                file: {
                  contents: '',
                },
              };
            }
            // If symlinkType is 'none', skip it
          }
        }
      } catch (error) {
        // If we can't read the directory, return empty tree
        console.error(`Error reading directory ${currentPath}:`, error);
      }

      return result;
    };

    const result = await buildTree(this._webContainerinstance.fs, from);

    return result;
  }

  /**
   * The globally used monaco instance.
   */
  public get monaco() {
    return monaco;
  }

  /**
   * The underlying WebContainer instance.
   */
  public get webContainer() {
    return this._webContainerinstance;
  }
}
