import { cors, json } from './util/cors';
import { postChat } from './routes/chat';
import { postForget } from './routes/forget';
export { UserRoom } from "./do/UserRoom";  // ⬅️ EZ KELL A HIBÁRA

export default {
	async fetch(req: Request, env: any, _ctx: ExecutionContext) {
		try {
			const url = new URL(req.url);
			if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

			if (url.pathname === '/chat' && req.method === 'POST') return postChat(req, env);
			if (url.pathname === '/forget' && req.method === 'POST') return postForget(req, env);

			return cors(json({ ok: true, info: 'coach-chatbot' }));
		} catch (err: any) {
			return cors(json({ error: 'internal_error', message: err?.message || 'Unhandled exception' }, 500));
		}
	},
};
