type Env = { DB: D1Database };

export async function exec(env: Env, sql: string) {
	return env.DB.exec(sql);
}
export function prep(env: Env, sql: string) {
	return env.DB.prepare(sql);
}

export async function tx(env: Env, f: () => Promise<void>) {
	await exec(env, 'BEGIN');
	try {
		await f();
		await exec(env, 'COMMIT');
	} catch (e) {
		await exec(env, 'ROLLBACK');
		throw e;
	}
}
