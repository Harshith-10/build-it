import { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, Briefcase, ArrowRight, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Assessment Categories",
};

export default function AssessmentsCategoryPage() {
  const categories = [
    {
      title: "Lab Assessments",
      description: "View reports for laboratory-based examinations",
      icon: FlaskConical,
      href: "/admin/reports/assessments/lab",
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
      hoverBorder: "hover:border-blue-400/50"
    },
    {
      title: "CDC Assessments",
      description: "View reports for Career Development Cell examinations",
      icon: Briefcase,
      href: "/admin/reports/assessments/cdc",
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
      hoverBorder: "hover:border-purple-400/50"
    }
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Assessment Categories"
        description="Select an assessment category to view its reports"
        backHref="/admin/reports"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
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
                  View Reports <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
