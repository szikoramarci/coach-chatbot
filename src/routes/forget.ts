export async function postForget(req: Request, env: any) {
	const body = (await req.json().catch(() => ({}))) as { email?: string; fr_uid?: string };
	const key = body.email ? `user:email:${body.email.toLowerCase()}` : body.fr_uid ? `user:uid:${body.fr_uid}` : null;
	if (key) {
		const userObj = (await env.KV.get(key, 'json')) as any;
		if (userObj?.userId) {
			await env.KV.delete(`user:email:${userObj.email}`);
			await env.KV.delete(`user:uid:${userObj.fr_uid}`);
			await env.KV.delete(`mem:${userObj.userId}`);
			await env.DB.prepare(`delete from conversations where user_id = ?1`).bind(userObj.userId).run();
		}
	}
	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'content-type': 'application/json', 'set-cookie': 'fr_uid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' },
	});
}
