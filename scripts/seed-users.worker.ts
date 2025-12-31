import { parentPort, workerData } from "node:worker_threads";
import { db } from "../src/db/index.ts";
import { userGroupMembers } from "../src/db/schema/groups.ts";
import { auth } from "../src/lib/auth.ts";

// We need to define the type here since we can't easily import it from the script without circular deps or sharing complex types
interface UserRecord {
  Sno: string;
  RollNo: string;
  Branch: string;
  FullName: string;
  Section: string;
  Gender: string;
  "D.O.B": string;
  Regulation: string;
  UserGroup: string;
}

interface WorkerData {
  records: UserRecord[];
  groupCache: Map<string, string>; // Group Name -> Group ID
}

const { records, groupCache } = workerData as WorkerData;

async function processUsers() {
  let processed = 0;
  const errors: { email: string; error: any }[] = [];

  for (const record of records) {
    try {
      const rollNo = record.RollNo;
      const dobStr = record["D.O.B"];
      const [day, month, year] = dobStr.split("-");
      const password = `${day}${month}${year}`; // ddMMyyyy
      const dobDate = new Date(`${year}-${month}-${day}`);
      const email = `${rollNo}@iare.ac.in`.toLowerCase();
      const role = "student";

      let userId: string | undefined;

      try {
        const res = await auth.api.signUpEmail({
          body: {
            name: record.FullName,
            email: email,
            password: password,
            role: role,
            username: rollNo,
            displayUsername: record.FullName.split(" ")[0],
            branch: record.Branch,
            section: record.Section,
            gender:
              record.Gender === "M"
                ? "male"
                : record.Gender === "F"
                  ? "female"
                  : "other",
            dob: dobDate,
            regulation: record.Regulation,
            semester: "6",
          },
        });
        userId = res?.user?.id;
      } catch (error: any) {
        if (error?.body?.message?.includes("already exists")) {
          // If user exists, fetch ID from DB
          const existingUser = await db.query.user.findFirst({
            where: (users, { eq }) => eq(users.email, email),
          });
          userId = existingUser?.id;
        } else {
          throw error;
        }
      }

      if (userId && record.UserGroup && groupCache.has(record.UserGroup)) {
        const groupId = groupCache.get(record.UserGroup)!;
        const isMember = await db.query.userGroupMembers.findFirst({
          where: (members, { and, eq }) =>
            and(eq(members.userId, userId!), eq(members.groupId, groupId)),
        });

        if (!isMember) {
          await db.insert(userGroupMembers).values({
            userId,
            groupId,
          });
        }
      }
    } catch (err: any) {
      errors.push({
        email: `${record.RollNo}@iare.ac.in`,
        error: err?.message || err,
      });
    } finally {
      processed++;
      if (parentPort) {
        parentPort.postMessage({ type: "progress", value: 1 });
      }
    }
  }

  if (parentPort) {
    parentPort.postMessage({ type: "done", errors });
  }
}

processUsers().catch((err) => {
  if (parentPort) {
    parentPort.postMessage({ type: "fatal", error: err });
  }
  process.exit(1);
});
