import { json, cors, withCookies } from '../util/cors';
import { getCookie, makeFrUidCookie } from '../util/cookies';
import { isCrisis, crisisMsg, crisisButtons } from '../util/crisis';
import { findUserByEmail, findUserByFrUid, upsertUser } from '../repositories/userRepo';
import { getAllMessagesByUser, insertTurn } from '../repositories/conversationRepo';
import { callOpenRouter } from '../services/openrouter';

export async function postChat(req: Request, env: any) {
	if (req.headers.get('x-bot-secret') !== env.BOT_SHARED_SECRET) return cors(json({ error: 'unauthorized' }, 401));
	const url = new URL(req.url);
	const debug = url.searchParams.get('debug') === '1';
	const body = (await req.json().catch(() => ({}))) as { message?: string; email?: string; fr_uid?: string; consent?: boolean };
	if (!body?.message) return cors(json({ error: 'invalid_payload' }, 400));

	const cookies = req.headers.get('cookie') || '';
	let frUid = body.fr_uid || getCookie(cookies, 'fr_uid') || crypto.randomUUID();
	const setCookies: string[] = getCookie(cookies, 'fr_uid') ? [] : [makeFrUidCookie(frUid, false)];

	if (isCrisis(body.message)) {
		return withCookies(cors(json({ text: crisisMsg(), suggested_buttons: crisisButtons() })), setCookies);
	}

	let userObj = null;
	if (body.email) userObj = await findUserByEmail(env, body.email.toLowerCase())
  	if (!userObj && frUid) userObj = await findUserByFrUid(env, frUid)
		console.log('User identified:', userObj);

	const userId = userObj?.id || crypto.randomUUID()
	await upsertUser(env, {
		id: userId,
		email: body.email?.toLowerCase() || userObj?.email || null,
		frUid: frUid,
		consent: body.consent ? 1 : (userObj?.consent ?? 0)
	})

	const oldMessages = await getAllMessagesByUser(env, userId)
	const systemPrompt = `Empatikus, rövid, támogató asszisztens vagy. Nem diagnosztizálsz, nem adsz terápiát. Cél: megérteni az igényt és finoman időpontfoglalásra terelni. 3–5 mondat. 2 üzenetenként CTA. Krízis esetén sürgősségi.`;
	const userMessage = body.message.trim();
	const promptMessages = [
		{ role: "system", content: systemPrompt },
		...oldMessages,
		{ role: "user", content: userMessage },
	]	
	const ai = await callOpenRouter(env, promptMessages);
	if (!ai.ok) return withCookies(cors(json({ error: 'llm_error', status: ai.status, reason: ai.reason }, 502)), setCookies);

	await insertTurn(env, { userId, userText: userMessage, assistantText: ai.text })

	return withCookies(cors(json({ text: ai.text, suggested_buttons: ['Időpontfoglalás', 'Ingyenes 15 perc', 'Új téma'] })), setCookies);
}
