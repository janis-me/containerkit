import type { Containerkit } from '#containerkit';

/**
 * Base class for Terminal, Editor, and other components.
 */
export abstract class ABC {
  protected _containerKitInstance: Containerkit | undefined;

  constructor(instance?: Containerkit) {
    this._containerKitInstance = instance;
  }

  /**
   * Attach the component to a Containerkit instance.
   * For "attaching" to an HTML element, use the `init` method instead.
   */
  public abstract attach(instance: Containerkit): void;

  public abstract init(...args: unknown[]): Promise<() => void>;

  public setInstance(instance: Containerkit) {
    this._containerKitInstance = instance;
  }

  public dispose() {
    if (this._containerKitInstance) {
      this._containerKitInstance.detach(this);
    }

    this._containerKitInstance = undefined;
  }
}
