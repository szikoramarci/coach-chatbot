const CRISIS = ['öngyilkos', 'öngyilkosság', 'suicide', 'kill myself', 'self harm', 'bántom magam'];
export function isCrisis(t: string) {
	const s = t.toLowerCase();
	return CRISIS.some((k) => s.includes(k));
}
export function crisisMsg() {
	return 'Sajnálom, hogy ilyen nehéz. Ha életveszély vagy sürgős krízis áll fenn, hívd a 112-t, vagy keresd a legközelebbi sürgősségi ellátást. Ha szeretnéd, tudunk időpontot adni beszélgetésre.';
}
export function crisisButtons() {
	return ['112 hívása', 'Közeli sürgősségi', 'Időpontfoglalás'];
}
