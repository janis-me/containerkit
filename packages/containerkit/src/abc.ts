import type { Containerkit } from '#containerkit';

/**
 * Base class for Terminal, Editor, and other components.
 */
export abstract class ABC {
  protected _containerKitInstance: Containerkit | undefined;

  constructor(instance?: Containerkit) {
    this._containerKitInstance = instance;
  }

  public abstract attach(instance: Containerkit): void;
}
