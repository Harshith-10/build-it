import { db } from "../src/db";
import { labs, user, userGroups, userGroupMembers } from "../src/db/schema";
import { ilike } from "drizzle-orm";

async function info() {
  const oopLabs = await db.query.labs.findMany({ where: ilike(labs.name, '%OOP%') });
  console.log("OOP Labs:", oopLabs.map(l => ({ id: l.id, name: l.name })));

  const firstLab = oopLabs[0] || (await db.query.labs.findFirst());
  console.log("Using Lab:", firstLab?.name, firstLab?.id);

  const groups = await db.query.userGroups.findMany();
  console.log("Groups:", groups.map(g => ({ id: g.id, name: g.name })));

  const firstGroup = groups[0];
  console.log("Using Group:", firstGroup?.name);

  if (firstGroup) {
    const members = await db.query.userGroupMembers.findMany({
      where: (m, { eq }) => eq(m.groupId, firstGroup.id),
      with: { user: true }
    });
    console.log("Students in Group:");
    members.slice(0, 3).forEach(m => console.log(m.user?.username, m.user?.name));
  }
  process.exit(0);
}
info().catch(console.error);
