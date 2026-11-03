/**
 * Pure list-reorder helpers: every function returns a NEW array that is a
 * pure permutation of the input — same object references, no field changes,
 * no element loss. Unknown ids / out-of-range moves are a no-op copy.
 */

/** Remove the element `fromId` and re-insert it at `toId`'s index. */
export function moveById<T extends { id: string }>(list: T[], fromId: string, toId: string): T[] {
  const from = list.findIndex(x => x.id === fromId);
  const to = list.findIndex(x => x.id === toId);
  if (from === -1 || to === -1 || from === to) return list.slice();
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Move `id` one position earlier (-1) or later (+1). */
export function moveByOffset<T extends { id: string }>(list: T[], id: string, offset: -1 | 1): T[] {
  const i = list.findIndex(x => x.id === id);
  const j = i + offset;
  if (i === -1 || j < 0 || j >= list.length) return list.slice();
  const next = list.slice();
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}
