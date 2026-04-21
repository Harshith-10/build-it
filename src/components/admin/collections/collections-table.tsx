"use client";

import { Library } from "lucide-react";
import { deleteCollection, getCollections } from "@/actions/admin/collections";
import { AdminEntityTable } from "@/components/admin/admin-entity-table";
import type { EntityTableConfig } from "@/hooks/use-entity-table-vm";
import { type Collection, createColumns } from "./columns";

const collectionsConfig: EntityTableConfig<Collection> = {
  entityName: "Collection",
  searchKey: "title",
  searchPlaceholder: "Search collections...",
  deleteDescription:
    "This will permanently delete this collection. The problems in it will not be affected. This action cannot be undone.",
  fetchFn: async (params) => {
    const result = await getCollections(params);
    return { data: result.collections as Collection[], total: result.total };
  },
  deleteFn: deleteCollection,
};

export function CollectionsTable() {
  return (
    <AdminEntityTable
      config={collectionsConfig}
      createColumns={(onDelete, page, pageSize) =>
        createColumns(onDelete, page, pageSize, "/admin")
      }
      emptyState={
        <div className="flex flex-col items-center gap-2">
          <Library className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No collections yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first collection to organize problems
          </p>
        </div>
      }
    />
  );
}

export function CollectionsTableForPath({ basePath }: { basePath: string }) {
  return (
    <AdminEntityTable
      config={collectionsConfig}
      createColumns={(onDelete, page, pageSize) =>
        createColumns(onDelete, page, pageSize, basePath)
      }
      emptyState={
        <div className="flex flex-col items-center gap-2">
          <Library className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No collections yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first collection to organize problems
          </p>
        </div>
      }
    />
  );
}
