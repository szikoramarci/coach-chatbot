export class UserRoom {
	state: DurableObjectState;
	storage: DurableObjectStorage;
	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.storage = state.storage;
	}
	async fetch(req: Request) {
		try {
			const { action, payload } = await req.json().catch(() => ({ action: '', payload: {} }));
			if (action === 'appendMessage') {
				await this.storage.put(`msg:${Date.now()}`, payload);
				return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
			}
			return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
		} catch (e: any) {
			return new Response(JSON.stringify({ error: 'do_error', message: e?.message || 'unknown' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}
	}
}
