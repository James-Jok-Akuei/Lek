// Seeds demo data: an admin user, SMS subscribers across counties, and per-county
// thresholds. Idempotent — safe to run repeatedly. Run: node scripts/seed.js
const bcrypt = require('bcrypt');
const { pool, query } = require('../src/db/pool');

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123'; // demo only — change in production

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
  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  await query(
    `INSERT INTO admin_users (username, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [ADMIN_USER, hash]);
  console.log(`admin user ready: ${ADMIN_USER} / ${ADMIN_PASS}`);

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
