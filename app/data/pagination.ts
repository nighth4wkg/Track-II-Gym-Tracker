import { MAX_QUERY_PAGES, QUERY_PAGE_SIZE } from "../trackConstants";

export type QueryPageError = { message?: string } | null;

export async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryPageError }>,
) {
  const rows: T[] = [];
  for (let page = 0; page < MAX_QUERY_PAGES; page += 1) {
    const from = page * QUERY_PAGE_SIZE;
    const result = await loadPage(from, from + QUERY_PAGE_SIZE - 1);
    if (result.error) return { rows: [], error: result.error };
    const pageRows = result.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < QUERY_PAGE_SIZE) return { rows, error: null };
  }
  return { rows: [], error: { message: "The response exceeded the safe pagination limit." } };
}
