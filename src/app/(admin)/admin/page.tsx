import {
  FileQuestion,
  GraduationCap,
  Library,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getCollections } from "@/actions/admin/collections";
import { getExams } from "@/actions/admin/exams";
import { getGroups } from "@/actions/admin/groups";
import { getProblems } from "@/actions/admin/problems";
import { getUsers } from "@/actions/admin/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function AdminDashboard() {
  const [usersData, examsData, problemsData, groupsData, collectionsData] =
    await Promise.all([
      getUsers({ limit: 1 }),
      getExams({ limit: 1 }),
      getProblems({ limit: 1 }),
      getGroups({ limit: 1 }),
      getCollections({ limit: 1 }),
    ]);

  const stats = [
    {
      title: "Total Users",
      value: usersData.total,
      icon: Users,
      href: "/admin/users",
      color:
        "from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/5",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Exams",
      value: examsData.total,
      icon: GraduationCap,
      href: "/admin/exams",
      color:
        "from-violet-500/10 to-violet-500/5 dark:from-violet-500/20 dark:to-violet-500/5",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Problems",
      value: problemsData.total,
      icon: FileQuestion,
      href: "/admin/problems",
      color:
        "from-amber-500/10 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/5",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Groups",
      value: groupsData.total,
      icon: Users,
      href: "/admin/groups",
      color:
        "from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Collections",
      value: collectionsData.total,
      icon: Library,
      href: "/admin/collections",
      color:
        "from-rose-500/10 to-rose-500/5 dark:from-rose-500/20 dark:to-rose-500/5",
      iconColor: "text-rose-600 dark:text-rose-400",
    },
  ];

  const quickActions = [
    {
      label: "Create Problem",
      href: "/admin/problems/new",
      icon: FileQuestion,
      description: "Add a new coding problem",
    },
    {
      label: "Create Exam",
      href: "/admin/exams/new",
      icon: GraduationCap,
      description: "Schedule a new exam",
    },
    {
      label: "Import Users",
      href: "/admin/users",
      icon: Users,
      description: "Bulk import from CSV",
    },
    {
      label: "Create Collection",
      href: "/admin/collections/new",
      icon: Library,
      description: "Organize problems",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of the BuildIT platform
        </p>
      </div>
      <Separator />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card
              className={`bg-gradient-to-br ${stat.color} border transition-shadow hover:shadow-md cursor-pointer`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-1">
                      {action.label}
                      <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
