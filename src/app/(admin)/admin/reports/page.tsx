import Link from "next/link";
import { Code2, FileText, Target, BookOpen, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  const categories = [
    {
      title: "Labs",
      description: "View cumulative and week-wise lab performance",
      icon: Code2,
      href: "/admin/reports/labs",
      color: "text-cyan-600",
      bgColor: "bg-cyan-500/10",
      hoverBorder: "hover:border-cyan-400/50"
    },
    {
      title: "Assessments",
      description: "Track performance across standard assessments",
      icon: FileText,
      href: "/admin/reports/assessments",
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
      hoverBorder: "hover:border-purple-400/50"
    },
    {
      title: "AAT",
      description: "Alternative Assessment Tool reports",
      icon: Target,
      href: "#", // Placeholder
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
      hoverBorder: "hover:border-emerald-400/50"
    },
    {
      title: "Bootcamp",
      description: "Specialized training bootcamp reports",
      icon: BookOpen,
      href: "#", // Placeholder
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
      hoverBorder: "hover:border-amber-400/50"
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports Dashboard</h1>
        <p className="text-muted-foreground">Select a category to view detailed reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <Link key={category.title} href={category.href}>
            <Card className={`h-full hover:shadow-md transition-all cursor-pointer group border ${category.hoverBorder}`}>
              <CardHeader className="pb-2">
                <div className={`w-12 h-12 rounded-lg ${category.bgColor} flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}>
                  <category.icon className={`h-6 w-6 ${category.color}`} />
                </div>
                <CardTitle className="text-lg">{category.title}</CardTitle>
                <CardDescription className="text-xs">{category.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className={`flex items-center text-xs font-medium ${category.color} opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300`}>
                  {category.href !== "#" ? "View Reports" : "Coming Soon"} <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
