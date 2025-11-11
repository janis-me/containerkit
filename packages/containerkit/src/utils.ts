import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export type Monaco = typeof monaco;

/**
 * OSC (Operating System Command) sequence types
 */
export type OSCSequenceType = 'prompt-start' | 'command-start' | 'command-end' | 'none';

/**
 * Parse OSC sequences from terminal output to detect shell state.
 *
 * WebContainers use OSC 654 sequences to signal terminal state when
 * jsh is spawned with the --osc flag.
 *
 * Also supports standard OSC 133 sequences for future compatibility
 * (used by bash, zsh, fish with shell integration).
 *
 * @param data - Raw terminal output data to parse
 * @returns Object containing the detected OSC sequence type
 *
 * @example
 * ```typescript
 * const result = parseOSCSequence('\x1b]654;prompt\x07');
 * console.log(result.type); // 'prompt-start'
 * ```
 */
export function parseOSCSequence(data: string): { type: OSCSequenceType } {
  // WebContainers OSC 654 sequences
  // Format: ESC ] 654 ; <state> BEL
  // where ESC = \x1b, BEL = \x07
  // This requires the --osc flag to be passed when spawning /bin/jsh
  // eslint-disable-next-line no-control-regex
  const oscMatch = /\x1b\]654;([^\x07]+)\x07/.exec(data);

  if (oscMatch) {
    const [, osc] = oscMatch;

    // 'interactive' - Terminal is ready for the first time
    if (osc === 'interactive') {
      return { type: 'prompt-start' };
    }

    // 'prompt' - Terminal is ready for input (prompt shown)
    if (osc === 'prompt') {
      return { type: 'prompt-start' };
    }

    // Note: WebContainers may not send explicit 'busy' or 'command-end' signals
    // The state transitions from IDLE to BUSY when we write, and back to IDLE
    // when we receive the next 'prompt' sequence
  }

  // Standard OSC 133 sequences (for future compatibility)
  // These are used by bash, zsh, fish with shell integration

  // OSC 133;A - Prompt start
  if (data.includes('\x1b]133;A')) {
    return { type: 'prompt-start' };
  }

  // OSC 133;B - Command start (user pressed enter)
  if (data.includes('\x1b]133;B')) {
    return { type: 'command-start' };
  }

  // OSC 133;D - Command finished
  if (data.includes('\x1b]133;D')) {
    return { type: 'command-end' };
  }

  return { type: 'none' };
}

export function getOrCreateModel(
  monaco: Monaco,
  value: string,
  language: string,
  path: string,
): monaco.editor.ITextModel {
  const uri = monaco.Uri.parse(path);
  let model = monaco.editor.getModel(uri);

  model ??= monaco.editor.createModel(value, language, uri);

  return model;
}
