import { notFound } from "next/navigation";
import { getExam } from "@/actions/admin/exams";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatLocalDateTime, getLocalTimeZoneName } from "@/lib/date-time";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  const zone = getLocalTimeZoneName(date);
  const formatted = formatLocalDateTime(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  return zone ? `${formatted} ${zone}` : formatted;
}

function strategyLabel(value: string | null | undefined) {
  switch (value) {
    case "random_n":
      return "Random N";
    case "difficulty_mix":
      return "Difficulty Mix";
    case "fixed_set":
      return "Fixed Set";
    default:
      return value || "-";
  }
}

function gradingLabel(value: string | null | undefined) {
  switch (value) {
    case "linear":
      return "Linear";
    case "difficulty_based":
      return "Difficulty Based";
    case "count_based":
      return "Count Based";
    default:
      return value || "-";
  }
}

export default async function FacultyExamDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exam = await getExam(id);

  if (!exam) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 min-h-0 overflow-hidden">
      <PageHeader
        title={exam.title}
        description={
          exam.isModerator
            ? "Read-only moderator view"
            : "Exam details and assignments"
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Start</p>
              <p className="font-medium">{formatDate(exam.startTime)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">End</p>
              <p className="font-medium">{formatDate(exam.endTime)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-medium">{exam.durationMinutes} min</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Strategy</p>
              <p className="font-medium">{strategyLabel(exam.strategyType)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Grading</p>
              <p className="font-medium">
                {gradingLabel(exam.gradingStrategy)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant="secondary" className="capitalize">
                {exam.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collections & Moderators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Collections</p>
              <p className="font-medium">{exam.collections.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Moderators</p>
              <p className="font-medium">{exam.moderatorsList.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">PIN Protection</p>
              <p className="font-medium">
                {exam.requiresPin ? "Enabled" : "Disabled"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0 overflow-auto pb-2">
        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              Group schedules and PIN values configured for this exam.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {exam.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No groups assigned.
              </p>
            ) : (
              exam.groups.map((groupLink) => (
                <div
                  key={groupLink.id}
                  className="border rounded-md p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{groupLink.group.name}</p>
                    <Badge variant={groupLink.pin ? "default" : "secondary"}>
                      {groupLink.pin ? "PIN Required" : "No PIN"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Start Override</p>
                      <p>{formatDate(groupLink.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">End Override</p>
                      <p>{formatDate(groupLink.endTime)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-muted-foreground">PIN</p>
                      <p className="font-mono">{groupLink.pin || "-"}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Moderators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {exam.moderatorsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No moderators assigned.
                </p>
              ) : (
                exam.moderatorsList.map((moderator) => (
                  <div key={moderator.id} className="border rounded-md p-3">
                    <p className="font-medium">{moderator.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {moderator.email}
                    </p>
                    {moderator.username && (
                      <p className="text-xs text-muted-foreground">
                        @{moderator.username}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strategy & Grading JSON</CardTitle>
              <CardDescription>
                Raw configuration for quick audit of generated rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Strategy Config
                </p>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto">
                  {JSON.stringify(exam.strategyConfig ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Grading Config
                </p>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto">
                  {JSON.stringify(exam.gradingConfig ?? {}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
