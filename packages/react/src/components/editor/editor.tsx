import { useEffect, useRef } from 'react';

import type { EditorOptions, MonacoOptions } from '@containerkit/core';
import { Editor as _Editor } from '@containerkit/core';

import { useContainerkit } from '#context';

export interface EditorProps extends EditorOptions {
  monacoOptions?: MonacoOptions | undefined;
}

/**
 * A code editor component powered by Monaco Editor and Containerkit.
 * If used inside a ContainerkitProvider, the editor will automatically
 * connect to the Containerkit instance provided.
 *
 * Usually, you want to only provide the `path` prop here and let Containerkit
 * handle loading/saving the file content and language.
 */
export function Editor({ monacoOptions, path, language, value }: EditorProps) {
  const containerkitInstance = useContainerkit();

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<_Editor | null>(null);

  useEffect(() => {
    if (!editorContainerRef.current || !containerkitInstance) return;

    editorInstanceRef.current = new _Editor(containerkitInstance, { path, language, value }, monacoOptions);
    const disposePromise = editorInstanceRef.current
      .init(editorContainerRef.current)
      .then(disposeFn => {
        editorInstanceRef.current?.attach(containerkitInstance);
        return disposeFn;
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize Editor instance:', error);
      });

    return () => {
      void disposePromise.then(disposeFn => {
        disposeFn?.();
      });
    };
  }, [containerkitInstance]);

  useEffect(() => {
    if (!editorInstanceRef.current || !path) return;

    editorInstanceRef.current.setPath(path);
  }, [path]);

  useEffect(() => {
    if (!editorInstanceRef.current || !language) return;

    editorInstanceRef.current.setLanguage(language);
  }, [language]);

  return <div ref={editorContainerRef}></div>;
}
