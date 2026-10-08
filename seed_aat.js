import 'dotenv/config';
import { db } from './src/db/index.js';
import { exams } from './src/db/schema/exams.js';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const examId = uuidv4();
  console.log('Creating AAT Exam...');
  
  await db.insert(exams).values({
    id: examId,
    title: 'AAT Demo Exam 1',
    description: 'Mock AAT exam for Year I',
    assessmentType: 'aat',
    semester: 'Year I',
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000),
    durationMinutes: 120,
    status: 'ended',
  });
  
  console.log('AAT Exam inserted! ID:', examId);
  process.exit(0);
}

seed().catch(console.error);
