// Seeds demo data: an admin user, SMS subscribers across counties, and per-county
// thresholds. Idempotent — safe to run repeatedly. Run: node scripts/seed.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool, query } = require('../src/db/pool');

const ADMIN_USER = 'admin';
// The first admin's password comes from ADMIN_INITIAL_PASSWORD in .env. If it is
// not set, we generate a strong random one and print it ONCE so it can be saved.
function generateStrongPassword() {
  // ~22 url-safe chars of entropy — strong and easy to copy from the log.
  return crypto.randomBytes(16).toString('base64url');
}

// A few subscribers per county (phone, county name, language).
const SUBSCRIBERS = [
  ['+211921000001', 'Central Equatoria', 'en'],
  ['+211921000002', 'Central Equatoria', 'ar'],
  ['+211921000003', 'Jonglei', 'en'],
  ['+211921000004', 'Unity', 'en'],
  ['+211921000005', 'Upper Nile', 'en'],
  ['+211921000006', 'Warrap', 'en'],
  ['+211921000007', 'Lakes', 'en'],
  ['+211921000008', 'Eastern Equatoria', 'en'],
  ['+211921000009', 'Western Equatoria', 'en'],
  ['+211921000010', 'Northern Bahr el Ghazal', 'en'],
  ['+211921000011', 'Western Bahr el Ghazal', 'en'],
  ['+211921000012', 'Jonglei', 'en'],
];

async function main() {
  // --- admin ---
  // The primary admin is the single 'superadmin' (RBAC). On first creation we
  // set that role; for an EXISTING admin we never silently change its role.
  const existing = await query('SELECT id, role FROM admin_users WHERE username = $1', [ADMIN_USER]);
  const envPassword = process.env.ADMIN_INITIAL_PASSWORD;
  const promote = process.env.PROMOTE_TO_SUPERADMIN === 'true';

  if (existing.rowCount === 0) {
    // Fresh install: create the primary admin AS superadmin.
    const generated = !envPassword;
    const password = envPassword || generateStrongPassword();
    const hash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO admin_users (username, password_hash, role)
       VALUES ($1, $2, 'superadmin')`,
      [ADMIN_USER, hash]);

    if (generated) {
      console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
      console.log('  │  ADMIN_INITIAL_PASSWORD was not set — a strong password was   │');
      console.log('  │  generated. Save it now; it will NOT be shown again:          │');
      console.log(`  │    username: ${ADMIN_USER}  (role: superadmin)`);
      console.log(`  │    password: ${password}`);
      console.log('  └─────────────────────────────────────────────────────────────┘\n');
    } else {
      console.log(`admin user ready: ${ADMIN_USER} (superadmin, password from ADMIN_INITIAL_PASSWORD)`);
    }
  } else {
    const current = existing.rows[0];

    // Password: only touched if explicitly provided via env.
    if (envPassword) {
      const hash = await bcrypt.hash(envPassword, 10);
      await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, current.id]);
      console.log(`admin user "${ADMIN_USER}" password updated from ADMIN_INITIAL_PASSWORD.`);
    } else {
      console.log(`admin user "${ADMIN_USER}" already exists — password left unchanged.`);
    }

    // Role: never changed silently. Promote only on an explicit opt-in flag.
    if (current.role === 'superadmin') {
      console.log(`admin user "${ADMIN_USER}" is already a superadmin.`);
    } else if (promote) {
      await query(`UPDATE admin_users SET role = 'superadmin' WHERE id = $1`, [current.id]);
      console.log(`admin user "${ADMIN_USER}" promoted to superadmin.`);
    } else {
      console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
      console.log(`  │  NOTE: "${ADMIN_USER}" has role '${current.role}', not 'superadmin'.`);
      console.log('  │  RBAC admin-management requires a superadmin. To promote it:   │');
      console.log('  │    • re-run:  PROMOTE_TO_SUPERADMIN=true node scripts/seed.js  │');
      console.log("  │    • or SQL:  UPDATE admin_users SET role='superadmin'         │");
      console.log(`  │               WHERE username='${ADMIN_USER}';`);
      console.log('  │  (then log out and back in so the new role is in your token)   │');
      console.log('  └─────────────────────────────────────────────────────────────┘\n');
    }
  }

  // --- county id lookup ---
  const { rows: counties } = await query('SELECT id, name FROM counties');
  const idByName = Object.fromEntries(counties.map((c) => [c.name, c.id]));

  // --- subscribers ---
  let added = 0;
  for (const [phone, county, lang] of SUBSCRIBERS) {
    const cid = idByName[county];
    if (!cid) continue;
    const r = await query(
      `INSERT INTO users (phone_number, county_id, language_preference)
       VALUES ($1, $2, $3) ON CONFLICT (phone_number) DO NOTHING`,
      [phone, cid, lang]);
    added += r.rowCount;
  }
  console.log(`subscribers: ${added} inserted (${SUBSCRIBERS.length} total)`);

  // --- thresholds per county (danger 5%, severe 10%) ---
  let thr = 0;
  for (const c of counties) {
    const existing = await query('SELECT 1 FROM thresholds WHERE county_id = $1', [c.id]);
    if (existing.rowCount === 0) {
      await query(
        `INSERT INTO thresholds (county_id, danger_level, severe_level)
         VALUES ($1, 5.0, 10.0)`, [c.id]);
      thr += 1;
    }
  }
  console.log(`thresholds: ${thr} counties configured`);

  await pool.end();
  console.log('seed complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
