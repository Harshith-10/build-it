import 'dotenv/config';
import { db } from './src/db/index.js';
import { exams } from './src/db/schema/exams.js';
import { eq } from 'drizzle-orm';

async function update() {
  await db.update(exams)
    .set({ semester: 'Year III' })
    .where(eq(exams.id, 'bfa27d01-d16f-4a28-9309-d70e0ae3b16c'));
  console.log('Updated to Year III');
  process.exit(0);
}

update().catch(console.error);
