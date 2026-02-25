"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { BulkGroupDialog } from "@/components/admin/groups/bulk-group-dialog";
import { GroupsTable } from "@/components/admin/groups/groups-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default function GroupsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Groups"
        description="Organize users into groups for exam assignments"
        actions={
          <>
            <BulkGroupDialog />
            <Link href="/admin/groups/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Group
              </Button>
            </Link>
          </>
        }
      />
      <GroupsTable />
    </div>
  );
}
