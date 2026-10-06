import {
  FileQuestion,
  FlaskConical,
  GraduationCap,
  Library,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getDashboardAnalytics } from "@/actions/admin/analytics";
import { getCollections } from "@/actions/admin/collections";
import { getExams } from "@/actions/admin/exams";
import { getGroups } from "@/actions/admin/groups";
import { getLabs } from "@/actions/admin/labs";
import { getProblems } from "@/actions/admin/problems";
import { getUsers } from "@/actions/admin/users";
import { getOpenTicketCount } from "@/actions/tickets";
import { DashboardAnalytics } from "@/components/admin/dashboard/dashboard-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function AdminDashboard() {
  const [
    usersData,
    examsData,
    labsData,
    problemsData,
    groupsData,
    collectionsData,
    openRequestCount,
    analyticsData,
  ] = await Promise.all([
    getUsers({ limit: 1 }),
    getExams({ limit: 1 }),
    getLabs(),
    getProblems({ limit: 1 }),
    getGroups({ limit: 1 }),
    getCollections({ limit: 1 }),
    getOpenTicketCount(),
    getDashboardAnalytics(),
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
      title: "Laboratories",
      value: Array.isArray(labsData) ? labsData.length : 0,
      icon: FlaskConical,
      href: "/admin/labs",
      color:
        "from-cyan-500/10 to-cyan-500/5 dark:from-cyan-500/20 dark:to-cyan-500/5",
      iconColor: "text-cyan-600 dark:text-cyan-400",
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
    {
      title: "Open Requests",
      value: openRequestCount,
      icon: MessageSquare,
      href: "/admin/requests",
      color:
        "from-indigo-500/10 to-indigo-500/5 dark:from-indigo-500/20 dark:to-indigo-500/5",
      iconColor: "text-indigo-600 dark:text-indigo-400",
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
      label: "Create Lab",
      href: "/admin/labs/new",
      icon: FlaskConical,
      description: "Setup laboratory exercises",
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
    <div className="flex flex-col gap-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time analytics and overview of the BuildIT platform
        </p>
      </div>

      {/* Resource Stats */}
      <div className="grid gap-3.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card
              className={`bg-linear-to-br ${stat.color} border transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Separator />

      {/* Live Visit & Group Analytics Section */}
      <DashboardAnalytics initialData={analyticsData} />

      <Separator />

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group h-full">
                <CardContent className="flex items-center gap-3.5 p-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors shrink-0">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-1">
                      <span className="truncate">{action.label}</span>
                      <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
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
