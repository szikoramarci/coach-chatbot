export function getCookie(header: string, name: string) {
	const m = header?.match(new RegExp(`${name}=([^;]+)`));
	return m ? decodeURIComponent(m[1]) : null;
}
export function makeFrUidCookie(frUid: string, prod = false) {
	const base = `fr_uid=${frUid}; Path=/; Max-Age=${60 * 60 * 24 * 180}; HttpOnly; SameSite=Lax`;
	return prod ? base + '; Secure' : base;
}
