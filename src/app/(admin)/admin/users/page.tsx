"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { CreateUserDialog } from "@/components/admin/users/create-user-dialog";
import { UserImportWizard } from "@/components/admin/users/import-wizard";
import { UsersTable } from "@/components/admin/users/users-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UsersPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
        <PageHeader
          title="Users"
          description="Manage platform users and bulk import"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title="Users"
        description="Manage platform users and bulk import"
        actions={<CreateUserDialog />}
      />
      <Tabs
        defaultValue="manage"
        className="flex flex-1 flex-col min-h-0 w-full"
      >
        <TabsList>
          <TabsTrigger value="manage">Manage Users</TabsTrigger>
          <TabsTrigger value="import">Bulk Import</TabsTrigger>
        </TabsList>
        <TabsContent
          value="manage"
          className="mt-4 flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          <UsersTable />
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <UserImportWizard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
