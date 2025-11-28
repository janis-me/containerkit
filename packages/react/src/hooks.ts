import { useEffect, useRef, useState } from 'react';

import type { FileSystemTree, IFSWatcher } from '@containerkit/core/webcontainer';

import { useContainerkit } from '#context';

export function useFilesystemTree(base: string) {
  const containerkit = useContainerkit();
  const watcherRef = useRef<IFSWatcher | null>(null);
  const [tree, setTree] = useState<FileSystemTree>({});

  useEffect(() => {
    if (!containerkit) return;

    containerkit
      .getFileSystemTree(base)
      .then(setTree)
      .catch((err: unknown) => {
        console.error('Failed to get filesystem tree:', err);
      });

    const watcher = containerkit.fs?.watch(base, { recursive: true }, () => {
      containerkit
        .getFileSystemTree(base)
        .then(setTree)
        .catch((err: unknown) => {
          console.error('Failed to get filesystem tree:', err);
        });
    });

    if (watcher) {
      watcherRef.current = watcher;
    }

    return () => {
      watcherRef.current?.close();
    };
  }, [containerkit, base]);

  return tree;
}
