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
  // Monaco editor instances
  protected _element: HTMLElement | undefined;
  protected _editor: mncn.editor.IStandaloneCodeEditor | undefined;

  // Configuration
  protected _editorOptions: EditorOptions;
  protected _monacoOptions: MonacoOptions | undefined;

  // Subscriptions and observers (need cleanup)
  protected _onChangeSubscription: mncn.IDisposable | undefined;
  protected _resizeObserver: ResizeObserver | undefined;
  protected _fileWatcher: { close: () => void } | undefined;
  protected _commandDisposable: string | null | undefined;

  // State management
  protected _lastSavedValue: string | undefined;
  protected _suppressOnChange = false;
  protected _isDisposed = false;
  protected _pendingPathChange: AbortController | undefined;

  // Event listeners
  protected _listeners: EditorListeners = {};

  public constructor(
    instance?: Containerkit,
    editorOptions: EditorOptions = {},
    monacoOptions: MonacoOptions | undefined = undefined,
  ) {
    super(instance);

    this._editorOptions = editorOptions;
    this._monacoOptions = monacoOptions;
  }

  // ===========================================
  // Lifecycle methods
  // ===========================================

  public async init(element: HTMLElement): Promise<() => void> {
    if (this._element) {
      throw new Error('Editor is already initialized');
    }

    if (this._isDisposed) {
      throw new Error('Cannot initialize a disposed Editor instance');
    }

    this._element = element;

    if (!element.classList.contains('containerkit-editor')) {
      element.classList.add('containerkit-editor');
    }

    const initialValue = await this._loadInitialValue(this._editorOptions.path);

    const model = getOrCreateModel(
      monaco,
      initialValue,
      this._editorOptions.language,
      this._editorOptions.path ?? DEFAULT_EDITOR_PATH,
    );

    this._editor = monaco.editor.create(element, {
      ...(this._monacoOptions ?? {}),
      model,
      language: this._editorOptions.language as string,
    });
    this._editor.setModel(model);

    this._setupEventHandlers();
    this._setupFileWatcher(this._editorOptions.path);
    this._setupSaveShortcut();
    this._setupResizeObserver(element);

    return () => {
      this.dispose();
    };
  }

  public attach(instance: Containerkit): void {
    this._containerKitInstance = instance;
    instance.attach(this);

    // If we already have a path but didn't have containerkit instance during init, set up the watcher now
    if (this._editorOptions.path && !this._fileWatcher) {
      this._setupFileWatcher(this._editorOptions.path);
    }
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;

    // Cancel any pending async operations
    this._pendingPathChange?.abort();
    this._pendingPathChange = undefined;

    // Clean up all subscriptions and observers
    this._fileWatcher?.close();
    this._fileWatcher = undefined;

    this._onChangeSubscription?.dispose();
    this._onChangeSubscription = undefined;

    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;

    this._editor?.dispose();
    this._editor = undefined;

    this._element = undefined;

    super.dispose();
  }

  // ===========================================
  // Initialization helpers
  // ===========================================

  /**
   * Load the initial value for the editor based on priority:
   * 1. Explicit value in options (highest priority)
   * 2. File content from containerkit if path is provided
   * 3. Empty string (fallback)
   */
  private async _loadInitialValue(path: string | undefined): Promise<string> {
    if (this._editorOptions.value !== undefined) {
      this._lastSavedValue = this._editorOptions.value;
      return this._editorOptions.value;
    }

    if (path && this._containerKitInstance) {
      try {
        const fileContent = await this._containerKitInstance.readFile(path);
        const value = fileContent ?? '';
        this._lastSavedValue = value;
        return value;
      } catch {
        // File doesn't exist yet
      }
    }

    this._lastSavedValue = '';
    return '';
  }

  private _setupEventHandlers(): void {
    if (!this._editor) {
      throw new Error('Cannot setup event handlers before editor is created');
    }

    this._listeners.onMount?.(this._editor);

    this._onChangeSubscription = this._editor.onDidChangeModelContent(event => {
      if (!this._editor || this._suppressOnChange) {
        return;
      }

      this._listeners.onChange?.(this._editor.getValue(), event);
    });
  }

  private _setupResizeObserver(element: HTMLElement): void {
    this._resizeObserver = new ResizeObserver(() => {
      if (!this._isDisposed && this._editor) {
        this._editor.layout();
      }
    });

    this._resizeObserver.observe(element);
  }

  private _setupSaveShortcut(): void {
    if (!this._editor) {
      return;
    }

    this._commandDisposable = this._editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void this.save();
    });
  }

  // ===========================================
  // File watching and synchronization
  // ===========================================

  /**
   * Set up file watching to sync external changes back to the editor.
   * Only updates if the editor is not dirty to prevent overwriting user changes.
   */
  protected _setupFileWatcher(filepath: string | undefined): void {
    if (!filepath || !this._containerKitInstance) {
      return;
    }

    // Close existing watcher before setting up a new one
    this._fileWatcher?.close();

    this._fileWatcher = this._containerKitInstance.watch(filepath, {}, event => {
      if (this._isDisposed || !this._editor) {
        return;
      }

      if (event === 'change') {
        void this._handleFileChange(filepath);
      }
    });
  }

  /**
   * Handle external file changes by updating the editor if it's not dirty.
   * Uses the current containerkit instance to avoid stale closures.
   */
  private async _handleFileChange(filepath: string): Promise<void> {
    if (!this._editor || !this._containerKitInstance || this._isDisposed) {
      return;
    }

    try {
      const fileContent = await this._containerKitInstance.readFile(filepath);
      const currentValue = this._editor.getValue();

      // Only update if content differs and editor is clean
      if (fileContent !== currentValue && !this.isDirty) {
        this._suppressOnChange = true;
        this._editor.setValue(fileContent ?? '');
        this._lastSavedValue = fileContent ?? '';
        this._suppressOnChange = false;
      }
    } catch {
      // File was deleted or read error - ignore
    }
  }

  // ===========================================
  // File operations
  // ===========================================

  /**
   * Ensure parent directories exist before writing a file.
   * Uses mkdir -p for atomic directory creation.
   */
  private async _ensureDirectoryExists(filepath: string): Promise<void> {
    if (!this._containerKitInstance) {
      return;
    }

    const pathParts = filepath.split('/').filter(Boolean);
    if (pathParts.length <= 1) {
      return;
    }

    pathParts.pop(); // Remove filename

    const dirPath = `/${pathParts.join('/')}`;

    try {
      await this._containerKitInstance.spawn('mkdir', ['-p', dirPath]);
    } catch {
      // Directory might already exist or other error - continue anyway
    }
  }

  public async save(): Promise<void> {
    if (!this._editor || !this._editorOptions.path || !this._containerKitInstance) {
      return;
    }

    const currentValue = this._editor.getValue();

    try {
      await this._ensureDirectoryExists(this._editorOptions.path);
      await this._containerKitInstance.writeFile(this._editorOptions.path, currentValue);

      this._lastSavedValue = currentValue;
      this._listeners.onSave?.(currentValue);
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  }

  public get containerkitInstance(): Containerkit | undefined {
    return this._containerKitInstance;
  }

  // ===========================================
  // Public API - State queries
  // ===========================================

  public get isDirty(): boolean {
    if (!this._editor) {
      return false;
    }

    const currentValue = this._editor.getValue();
    return currentValue !== this._lastSavedValue;
  }

  public getValue(): string | undefined {
    return this._editor?.getValue();
  }

  public getMonacoInstance(): mncn.editor.IStandaloneCodeEditor | undefined {
    return this._editor;
  }

  // ===========================================
  // Public API - Configuration updates
  // ===========================================

  public update(options: MonacoOptions): void {
    this._editor?.updateOptions(options);
  }

  public setValue(value: string | undefined): void {
    if (!this._editor || value == null) {
      return;
    }

    if (value === this._editor.getValue()) {
      return;
    }

    this._suppressOnChange = true;
    this._editor.setValue(value);
    this._suppressOnChange = false;
  }

  public setLanguage(language: string): void {
    if (!this._editor) {
      return;
    }

    const model = this._editor.getModel();
    if (!model) {
      return;
    }

    monaco.editor.setModelLanguage(model, language);
  }

  public setTheme(theme: string): void {
    monaco.editor.setTheme(theme);
  }

  /**
   * Change the file path the editor is working with.
   * This will load the new file content and create/reuse a Monaco model for that path.
   * Cancels any pending path changes to avoid race conditions.
   */
  public setPath(path: string): void {
    if (!this._editor) {
      return;
    }

    // Cancel any pending path change
    this._pendingPathChange?.abort();

    const abortController = new AbortController();
    this._pendingPathChange = abortController;

    void (async () => {
      try {
        const value = await this._loadInitialValue(path);

        // Check if this operation was cancelled
        if (abortController.signal.aborted || this._isDisposed) {
          return;
        }

        const model = getOrCreateModel(monaco, value, this._editorOptions.language, path);

        this._suppressOnChange = true;
        this._editor?.setModel(model);
        this._suppressOnChange = false;

        // Update internal state to reflect the new path
        this._editorOptions.path = path;

        // Set up new file watcher for the new path
        this._fileWatcher?.close();
        this._setupFileWatcher(path);

        // Clear the pending controller if it's still the current one
        if (this._pendingPathChange === abortController) {
          this._pendingPathChange = undefined;
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Failed to change editor path:', error);
        }
      }
    })();
  }

  // ===========================================
  // Public API - Event listeners
  // ===========================================

  public setListener<TEvent extends EditorListener>(event: TEvent, callback: EditorListenerCallbacks[TEvent]): void {
    this._listeners[event] = callback;
  }
}
