"use client";

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

const sortDirections = ["asc", "desc"] as const;

/**
 * URL-synced table state via nuqs.
 * Persists search, pagination, sorting, and hidden columns to the URL so that
 * page refreshes / link sharing preserve the user's table state.
 */
export function useTableSearchParams() {
  const [params, setParams] = useQueryStates(
    {
      search: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(10),
      sort: parseAsString.withDefault(""),
      order: parseAsStringLiteral(sortDirections).withDefault("desc"),
      hiddenCols: parseAsArrayOf(parseAsString, ",").withDefault([]),
    },
    {
      // shallow: false pushes to the router so server components re-render
      // but we do client-side fetching, so shallow is fine
      history: "push",
    },
  );

  const setSearch = (value: string) => setParams({ search: value, page: 1 }); // reset page on new search
  const setPage = (value: number) => setParams({ page: value });
  const setPageSize = (value: number) =>
    setParams({ pageSize: value, page: 1 });
  const setSort = (column: string, direction: "asc" | "desc") =>
    setParams({ sort: column, order: direction });
  const setHiddenCols = (cols: string[]) =>
    setParams({ hiddenCols: cols.length > 0 ? cols : null });

  return {
    search: params.search,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    order: params.order,
    hiddenCols: params.hiddenCols,
    setSearch,
    setPage,
    setPageSize,
    setSort,
    setHiddenCols,
  } as const;
}

export type TableSearchParams = ReturnType<typeof useTableSearchParams>;
