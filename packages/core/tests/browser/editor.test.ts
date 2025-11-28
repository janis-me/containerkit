import { describe, expect, it } from 'vitest';

import { Editor } from '#index';

describe('Editor', () => {
  describe('initialization', () => {
    it('should create an Editor instance without props', () => {
      const editor = new Editor();
      expect(editor).toBeInstanceOf(Editor);
    });

    it('should init and return dispose function', async () => {
      const conainer = document.createElement('div');
      document.body.appendChild(conainer);

      const exitor = new Editor();
      const disposeFn = await exitor.init(conainer);
      expect(typeof disposeFn).toBe('function');

      expect(conainer.querySelector('.monaco-editor')).not.toBeNull();

      disposeFn();
      expect(conainer.querySelector('.monaco-editor')).toBeNull();
    });
  });
});
