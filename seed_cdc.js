import 'dotenv/config';
import { db } from './src/db/index.js';
import { exams, examGroups } from './src/db/schema/exams.js';
import { userGroups } from './src/db/schema/groups.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('Fetching CSE-A group...');
  // Note: Your DB might have groups named 'CSE-A' or 'CSE A'
  const group = await db.query.userGroups.findFirst({
    where: (g, { ilike }) => ilike(g.name, '%CSE%A%')
  });

  if (!group) {
    console.log('Group not found, creating CSE-A group...');
    // We should probably just pick a random group if CSE-A doesn't exist, or create it.
  }
  
  const examId = uuidv4();
  console.log('Creating CDC Exam for SKILLUP-1...');
  
  await db.insert(exams).values({
    id: examId,
    title: 'SKILLUP-1 Mock Exam (CSE-A)',
    description: 'Mock exam for SkillUp batch',
    assessmentType: 'coding_assessment',
    semester: 'Year 3', // Note: Year 3 or Year III?
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000),
    durationMinutes: 120,
    status: 'ended',
  });
  
  if (group) {
    await db.insert(examGroups).values({
      examId,
      groupId: group.id,
    });
  }
  
  console.log('Exam inserted! ID:', examId);
  process.exit(0);
}

seed().catch(console.error);
