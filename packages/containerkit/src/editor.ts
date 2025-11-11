import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { ABC } from '#abc';
import type { Containerkit } from '#containerkit';
import { getOrCreateModel } from '#utils';

const DEFAULT_EDITOR_PATH = 'index.ts' as const;
const DEFAULT_EDITOR_LANGUAGE = 'typescript' as const;

export interface EditorListenerCallbacks {
  onMount: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onChange: (value: string, event: monaco.editor.IModelContentChangedEvent) => void;
}

export type EditorListener = keyof EditorListenerCallbacks;

export type EditorListeners = {
  [K in keyof EditorListenerCallbacks]?: EditorListenerCallbacks[K] | undefined;
};

/**
 * Options that can be passed to monaco editor, excluding those that are
 * managed by Containerkit Editor itself, namely 'model', 'value' and 'language'.
 */
export type MonacoOptions = Exclude<monaco.editor.IStandaloneEditorConstructionOptions, 'model' | 'value' | 'language'>;

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
  protected _editor: monaco.editor.IStandaloneCodeEditor | undefined;
  protected _editorOptions: EditorOptions | undefined;

  protected _monacoOptions: MonacoOptions | undefined;
  protected _onChangeSubscription: monaco.IDisposable | undefined;
  protected _resizeObserver: ResizeObserver | undefined;

  protected _preventOnChangeTrigger = false;

  protected _listeners: EditorListeners = {};

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
  }

  public init(element: HTMLElement) {
    element.classList.add('containerkit-editor');

    const model = getOrCreateModel(
      monaco,
      this._editorOptions?.value ?? '',
      this._editorOptions?.language ?? DEFAULT_EDITOR_LANGUAGE,
      this._editorOptions?.path ?? DEFAULT_EDITOR_PATH,
    );

    this._editor = monaco.editor.create(element, {
      ...(this._monacoOptions ?? {}),
      model,
      language: this._editorOptions?.language ?? DEFAULT_EDITOR_LANGUAGE,
    });

    this._handleMount();

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

  public dispose() {
    this._editor?.dispose();
    this._onChangeSubscription?.dispose();
    this._resizeObserver?.disconnect();
  }

  public setListener<TEvent extends EditorListener>(event: TEvent, callback: EditorListenerCallbacks[TEvent]) {
    this._listeners[event] = callback;
  }

  public getMonacoInstance(): monaco.editor.IStandaloneCodeEditor | undefined {
    return this._editor;
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
