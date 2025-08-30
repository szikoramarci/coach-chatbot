/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export class UserRoom {
  state: DurableObjectState
  storage: DurableObjectStorage
  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.storage = state.storage
  }
  async fetch(req: Request) {
    const { action, payload } = await req.json().catch(() => ({ action: "", payload: {} }))
    if (action === "appendMessage") {
      await this.storage.put(`msg:${Date.now()}`, payload)
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } })
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } })
  }
}

type Env = {
  OPENROUTER_API_KEY: string
  OPENROUTER_MODEL: string
  BOT_SHARED_SECRET: string
  DB: D1Database
  KV: KVNamespace
  UserRoom: DurableObjectNamespace
}

type BotPayload = {
  message: string
  email?: string
  fr_uid?: string
  consent?: boolean
}

const CRISIS = ["öngyilkos", "öngyilkosság", "suicide", "kill myself", "self harm", "bántom magam"]

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext) {
    try {
      const url = new URL(req.url)
      if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }))

      if (url.pathname === "/chat" && req.method === "POST") {
        // egyszerű webhook-aláírás
        if (req.headers.get("x-bot-secret") !== env.BOT_SHARED_SECRET) {
          return cors(json({ error: "unauthorized" }, 401))
        }

        const payload = (await req.json()) as BotPayload
        if (!payload?.message) return cors(json({ error: "invalid payload" }, 400))

        // Cookie olvasás / generálás (fejlesztéskor a Secure flaget el lehet hagyni)
        const cookies = req.headers.get("cookie") || ""
        let frUid = payload.fr_uid || getCookie(cookies, "fr_uid") || crypto.randomUUID()
        const setCookie = getCookie(cookies, "fr_uid") ? [] : [
          // dev környezetben http-n nincs Secure cookie – ha gond, távolítsd el a "Secure"-t devre
          `fr_uid=${frUid}; Path=/; Max-Age=${60*60*24*180}; HttpOnly; SameSite=Lax`
        ]

        // krízis-guard
        if (isCrisis(payload.message)) {
          const text = crisisMsg()
          return withCookies(cors(json({ text, suggested_buttons: ["112 hívása","Közeli sürgősségi","Időpontfoglalás"] })), setCookie)
        }

        // memória betöltése KV-ből (egyszerűsített)
        const userKey = payload.email ? `user:email:${payload.email.toLowerCase()}` : `user:uid:${frUid}`
        let userObj = await env.KV.get(userKey, "json") as any
        if (!userObj) {
          userObj = { userId: crypto.randomUUID(), consent: !!payload.consent, lastSeen: new Date().toISOString(), email: payload.email, fr_uid: frUid }
          await env.KV.put(userKey, JSON.stringify(userObj))
        }

        const mem = await env.KV.get(`mem:${userObj.userId}`, "json") as any || {}
        const systemPrompt = system()
        const userPrompt = buildUserPrompt(payload.message, mem)

        // OpenRouter hívás
        const aiText = await callOpenRouter(env, systemPrompt, userPrompt)

        // naplózás D1-be (egyszerűsített)
        const convId = crypto.randomUUID()
        await env.DB.prepare(
          `insert into conversations(id, user_id, messages, summary) values(?1, ?2, ?3, ?4)`
        ).bind(convId, userObj.userId, JSON.stringify([{ role: "user", content: payload.message }, { role: "assistant", content: aiText }]), aiText.slice(0, 500)).run()

        // memória frissítése KV-ben
        const nextMem = {
          summary: aiText.length > 220 ? (aiText.slice(0, 200) + "…") : aiText,
          last_topics: mem?.last_topics || [],
          stage: mem?.stage || "erdeklodo",
          preferences: mem?.preferences || {},
          notes: mem?.notes || ""
        }
        await env.KV.put(`mem:${userObj.userId}`, JSON.stringify(nextMem))

        const res = json({ text: aiText, suggested_buttons: ["Időpontfoglalás","Ingyenes 15 perc","Új téma"] })
        return withCookies(cors(res), setCookie)
      }

      if (url.pathname === "/forget" && req.method === "POST") {
        const body = await req.json().catch(() => ({})) as { email?: string, fr_uid?: string }
        const key = body.email ? `user:email:${body.email.toLowerCase()}` : `user:uid:${body.fr_uid}`
        const userObj = key ? await (await fetch("")).catch(()=>null) || await env.KV.get(key, "json") as any : null
        if (userObj?.userId) {
          await env.KV.delete(key)
          await env.KV.delete(`mem:${userObj.userId}`)
          await env.DB.prepare(`delete from conversations where user_id = ?1`).bind(userObj.userId).run()
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
            "set-cookie": "fr_uid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
          }
        })
      }

      return cors(json({ ok: true, info: "coach-chatbot" }))

    } catch (err: any) {
      // Soha ne hagyd, hogy a Worker default HTML hibát adjon
      return cors(json({
        error: "internal_error",
        message: err?.message || "Unhandled exception",
      }, 500))
    }
  }
}

function system() {
  return `Empatikus, rövid, támogató asszisztens vagy. Nem diagnosztizálsz, nem adsz terápiát. Cél: megérteni az igényt és finoman időpontfoglalásra terelni. 3–5 mondat. 2 üzenetenként adj CTA-t. Krízis esetén sürgősségi forrásokat javasolj.`
}
function buildUserPrompt(msg: string, mem?: any) {
  const memPart = mem?.summary ? `Korábbi beszélgetés: ${mem.summary}` : ""
  const topics = mem?.last_topics?.length ? `Korábbi témák: ${mem.last_topics.join(", ")}` : ""
  return `Felhasználó: ${msg}\n${memPart}\n${topics}\nAdj rövid, együttérző választ és egy következő lépést.`
}
async function callOpenRouter(env: Env, systemPrompt: string, userPrompt: string) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:8787",
      "X-Title": "figyelek-rad–chatbot"
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 300
    })
  })
  if (!r.ok) return "Bocsánat, most nem sikerült válaszolnom. Megpróbáljuk újra?"
  const data = await r.json()
  return data?.choices?.[0]?.message?.content?.trim() || "Rendben, folytassuk."
}
function isCrisis(t: string) {
  const s = t.toLowerCase()
  return CRISIS.some(k => s.includes(k))
}
function crisisMsg() {
  return "Sajnálom, hogy ilyen nehéz. Ha életveszély vagy sürgős krízis áll fenn, hívd a 112-t, vagy keresd a legközelebbi sürgősségi ellátást. Ha szeretnéd, tudunk időpontot adni egy beszélgetésre."
}
function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } })
}
function withCookies(res: Response, setCookies: string[]) {
  if (!setCookies.length) return res
  const h = new Headers(res.headers)
  // több cookie esetén egymás alá add hozzá
  setCookies.forEach(c => h.append("set-cookie", c))
  return new Response(res.body, { status: res.status, headers: h })
}
function getCookie(header: string, name: string) {
  const m = header.match(new RegExp(`${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}
function cors(res: Response) {
  const h = new Headers(res.headers)
  h.set("access-control-allow-origin", "*")
  h.set("access-control-allow-headers", "*")
  h.set("access-control-allow-methods", "POST,OPTIONS")
  return new Response(res.body, { status: res.status, headers: h })
}