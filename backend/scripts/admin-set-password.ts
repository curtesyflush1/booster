#!/usr/bin/env ts-node
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env from backend/.env then project root .env
const candidates = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '..', '.env')
];
for (const p of candidates) {
  if (fs.existsSync(p)) { dotenv.config({ path: p }); break; }
}

import { User } from '../src/models/User';

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i+1] && !args[i+1].startsWith('--') ? args[++i] : 'true';
      out[key] = val;
    }
  }
  return out as { email?: string; password?: string };
}

(async () => {
  try {
    const { email, password } = parseArgs();
    if (!email || !password) {
      console.error('Usage: npm run admin:set-password -- --email "user@example.com" --password "NewStrongPassword123"');
      process.exit(1);
    }

    const user = await User.findByEmail(email);
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const ok = await User.updatePassword(user.id, password);
    if (!ok) {
      console.error('Failed to update password');
      process.exit(1);
    }

    console.log(`Password updated for ${email}`);
    process.exit(0);
  } catch (e: any) {
    console.error('Error:', e?.message || e);
    process.exit(1);
  }
})();

