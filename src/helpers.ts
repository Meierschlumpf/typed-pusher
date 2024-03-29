type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export const genericObjectEntries = <TObject extends Record<string, unknown>>(object: TObject) => {
  return Object.entries(object) as Entries<TObject>;
};
