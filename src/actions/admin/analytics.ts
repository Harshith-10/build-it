"use server";

import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { platformVisits } from "@/db/schema/analytics";
import { user } from "@/db/schema/auth";
import { userGroupMembers, userGroups } from "@/db/schema/groups";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-access";

export type Timeframe = "today" | "7d" | "30d";

export interface GroupActivityStat {
  groupId: string;
  groupName: string;
  totalMembers: number;
  activeMembers: number;
  participationRate: number;
  totalVisits: number;
  lastActive: string | null;
}

export interface StudentActivityStat {
  id: string;
  name: string;
  username: string | null;
  email: string;
  branch: string | null;
  section: string | null;
  groupNames: string[];
  visitCount: number;
  lastActive: string | null;
}

export interface BranchSectionStat {
  name: string;
  activeStudents: number;
  visitCount: number;
}

export interface TrendDataPoint {
  label: string;
  visits: number;
  uniqueUsers: number;
  timestamp: string;
}

export interface HourlyHeatmapPoint {
  hour: number;
  label: string;
  visits: number;
  intensity: number; // 0 to 100
}

export interface DashboardAnalyticsResponse {
  overview: {
    visitsToday: number;
    visitsYesterday: number;
    visitsTodayChangePct: number;
    uniqueUsersToday: number;
    visitsThisWeek: number;
    visitsThisMonth: number;
    onlineUsersNow: number;
    totalVisitsAllTime: number;
    topGroupName: string | null;
  };
  trends: {
    today: TrendDataPoint[];
    sevenDays: TrendDataPoint[];
    thirtyDays: TrendDataPoint[];
  };
  groups: {
    today: GroupActivityStat[];
    sevenDays: GroupActivityStat[];
    thirtyDays: GroupActivityStat[];
  };
  branches: BranchSectionStat[];
  sections: BranchSectionStat[];
  peakHours: HourlyHeatmapPoint[];
  topStudents: StudentActivityStat[];
}

/**
 * Record a user visit / page view event
 */
export async function recordVisit({
  path,
  userAgent,
}: {
  path: string;
  userAgent?: string;
}) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    const ipAddress =
      reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      reqHeaders.get("x-real-ip") ||
      null;

    await db.insert(platformVisits).values({
      userId: session?.user?.id ?? null,
      path: path.slice(0, 500),
      userAgent: (userAgent || reqHeaders.get("user-agent") || "").slice(0, 500) || null,
      ipAddress,
    });

    return { success: true };
  } catch (error) {
    console.error("Error logging platform visit:", error);
    return { success: false };
  }
}

/**
 * Aggregate comprehensive platform visit & group analytics for admin dashboard
 */
export async function getDashboardAnalytics(): Promise<DashboardAnalyticsResponse> {
  await requireAdmin();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

  // 1. Fetch Overview Metrics
  const [
    visitsTodayRes,
    visitsYesterdayRes,
    uniqueTodayRes,
    visits7dRes,
    visits30dRes,
    onlineNowRes,
    totalVisitsRes,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformVisits)
      .where(gte(platformVisits.createdAt, startOfToday)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformVisits)
      .where(
        and(
          gte(platformVisits.createdAt, startOfYesterday),
          lte(platformVisits.createdAt, startOfToday)
        )
      ),
    db
      .select({ count: sql<number>`count(distinct ${platformVisits.userId})::int` })
      .from(platformVisits)
      .where(
        and(
          gte(platformVisits.createdAt, startOfToday),
          isNotNull(platformVisits.userId)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformVisits)
      .where(gte(platformVisits.createdAt, sevenDaysAgo)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformVisits)
      .where(gte(platformVisits.createdAt, thirtyDaysAgo)),
    db
      .select({ count: sql<number>`count(distinct ${platformVisits.userId})::int` })
      .from(platformVisits)
      .where(
        and(
          gte(platformVisits.createdAt, fifteenMinsAgo),
          isNotNull(platformVisits.userId)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformVisits),
  ]);

  const visitsToday = visitsTodayRes[0]?.count ?? 0;
  const visitsYesterday = visitsYesterdayRes[0]?.count ?? 0;
  const uniqueUsersToday = uniqueTodayRes[0]?.count ?? 0;
  const visitsThisWeek = visits7dRes[0]?.count ?? 0;
  const visitsThisMonth = visits30dRes[0]?.count ?? 0;
  const onlineUsersNow = onlineNowRes[0]?.count ?? 0;
  const totalVisitsAllTime = totalVisitsRes[0]?.count ?? 0;

  const visitsTodayChangePct =
    visitsYesterday === 0
      ? visitsToday > 0
        ? 100
        : 0
      : Math.round(((visitsToday - visitsYesterday) / visitsYesterday) * 100);

  // 2. Trend Time Series - Today (Hourly buckets 00 to 23)
  const hourlyRows = await db
    .select({
      hour: sql<number>`extract(hour from ${platformVisits.createdAt})::int`,
      visits: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${platformVisits.userId})::int`,
    })
    .from(platformVisits)
    .where(gte(platformVisits.createdAt, startOfToday))
    .groupBy(sql`extract(hour from ${platformVisits.createdAt})`);

  const hourlyMap = new Map<number, { visits: number; uniqueUsers: number }>();
  for (const row of hourlyRows) {
    hourlyMap.set(row.hour, { visits: row.visits, uniqueUsers: row.uniqueUsers });
  }

  const todayTrends: TrendDataPoint[] = [];
  const currentHour = now.getHours();
  for (let h = 0; h <= currentHour; h++) {
    const data = hourlyMap.get(h) || { visits: 0, uniqueUsers: 0 };
    const label = `${h.toString().padStart(2, "0")}:00`;
    todayTrends.push({
      label,
      visits: data.visits,
      uniqueUsers: data.uniqueUsers,
      timestamp: new Date(startOfToday.getTime() + h * 3600000).toISOString(),
    });
  }

  // 3. Trend Time Series - 7 Days (Daily buckets)
  const daily7dRows = await db
    .select({
      dateStr: sql<string>`to_char(${platformVisits.createdAt}, 'YYYY-MM-DD')`,
      visits: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${platformVisits.userId})::int`,
    })
    .from(platformVisits)
    .where(gte(platformVisits.createdAt, sevenDaysAgo))
    .groupBy(sql`to_char(${platformVisits.createdAt}, 'YYYY-MM-DD')`);

  const daily7dMap = new Map<string, { visits: number; uniqueUsers: number }>();
  for (const row of daily7dRows) {
    daily7dMap.set(row.dateStr, { visits: row.visits, uniqueUsers: row.uniqueUsers });
  }

  const sevenDaysTrends: TrendDataPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const data = daily7dMap.get(dateStr) || { visits: 0, uniqueUsers: 0 };
    sevenDaysTrends.push({
      label,
      visits: data.visits,
      uniqueUsers: data.uniqueUsers,
      timestamp: d.toISOString(),
    });
  }

  // 4. Trend Time Series - 30 Days (Daily buckets)
  const daily30dRows = await db
    .select({
      dateStr: sql<string>`to_char(${platformVisits.createdAt}, 'YYYY-MM-DD')`,
      visits: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${platformVisits.userId})::int`,
    })
    .from(platformVisits)
    .where(gte(platformVisits.createdAt, thirtyDaysAgo))
    .groupBy(sql`to_char(${platformVisits.createdAt}, 'YYYY-MM-DD')`);

  const daily30dMap = new Map<string, { visits: number; uniqueUsers: number }>();
  for (const row of daily30dRows) {
    daily30dMap.set(row.dateStr, { visits: row.visits, uniqueUsers: row.uniqueUsers });
  }

  const thirtyDaysTrends: TrendDataPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const data = daily30dMap.get(dateStr) || { visits: 0, uniqueUsers: 0 };
    thirtyDaysTrends.push({
      label,
      visits: data.visits,
      uniqueUsers: data.uniqueUsers,
      timestamp: d.toISOString(),
    });
  }

  // 5. Active Groups Analytics
  const allGroups = await db.query.userGroups.findMany({
    with: {
      members: {
        columns: {
          userId: true,
        },
      },
    },
  });

  async function computeGroupStatsForPeriod(sinceDate: Date): Promise<GroupActivityStat[]> {
    const groupStats: GroupActivityStat[] = [];

    // Query active visits for this period
    const periodVisits = await db
      .select({
        userId: platformVisits.userId,
        visitCount: sql<number>`count(*)::int`,
        lastActive: sql<string>`max(${platformVisits.createdAt})`,
      })
      .from(platformVisits)
      .where(
        and(
          gte(platformVisits.createdAt, sinceDate),
          isNotNull(platformVisits.userId)
        )
      )
      .groupBy(platformVisits.userId);

    const userVisitMap = new Map<string, { count: number; lastActive: string }>();
    for (const pv of periodVisits) {
      if (pv.userId) {
        userVisitMap.set(pv.userId, { count: pv.visitCount, lastActive: pv.lastActive });
      }
    }

    for (const g of allGroups) {
      const totalMembers = g.members.length;
      let activeMembers = 0;
      let totalVisits = 0;
      let latestActive: string | null = null;

      for (const m of g.members) {
        const uStat = userVisitMap.get(m.userId);
        if (uStat) {
          activeMembers++;
          totalVisits += uStat.count;
          if (!latestActive || new Date(uStat.lastActive) > new Date(latestActive)) {
            latestActive = uStat.lastActive;
          }
        }
      }

      const participationRate =
        totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

      groupStats.push({
        groupId: g.id,
        groupName: g.name,
        totalMembers,
        activeMembers,
        participationRate,
        totalVisits,
        lastActive: latestActive,
      });
    }

    return groupStats.sort((a, b) => b.totalVisits - a.totalVisits || b.activeMembers - a.activeMembers);
  }

  const [groupsToday, groups7d, groups30d] = await Promise.all([
    computeGroupStatsForPeriod(startOfToday),
    computeGroupStatsForPeriod(sevenDaysAgo),
    computeGroupStatsForPeriod(thirtyDaysAgo),
  ]);

  const topGroupName = groups7d[0]?.totalVisits > 0 ? groups7d[0].groupName : null;

  // 6. Branch & Section Breakdown (Last 30 days)
  const branchRows = await db
    .select({
      branch: user.branch,
      activeStudents: sql<number>`count(distinct ${user.id})::int`,
      visitCount: sql<number>`count(${platformVisits.id})::int`,
    })
    .from(platformVisits)
    .innerJoin(user, eq(platformVisits.userId, user.id))
    .where(
      and(
        gte(platformVisits.createdAt, thirtyDaysAgo),
        isNotNull(user.branch)
      )
    )
    .groupBy(user.branch)
    .orderBy(desc(sql`count(${platformVisits.id})`))
    .limit(8);

  const branches: BranchSectionStat[] = branchRows.map((r) => ({
    name: r.branch || "General",
    activeStudents: r.activeStudents,
    visitCount: r.visitCount,
  }));

  const sectionRows = await db
    .select({
      branch: user.branch,
      section: user.section,
      activeStudents: sql<number>`count(distinct ${user.id})::int`,
      visitCount: sql<number>`count(${platformVisits.id})::int`,
    })
    .from(platformVisits)
    .innerJoin(user, eq(platformVisits.userId, user.id))
    .where(
      and(
        gte(platformVisits.createdAt, thirtyDaysAgo),
        isNotNull(user.section)
      )
    )
    .groupBy(user.branch, user.section)
    .orderBy(desc(sql`count(${platformVisits.id})`))
    .limit(8);

  const sections: BranchSectionStat[] = sectionRows.map((r) => ({
    name: r.branch ? `${r.branch} - ${r.section}` : `Section ${r.section}`,
    activeStudents: r.activeStudents,
    visitCount: r.visitCount,
  }));

  // 7. Peak Hours Heatmap (24 hours distribution across last 30 days)
  const peakHourRows = await db
    .select({
      hour: sql<number>`extract(hour from ${platformVisits.createdAt})::int`,
      visits: sql<number>`count(*)::int`,
    })
    .from(platformVisits)
    .where(gte(platformVisits.createdAt, thirtyDaysAgo))
    .groupBy(sql`extract(hour from ${platformVisits.createdAt})`);

  const peakHourMap = new Map<number, number>();
  let maxHourVisits = 1;
  for (const r of peakHourRows) {
    peakHourMap.set(r.hour, r.visits);
    if (r.visits > maxHourVisits) {
      maxHourVisits = r.visits;
    }
  }

  const peakHours: HourlyHeatmapPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const visits = peakHourMap.get(h) || 0;
    const intensity = Math.round((visits / maxHourVisits) * 100);
    const label = `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
    peakHours.push({
      hour: h,
      label,
      visits,
      intensity,
    });
  }

  // 8. Top Active Students (Last 7 days)
  const topStudentRows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      branch: user.branch,
      section: user.section,
      visitCount: sql<number>`count(${platformVisits.id})::int`,
      lastActive: sql<string>`max(${platformVisits.createdAt})`,
    })
    .from(platformVisits)
    .innerJoin(user, eq(platformVisits.userId, user.id))
    .where(
      and(
        gte(platformVisits.createdAt, sevenDaysAgo),
        eq(user.role, "student")
      )
    )
    .groupBy(user.id, user.name, user.username, user.email, user.branch, user.section)
    .orderBy(desc(sql`count(${platformVisits.id})`))
    .limit(10);

  // Fetch groups for these top students
  const studentIds = topStudentRows.map((s) => s.id);
  const studentGroupsMap = new Map<string, string[]>();

  if (studentIds.length > 0) {
    const memberships = await db
      .select({
        userId: userGroupMembers.userId,
        groupName: userGroups.name,
      })
      .from(userGroupMembers)
      .innerJoin(userGroups, eq(userGroupMembers.groupId, userGroups.id))
      .where(inArray(userGroupMembers.userId, studentIds));

    for (const m of memberships) {
      const existing = studentGroupsMap.get(m.userId) || [];
      existing.push(m.groupName);
      studentGroupsMap.set(m.userId, existing);
    }
  }

  const topStudents: StudentActivityStat[] = topStudentRows.map((s) => ({
    id: s.id,
    name: s.name,
    username: s.username,
    email: s.email,
    branch: s.branch,
    section: s.section,
    groupNames: studentGroupsMap.get(s.id) || [],
    visitCount: s.visitCount,
    lastActive: s.lastActive,
  }));

  return {
    overview: {
      visitsToday,
      visitsYesterday,
      visitsTodayChangePct,
      uniqueUsersToday,
      visitsThisWeek,
      visitsThisMonth,
      onlineUsersNow,
      totalVisitsAllTime,
      topGroupName,
    },
    trends: {
      today: todayTrends,
      sevenDays: sevenDaysTrends,
      thirtyDays: thirtyDaysTrends,
    },
    groups: {
      today: groupsToday,
      sevenDays: groups7d,
      thirtyDays: groups30d,
    },
    branches,
    sections,
    peakHours,
    topStudents,
  };
}
