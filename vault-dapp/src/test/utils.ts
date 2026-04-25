import { toHex } from "@midnight-ntwrk/compact-runtime";

import type { LedgerMapping } from "./common-types";

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export const convertLedgerMappingToArray = <T>(
  state: LedgerMapping<T>
) => {
  return Array.from(state).map(([key, item]) => ({
    key,
    item,
  }));
};

export const convertUint8ArraysToStrings = <T>(value: T): unknown => {
  if (value instanceof Uint8Array) {
    return toHex(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => convertUint8ArraysToStrings(item));
  }

  if (value instanceof Object) {
    const result: Record<string, unknown> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = convertUint8ArraysToStrings(
          (value as Record<string, unknown>)[key]
        );
      }
    }
    return result;
  }

  return value;
};
