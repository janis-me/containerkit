import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { EditorOptions, MonacoOptions } from '@containerkit/core';
import { Editor as _Editor } from '@containerkit/core';

import { useContainerkit } from '#context';

export interface EditorProps extends EditorOptions {
  monacoOptions?: MonacoOptions | undefined;
  /** Pass an existing Editor instance instead of creating a new one */
  instance?: _Editor | undefined;
  /** Callback fired when the editor is mounted and ready */
  onMount?: ((editor: _Editor) => void) | undefined;
}

/**
 * Imperative handle exposed via ref for the Editor component.
 * Use this to access the underlying Editor instance programmatically.
 * 
 * @example
 * const editorRef = useRef<EditorHandle>(null);
 * 
 * // Later:
 * await editorRef.current?.save();
 * const content = editorRef.current?.getValue();
 */
export interface EditorHandle {
  /** Get the underlying Editor instance */
  getInstance: () => _Editor | null;
  /** Get the current editor value */
  getValue: () => string | undefined;
  /** Set the editor value */
  setValue: (value: string) => void;
  /** Save the current file to the WebContainer */
  save: () => Promise<void>;
  /** Change the file path */
  setPath: (path: string) => void;
  /** Set the programming language */
  setLanguage: (language: string) => void;
  /** Check if editor has unsaved changes */
  isDirty: () => boolean;
}

/**
 * A code editor component powered by Monaco Editor and Containerkit.
 * If used inside a ContainerkitProvider, the editor will automatically
 * connect to the Containerkit instance provided.
 *
 * Usually, you want to only provide the `path` prop here and let Containerkit
 * handle loading/saving the file content and language.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { monacoOptions, path, language, value, instance, onMount },
  ref,
) {
  const containerkitInstance = useContainerkit();

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<_Editor | null>(instance ?? null);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      getInstance: () => editorInstanceRef.current,
      getValue: () => editorInstanceRef.current?.getValue(),
      setValue: (value: string) => {
        if (!editorInstanceRef.current) {
          throw new Error('Editor instance is not initialized');
        }
        editorInstanceRef.current.setValue(value);
      },
      save: async () => {
        if (!editorInstanceRef.current) {
          throw new Error('Editor instance is not initialized');
        }
        return editorInstanceRef.current.save();
      },
      setPath: (path: string) => {
        if (!editorInstanceRef.current) {
          throw new Error('Editor instance is not initialized');
        }
        editorInstanceRef.current.setPath(path);
      },
      setLanguage: (language: string) => {
        if (!editorInstanceRef.current) {
          throw new Error('Editor instance is not initialized');
        }
        editorInstanceRef.current.setLanguage(language);
      },
      isDirty: () => {
        if (!editorInstanceRef.current) {
          return false;
        }
        return editorInstanceRef.current.isDirty;
      },
    }),
    [],
  );

  useEffect(() => {
    if (!editorContainerRef.current || !containerkitInstance) return;

    // Use provided instance or create a new one
    const editorInstance = instance ?? new _Editor(containerkitInstance, { path, language, value }, monacoOptions);
    editorInstanceRef.current = editorInstance;

    const disposePromise = editorInstance
      .init(editorContainerRef.current)
      .then(disposeFn => {
        editorInstance.attach(containerkitInstance);
        onMount?.(editorInstance);
        return disposeFn;
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize Editor instance:', error);
      });

    return () => {
      // Only dispose if we created the instance (not if it was provided)
      if (!instance) {
        void disposePromise.then(disposeFn => {
          disposeFn?.();
        });
      }
    };
    // Intentionally only include containerkit instance and instance prop
    // Other props (path, language, value) are handled by separate useEffects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerkitInstance, instance]);

  useEffect(() => {
    if (!editorInstanceRef.current || !path) return;

    editorInstanceRef.current.setPath(path);
  }, [path]);

  useEffect(() => {
    if (!editorInstanceRef.current || !language) return;

    editorInstanceRef.current.setLanguage(language);
  }, [language]);

  return <div ref={editorContainerRef}></div>;
});
