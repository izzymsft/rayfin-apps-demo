export interface Page<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor?: string | null;
}

export async function collectPages<T extends { id: string }>(
  fetchPage: (cursor?: string) => Promise<Page<T>>,
): Promise<T[]> {
  const items: T[] = [];
  const cursors = new Set<string>();
  const ids = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const page = await fetchPage(cursor);
    for (const item of page.items) {
      if (ids.has(item.id)) throw new Error('Pagination returned duplicate records; refresh and retry.');
      ids.add(item.id);
      items.push(item);
    }
    if (!page.hasNextPage) return items;
    if (!page.endCursor || cursors.has(page.endCursor) || page.items.length === 0) {
      throw new Error('Pagination cursor did not advance; results may be incomplete.');
    }
    cursors.add(page.endCursor);
    cursor = page.endCursor;
  }
}
