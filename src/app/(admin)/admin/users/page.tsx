"use client";

import { PageHeader } from "@/components/admin/page-header";
import { UsersTable } from "@/components/admin/users/users-table";
import { UserImportWizard } from "@/components/admin/users/import-wizard";
import { CreateUserDialog } from "@/components/admin/users/create-user-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Manage platform users and bulk import"
        actions={<CreateUserDialog />}
      />
      <Tabs defaultValue="manage" className="w-full">
        <TabsList>
          <TabsTrigger value="manage">Manage Users</TabsTrigger>
          <TabsTrigger value="import">Bulk Import</TabsTrigger>
        </TabsList>
        <TabsContent value="manage" className="mt-4">
          <UsersTable />
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <UserImportWizard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
