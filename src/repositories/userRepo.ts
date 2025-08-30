import { prep } from './db';

export async function findUserByEmail(env: any, email: string) {
  const row = await env.DB.prepare(`SELECT * FROM users WHERE email = ?1`).bind(email).first()
  return row || null
}
export async function findUserByFrUid(env: any, frUid: string) {
  const row = await env.DB.prepare(`SELECT * FROM users WHERE fr_uid = ?1`).bind(frUid).first()
  return row || null
}

export async function upsertUser(env: any, user: { id: string; email?: string | null; frUid?: string | null; consent?: number }) {
	await env.DB.batch([

		prep(
			env,
			`INSERT OR IGNORE INTO users (id, email, fr_uid, consent, last_seen_at)
            VALUES (?1, ?2, ?3, COALESCE(?4,0), strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
		).bind(user.id, user.email || null, user.frUid || null, user.consent ?? 0),

		prep(
			env,
			`UPDATE users SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), consent = COALESCE(?2, consent)
            WHERE id = ?1`
		).bind(user.id, user.consent ?? null),
        
		prep(
			env,
			`INSERT OR IGNORE INTO profiles (user_id, stage, preferences, notes, last_topics)
            VALUES (?1, 'erdeklodo', '{}', NULL, '[]')`
		).bind(user.id),
	]);
}
