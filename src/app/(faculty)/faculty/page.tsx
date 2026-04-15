import { FileQuestion, GraduationCap, Library, Plus } from "lucide-react";
import Link from "next/link";
import { getCollections } from "@/actions/admin/collections";
import { getExams } from "@/actions/admin/exams";
import { getProblems } from "@/actions/admin/problems";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function FacultyDashboardPage() {
  const [problemsData, collectionsData, examsData] = await Promise.all([
    getProblems({ limit: 1 }),
    getCollections({ limit: 1 }),
    getExams({ limit: 1 }),
  ]);

  const stats = [
    {
      title: "My Problems",
      value: problemsData.total,
      icon: FileQuestion,
      href: "/faculty/problems",
    },
    {
      title: "My Collections",
      value: collectionsData.total,
      icon: Library,
      href: "/faculty/collections",
    },
    {
      title: "My Exams",
      value: examsData.total,
      icon: GraduationCap,
      href: "/faculty/exams",
    },
  ];

  const quickActions = [
    {
      label: "Create Problem",
      href: "/faculty/problems/new",
      icon: FileQuestion,
      description: "Create a private problem",
    },
    {
      label: "Create Collection",
      href: "/faculty/collections/new",
      icon: Library,
      description: "Create a private collection",
    },
    {
      label: "Create Exam",
      href: "/faculty/exams/new",
      icon: GraduationCap,
      description: "Create and assign a private exam",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faculty Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your owned content and quick creation workflows
        </p>
      </div>
      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="border transition-shadow hover:shadow-md cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-3">
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
