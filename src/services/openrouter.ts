function asciiHeaderValue(s: string) {
	return s.replace(/[-￿]/g, '');
}

export async function callOpenRouter(env: any, promptMessages: PromptMessage[], model?: string) {
	const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://localhost.test',
			'X-Title': asciiHeaderValue('Figyelek rad – Chatbot'),
		},
		body: JSON.stringify({
			model: model || env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
			messages: promptMessages,
			temperature: 0.6,
			max_tokens: 300,
		}),
	});

	const ct = resp.headers.get('content-type') || '';
	const raw = ct.includes('application/json') ? await resp.json() : { _raw: await resp.text() };
	if (!resp.ok) return { ok: false as const, status: resp.status, reason: raw?.error || raw?._raw?.slice(0, 2000) || 'llm_error' };
	const text = raw?.choices?.[0]?.message?.content?.trim();
	if (!text) return { ok: false as const, status: 502, reason: 'empty_completion' };
	return { ok: true as const, text };
}
