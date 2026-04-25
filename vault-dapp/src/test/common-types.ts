export interface LedgerMapItem<T> {
  key: Uint8Array;
  item: T;
}

export interface LedgerMapping<T> {
  isEmpty(): boolean;
  size(): bigint;
  member(key: Uint8Array): boolean;
  lookup(key: Uint8Array): T;
  [Symbol.iterator](): Iterator<[Uint8Array, T]>;
}
