import { prep } from './db'

// Teljes előzmény (FULL HISTORY) összefűzése
export async function getAllMessagesByUser(env: any, userId: string): Promise<PromptMessage[]> {
  const rows = await env.DB.prepare(
    `select messages from conversations where user_id = ?1 order by started_at asc`
  ).bind(userId).all()

  return rows.results.flatMap((r: any) => JSON.parse(r.messages)) as PromptMessage[]
}

// Új forduló (user+assistant) beszúrása
export async function insertTurn(env: any, p: { userId: string; userText: string; assistantText: string }) {
  const id = crypto.randomUUID()
  const messages: PromptMessage[] = [
    { role: 'user', content: p.userText },
    { role: 'assistant', content: p.assistantText }
  ]
  const summary = p.assistantText.length > 220 ? p.assistantText.slice(0, 200) + '…' : p.assistantText

  await prep(env, `insert into conversations (id, user_id, messages, summary) values (?1, ?2, ?3, ?4)`)
    .bind(id, p.userId, JSON.stringify(messages), summary)
    .run()
}