import { useEffect, useRef } from 'react';

import type { EditorOptions, MonacoOptions } from '@containerkit/core';
import { Editor as _Editor } from '@containerkit/core';

import { useContainerkit } from '#context';

export interface EditorProps extends EditorOptions {
  monacoOptions?: MonacoOptions | undefined;
}

export function Editor({ monacoOptions, path, language, defaultValue }: EditorProps) {
  const containerkitInstance = useContainerkit();

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<_Editor | null>(null);

  useEffect(() => {
    if (!editorContainerRef.current || !containerkitInstance) return;

    editorInstanceRef.current = new _Editor(containerkitInstance, { path, language, defaultValue }, monacoOptions);
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
      disposePromise.then(disposeFn => {
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
