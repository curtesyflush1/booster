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
import { DefaultRoleConfigurations, SystemRoles } from '../src/types/permissions';

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
  return out as { email?: string; role?: string };
}

(async () => {
  try {
    const { email, role } = parseArgs();
    if (!email) {
      console.error('Usage: npm run admin:make-admin -- --email "user@example.com" [--role admin|super_admin]');
      process.exit(1);
    }

    const targetRole = (role === 'super_admin' ? SystemRoles.SUPER_ADMIN : SystemRoles.ADMIN) as typeof SystemRoles[keyof typeof SystemRoles];
    const defaultPermissions = DefaultRoleConfigurations[targetRole].map(p => p.toString());

    const user = await User.findByEmail(email);
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const updated = await User.updateById(user.id, {
      role: targetRole,
      // Store as JSON string to ensure proper jsonb assignment
      admin_permissions: JSON.stringify(defaultPermissions)
    } as any);

    if (!updated) {
      console.error('Failed to update user role/permissions');
      process.exit(1);
    }

    console.log(`Updated ${email} to role=${targetRole} with ${defaultPermissions.length} permissions`);
    process.exit(0);
  } catch (e: any) {
    console.error('Error:', e?.message || e);
    process.exit(1);
  }
})();
