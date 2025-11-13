import { ABC } from '#abc';
import type { Containerkit } from '#containerkit';
import { getOrCreateModel, monaco, type mncn } from '#monaco';

const DEFAULT_EDITOR_PATH = 'index.ts' as const;
const DEFAULT_EDITOR_LANGUAGE = 'typescript' as const;

export interface EditorListenerCallbacks {
  onMount: (editor: mncn.editor.IStandaloneCodeEditor) => void;
  onChange: (value: string, event: mncn.editor.IModelContentChangedEvent) => void;
  onSave: (value: string) => void;
}

export type EditorListener = keyof EditorListenerCallbacks;

export type EditorListeners = {
  [K in keyof EditorListenerCallbacks]?: EditorListenerCallbacks[K] | undefined;
};

/**
 * Options that can be passed to monaco editor, excluding those that are
 * managed by Containerkit Editor itself, namely 'model', 'value' and 'language'.
 */
export type MonacoOptions = Omit<mncn.editor.IStandaloneEditorConstructionOptions, 'model' | 'value' | 'language'>;

/**
 * Extra options for the Editor. Most will be passed to monaco in some way,
 * for example by creating a model with the given path/language.
 */
export interface EditorOptions {
  path?: string | undefined;
  language?: string | undefined;
  value?: string | undefined;
}

export class Editor extends ABC {
  protected _editor: mncn.editor.IStandaloneCodeEditor | undefined;
  protected _editorOptions: EditorOptions | undefined;

  protected _monacoOptions: MonacoOptions | undefined;
  protected _onChangeSubscription: mncn.IDisposable | undefined;
  protected _resizeObserver: ResizeObserver | undefined;

  protected _preventOnChangeTrigger = false;

  protected _listeners: EditorListeners = {};

  protected _fileWatcher: { close: () => void } | undefined;
  protected _lastSavedValue: string | undefined;
  protected _commandDisposable: string | null | undefined;

  public constructor(
    instance?: Containerkit,
    editorOptions: EditorOptions | undefined = undefined,
    monacoOptions: MonacoOptions | undefined = undefined,
  ) {
    super(instance);

    this._editorOptions = editorOptions;
    this._monacoOptions = monacoOptions;
  }

  protected _handleMount() {
    if (!this._editor) {
      throw new Error('handleMound called, but editor is not yet initialized');
    }

    this._listeners.onMount?.(this._editor);

    this._onChangeSubscription = this._editor.onDidChangeModelContent(event => {
      if (!this._editor) return; // Should not happen
      if (this._preventOnChangeTrigger) return;

      this._listeners.onChange?.(this._editor.getValue(), event);
    });
  }

  public attach(instance: Containerkit) {
    this._containerKitInstance = instance;
    instance.attach(this);
  }

  public async init(element: HTMLElement) {
    element.classList.add('containerkit-editor');

    // Determine initial value based on priority: value > file content > empty
    let initialValue = '';
    if (this._editorOptions?.value !== undefined) {
      // Value has highest priority
      initialValue = this._editorOptions.value;
    } else if (this._editorOptions?.path && this._containerKitInstance) {
      // Try to load from file if path is set
      try {
        const fileContent = await this._containerKitInstance.readFile(this._editorOptions.path);
        initialValue = fileContent ?? '';
      } catch {
        // File doesn't exist, use empty string
        initialValue = '';
      }
    }

    this._lastSavedValue = initialValue;

    const model = getOrCreateModel(
      monaco,
      initialValue,
      this._editorOptions?.language,
      this._editorOptions?.path ?? DEFAULT_EDITOR_PATH,
    );

    this._editor = monaco.editor.create(element, {
      ...(this._monacoOptions ?? {}),
      model,
      language: this._editorOptions?.language as string,
    });
    this._editor.setModel(model);

    this._handleMount();

    // Set up file watcher if path is set
    if (this._editorOptions?.path && this._containerKitInstance) {
      this._setupFileWatcher(this._editorOptions.path);
    }

    // Set up Ctrl+S keyboard shortcut
    this._setupSaveShortcut();

    this._resizeObserver = new ResizeObserver(() => {
      this._editor?.layout();
    });

    this._resizeObserver.observe(element);

    return () => {
      this.dispose();
    };
  }

  public update(options: MonacoOptions) {
    if (!this._editor) return;

    this._editor.updateOptions(options);
  }

  protected _setupFileWatcher(filepath: string) {
    if (!this._containerKitInstance) return;

    this._fileWatcher = this._containerKitInstance.watch(filepath, {}, event => {
      const editor = this._editor;
      const containerkit = this._containerKitInstance;
      if (!editor || !containerkit) return;
      if (event === 'change') {
        void (async () => {
          try {
            const fileContent = await containerkit.readFile(filepath);
            const currentValue = editor.getValue();

            // Only update if the file content is different and not dirty
            if (fileContent !== currentValue && !this.isDirty) {
              this._preventOnChangeTrigger = true;
              editor.setValue(fileContent ?? '');
              this._lastSavedValue = fileContent ?? '';
              this._preventOnChangeTrigger = false;
            }
          } catch {
            // File was deleted or error reading
          }
        })();
      }
    });
  }

  protected _setupSaveShortcut() {
    if (!this._editor) return;

    this._commandDisposable = this._editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void this.save();
    });
  }

  protected async _ensureDirectoryExists(filepath: string) {
    if (!this._containerKitInstance) return;

    const pathParts = filepath.split('/').filter(Boolean);
    if (pathParts.length <= 1) return; // No directory to create

    // Remove filename
    pathParts.pop();

    let currentPath = '';
    for (const part of pathParts) {
      currentPath += `/${part}`;
      try {
        // Try to create directory, ignore if it exists
        await this._containerKitInstance.spawn('mkdir', ['-p', currentPath]);
      } catch {
        // Directory might already exist
      }
    }
  }

  public async save(): Promise<void> {
    if (!this._editor || !this._editorOptions?.path || !this._containerKitInstance) {
      return;
    }

    const currentValue = this._editor.getValue();

    try {
      // Ensure the directory exists
      await this._ensureDirectoryExists(this._editorOptions.path);

      // Write the file
      await this._containerKitInstance.writeFile(this._editorOptions.path, currentValue);

      // Update last saved value
      this._lastSavedValue = currentValue;
      this._listeners.onSave?.(currentValue);
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  }

  public dispose() {
    super.dispose();
    this._editor?.dispose();
    this._onChangeSubscription?.dispose();
    this._resizeObserver?.disconnect();
    this._fileWatcher?.close();
  }

  public setListener<TEvent extends EditorListener>(event: TEvent, callback: EditorListenerCallbacks[TEvent]) {
    this._listeners[event] = callback;
  }

  public getMonacoInstance(): mncn.editor.IStandaloneCodeEditor | undefined {
    return this._editor;
  }

  public get isDirty(): boolean {
    if (!this._editor) return false;

    const currentValue = this._editor.getValue();
    return currentValue !== this._lastSavedValue;
  }

  // Options

  public setValue(value: string | undefined) {
    if (!this._editor) return;
    // Don't update, to let the default control
    if (value == null) return;
    if (value === this._editor.getValue()) return;

    this._editor.setValue(value);
  }

  public getValue(): string | undefined {
    if (!this._editor) return undefined;

    return this._editor.getValue();
  }

  public setLanguage(language: string) {
    if (!this._editor) return;

    const model = this._editor.getModel();
    if (!model) return;

    monaco.editor.setModelLanguage(model, language);
  }

  public setTheme(theme: string) {
    monaco.editor.setTheme(theme);
  }
}
