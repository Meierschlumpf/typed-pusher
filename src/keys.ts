const generateKey = (prefix: string, data: unknown | undefined) => {
  if (data === undefined) return prefix;
  return `${prefix}-${JSON.stringify(data)}`;
};
