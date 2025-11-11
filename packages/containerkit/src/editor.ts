import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { ABC } from '#abc';
import type { Containerkit } from '#containerkit';

export interface EditorListenerCallbacks {
  onMount: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onChange: (value: string, event: monaco.editor.IModelContentChangedEvent) => void;
}

export type EditorListener = keyof EditorListenerCallbacks;

export type EditorListeners = {
  [K in keyof EditorListenerCallbacks]?: EditorListenerCallbacks[K] | undefined;
};

export type MonacoOptions = monaco.editor.IStandaloneEditorConstructionOptions;

export class Editor extends ABC {
  protected _editor: monaco.editor.IStandaloneCodeEditor | undefined;
  protected _monacoOptions: MonacoOptions | undefined;
  protected _onChangeSubscription: monaco.IDisposable | undefined;

  protected _preventOnChangeTrigger = false;

  protected _listeners: EditorListeners = {};

  public constructor(instance?: Containerkit, monacoOptions: MonacoOptions | undefined = undefined) {
    super(instance);

    this._monacoOptions = monacoOptions;
  }

  protected handleMount() {
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

    this._editor = monaco.editor.create(element, this._monacoOptions);
    this.handleMount();

    return () => {
      this.dispose();
    };
  }

  public dispose() {
    this._editor?.dispose();
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
