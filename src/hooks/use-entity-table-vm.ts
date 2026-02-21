"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTableSearchParams } from "./use-table-search-params";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Shape that each entity's fetch function must return */
export interface FetchResult<T> {
  data: T[];
  total: number;
}

/** Params forwarded to the entity's fetch function */
/** Params forwarded to the entity's fetch function */
export interface FetchParams {
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

/** Configuration object — one per entity type */
export interface EntityTableConfig<T extends { id: string }> {
  /** Display name used in toasts, e.g. "User" */
  entityName: string;

  /** Adapter around the server action — normalises response to FetchResult */
  fetchFn: (params: FetchParams) => Promise<FetchResult<T>>;

  /** Server action delete wrapper */
  deleteFn: (id: string) => Promise<{ success: boolean; error?: string }>;

  /** Column accessor key used for text search */
  searchKey: string;

  /** Placeholder shown in the search input */
  searchPlaceholder: string;

  /** Custom description for the delete confirmation dialog */
  deleteDescription?: string;
}

// ─── ViewModel Hook ──────────────────────────────────────────────────────────

import type { SortingState } from "@tanstack/react-table";

/**
 * Generic ViewModel hook for admin data tables.
 *
 * Encapsulates:
 *  - URL-synced search/sort/pagination via `useTableSearchParams`
 *  - Data fetching lifecycle (loading, error, refetch)
 *  - Delete workflow (confirmation id, execute, toast)
 */
export function useEntityTableVM<T extends { id: string }>(
  config: EntityTableConfig<T>,
) {
  const searchParams = useTableSearchParams();
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch data whenever relevant search params change
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await config.fetchFn({
        page: searchParams.page,
        limit: searchParams.pageSize,
        search: searchParams.search,
        sort: searchParams.sort,
        order: searchParams.order as "asc" | "desc", // Type assertion for safety
      });
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error(`Failed to fetch ${config.entityName}s:`, err);
      toast.error(`Failed to load ${config.entityName.toLowerCase()}s`);
    } finally {
      setIsLoading(false);
    }
  }, [
    config,
    searchParams.page,
    searchParams.pageSize,
    searchParams.search,
    searchParams.sort,
    searchParams.order,
  ]);

  useEffect(() => {
    fetchData();

    const handleRefetch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || customEvent.detail === config.entityName) {
        fetchData();
      }
    };

    window.addEventListener("entity-table-refresh", handleRefetch);
    return () => {
      window.removeEventListener("entity-table-refresh", handleRefetch);
    };
  }, [fetchData, config.entityName]);

  // Delete workflow
  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    const result = await config.deleteFn(deleteId);
    if (result.success) {
      toast.success(`${config.entityName} deleted`);
      fetchData();
    } else {
      toast.error(
        result.error || `Failed to delete ${config.entityName.toLowerCase()}`,
      );
    }
    setDeleteId(null);
  }, [deleteId, config, fetchData]);

  // Handle sorting change from DataTable
  const handleSortingChange = useCallback(
    (updaterOrValue: SortingState | ((prev: SortingState) => SortingState)) => {
      // We only support single column sorting for now
      const currentSort =
        searchParams.sort && searchParams.order
          ? [{ id: searchParams.sort, desc: searchParams.order === "desc" }]
          : [];

      const newSort =
        typeof updaterOrValue === "function"
          ? updaterOrValue(currentSort)
          : updaterOrValue;

      const firstSort = newSort[0];
      if (firstSort) {
        searchParams.setSort(firstSort.id, firstSort.desc ? "desc" : "asc");
      } else {
        // Reset sort
        searchParams.setSort("", "desc"); // Default or clear
      }
    },
    [searchParams],
  );

  return useMemo(
    () => ({
      // Data
      data,
      total,
      isLoading,

      // Search params (forwarded for the view to bind)
      searchParams,

      // Sorting
      sorting:
        searchParams.sort && searchParams.order
          ? ([
              { id: searchParams.sort, desc: searchParams.order === "desc" },
            ] as SortingState)
          : [],
      onSortingChange: handleSortingChange,

      // Delete workflow
      deleteId,
      setDeleteId,
      handleDelete,

      // Manual refresh
      refetch: fetchData,
    }),
    [
      data,
      total,
      isLoading,
      searchParams,
      handleSortingChange,
      deleteId,
      handleDelete,
      fetchData,
    ],
  );
}

export type EntityTableVM<T extends { id: string }> = ReturnType<
  typeof useEntityTableVM<T>
>;
