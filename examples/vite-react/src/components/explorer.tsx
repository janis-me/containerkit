import { useState } from 'react';

import { useContainerkit, useFilesystemTree } from '@containerkit/react';
import type { FileSystemTree } from '@containerkit/react/webcontainer';

export interface ExplorerProps {
  onFileClick: (filePath: string) => void;
}

export function Explorer({ onFileClick }: ExplorerProps) {
  const fsTree = useFilesystemTree('/');

  return (
    <div id="explorer">
      <h3>File Explorer</h3>
      <FileTreeView tree={fsTree} path="/" onFileClick={onFileClick} />
    </div>
  );
}

interface FileTreeViewProps {
  tree: FileSystemTree;
  path: string;
  level?: number;
  onFileClick: (filePath: string) => void;
}

function FileTreeView({ tree, path, onFileClick, level = 0 }: FileTreeViewProps) {
  return (
    <div style={{ paddingLeft: level > 0 ? '1rem' : 0 }}>
      {Object.entries(tree).map(([name, node]) => (
        <FileTreeNode
          key={name}
          name={name}
          node={node}
          level={level}
          path={`${path}/${name}`}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  name: string;
  node: FileSystemTree[string];
  path: string;
  level: number;
  onFileClick: (filePath: string) => void;
}

function FileTreeNode({ name, node, level, path, onFileClick }: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);

  if ('directory' in node) {
    const hasChildren = Object.keys(node.directory).length > 0;

    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            cursor: 'pointer',
            padding: '2px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{isOpen ? '📂' : '📁'}</span>
          <span>{name}</span>
          {hasChildren && (
            <span style={{ fontSize: '10px', opacity: 0.6 }}>({Object.keys(node.directory).length})</span>
          )}
        </div>
        {isOpen && hasChildren && (
          <FileTreeView tree={node.directory} level={level + 1} path={path} onFileClick={onFileClick} />
        )}
      </div>
    );
  }

  if ('file' in node) {
    return (
      <div
        style={{
          padding: '2px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        onClick={() => onFileClick(path)}
      >
        <span>📄</span>
        <span>{name}</span>
      </div>
    );
  }

  return null;
}
