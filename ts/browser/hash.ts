import { BrowserEncoding, mustGetEncoder } from './encoding';

/**
 * Hash returned from functions in the browser.
 */
export class Hash extends Uint8Array {
  /**
   * A constant-time comparison against the other hash/array.
   */
  public equals(other: unknown): boolean {
    if (!(other instanceof Uint8Array)) {
      return false;
    }

    if (other.length !== this.length) {
      return false;
    }

    let cmp = 0;
    for (let i = 0; i < this.length; i++) {
      cmp |= this[i] ^ other[i];
    }

    return cmp === 0;
  }

  public toString(encoding: BrowserEncoding = 'hex'): string {
    return mustGetEncoder(encoding)(this);
  }
}
