import { useEffect, useRef } from 'react';

import type { EditorOptions, MonacoOptions } from '@containerkit/core';
import { Editor as _Editor } from '@containerkit/core';

import { useContainerkit } from '#context';

export interface EditorProps extends EditorOptions {
  monacoOptions?: MonacoOptions | undefined;
}

export function Editor({ monacoOptions, ...editorOptions }: EditorProps) {
  const containerkitInstance = useContainerkit();

  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorContainerRef.current || !containerkitInstance) return;

    const editorInstance = new _Editor(containerkitInstance, editorOptions, monacoOptions);
    editorInstance
      .init(editorContainerRef.current)
      .then(() => {
        containerkitInstance.attach(editorInstance);
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize Editor instance:', error);
      });
  }, [editorOptions, monacoOptions, containerkitInstance]);

  return <div ref={editorContainerRef}></div>;
}
