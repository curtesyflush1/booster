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
import { EmailPreferencesService } from '../src/services/emailPreferencesService';
import { EmailDeliveryService } from '../src/services/emailDeliveryService';

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
  return out as { email?: string };
}

(async () => {
  try {
    const { email } = parseArgs();

    if (email) {
      const user = await User.findByEmail(email);
      if (!user) {
        console.error(`No user found for ${email}`);
        process.exit(1);
      }
      const stats = await EmailDeliveryService.getUserDeliveryStats(user.id);
      console.log(`Deliverability report for ${email} (userId=${user.id}):`);
      console.log(`- Total sent: ${stats.totalSent}`);
      console.log(`- Delivered: ${stats.totalDelivered}`);
      console.log(`- Bounced: ${stats.totalBounced}`);
      console.log(`- Complaints: ${stats.totalComplained}`);
      console.log(`- Delivery rate: ${stats.deliveryRate.toFixed(2)}%`);
      console.log(`- Last email sent: ${stats.lastEmailSent || 'n/a'}`);
      process.exit(0);
    }

    const overall = await EmailPreferencesService.getDeliveryStats();
    console.log('Overall deliverability report:');
    console.log(`- Total sent: ${overall.totalSent}`);
    console.log(`- Delivered: ${overall.totalDelivered}`);
    console.log(`- Bounced: ${overall.totalBounced}`);
    console.log(`- Complaints: ${overall.totalComplained}`);
    console.log(`- Delivery rate: ${overall.deliveryRate.toFixed(2)}%`);
    console.log(`- Bounce rate: ${overall.bounceRate.toFixed(2)}%`);
    console.log(`- Complaint rate: ${overall.complaintRate.toFixed(2)}%`);
    console.log('\nUse --email user@example.com for per-user details.');
    process.exit(0);
  } catch (e: any) {
    console.error('Error:', e?.message || e);
    process.exit(1);
  }
})();

