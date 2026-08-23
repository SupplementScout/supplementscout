export function isSitemapPathIndexable(
  path: string,
  readiness: ReadonlyMap<string, boolean>
) {
  return !readiness.has(path) || readiness.get(path) === true;
}
