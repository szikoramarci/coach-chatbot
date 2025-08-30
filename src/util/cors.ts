export function json(data: any, status = 200) {
	return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
export function cors(res: Response) {
	const h = new Headers(res.headers);
	h.set('access-control-allow-origin', '*');
	h.set('access-control-allow-headers', '*');
	h.set('access-control-allow-methods', 'POST,OPTIONS');
	return new Response(res.body, { status: res.status, headers: h });
}
export function withCookies(res: Response, setCookies: string[]) {
	if (!setCookies.length) return res;
	const h = new Headers(res.headers);
	setCookies.forEach((c) => h.append('set-cookie', c));
	return new Response(res.body, { status: res.status, headers: h });
}
