// Sheen backend: holds the Zendesk credentials and serves UI-shaped data to the browser.
// v0.1 authenticates with a single API token from .env; per-agent OAuth comes later (see SPEC.md).

import { createServer } from 'node:http'
import type { Comment, Field, Person, StatusCategory, Ticket } from '../src/types.ts'

const { ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN } = process.env
if (!ZENDESK_SUBDOMAIN || !ZENDESK_EMAIL || !ZENDESK_API_TOKEN) {
  throw new Error('Missing ZENDESK_SUBDOMAIN, ZENDESK_EMAIL or ZENDESK_API_TOKEN in .env')
}

const PORT = Number(process.env.PORT ?? 8787)
const ZENDESK = `https://${ZENDESK_SUBDOMAIN}.zendesk.com`
const AUTH = 'Basic ' + Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString('base64')

class ZendeskError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function zendesk(path: string): Promise<any> {
  const url = path.startsWith('http') ? path : `${ZENDESK}/api/v2${path}`
  const res = await fetch(url, { headers: { Authorization: AUTH, Accept: 'application/json' } })
  if (!res.ok) throw new ZendeskError(res.status, `Zendesk ${res.status} on ${new URL(url).pathname}`)
  return res.json()
}

// Follows Zendesk cursor pagination and concatenates `key` plus any sideloaded users.
async function zendeskAll(path: string, key: string): Promise<{ items: any[]; users: any[] }> {
  const items: any[] = []
  const users: any[] = []
  let next: string | null = path
  while (next) {
    const page: any = await zendesk(next)
    items.push(...page[key])
    users.push(...(page.users ?? []))
    next = page.meta?.has_more ? page.links.next : null
  }
  return { items, users }
}

// Account configuration (field definitions, custom statuses) changes rarely. Load it at startup and
// refresh in the background, so a ticket load only waits on the ticket itself.
function cachedById(load: () => Promise<any[]>, ttl = 10 * 60_000) {
  let value: Promise<Map<number, any>> | null = null
  let at = 0
  let refreshing = false
  return () => {
    if (value && (refreshing || Date.now() - at < ttl)) return value
    refreshing = true
    const next = load().then((items) => new Map(items.map((item) => [item.id, item])))
    next.then(
      () => ((value = next), (at = Date.now())),
      (err) => {
        console.error('Cache refresh failed:', err)
        if (value === next) value = null // First load failed: retry on the next request.
      },
    ).finally(() => (refreshing = false))
    // Serve the previous value while refreshing; wait only when there is none yet.
    return (value ??= next)
  }
}

const ticketFields = cachedById(async () => (await zendeskAll('/ticket_fields.json?page[size]=100', 'ticket_fields')).items)
const customStatuses = cachedById(async () => (await zendesk('/custom_statuses.json')).custom_statuses)

function person(user: any): Person | null {
  if (!user) return null
  return { id: user.id, name: user.name, email: user.email ?? null, photoUrl: user.photo?.content_url ?? null }
}

function fieldValue(def: any, value: unknown): string | null {
  if (value === null || value === undefined || value === '' || value === false) return null
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.map((v) => optionName(def, v)).join(', ')
  }
  if (value === true) return 'Yes'
  return optionName(def, value)
}

function optionName(def: any, value: unknown): string {
  const option = def.custom_field_options?.find((o: any) => o.value === value)
  return option?.name ?? String(value)
}

async function getTicket(id: number): Promise<Ticket> {
  const [ticketRes, comments, defs, statuses] = await Promise.all([
    zendesk(`/tickets/${id}.json?include=users,groups,organizations`),
    zendeskAll(`/tickets/${id}/comments.json?include=users&page[size]=100`, 'comments'),
    ticketFields(),
    customStatuses(),
  ])
  const t = ticketRes.ticket
  const status = statuses.get(t.custom_status_id)

  const users = new Map<number, any>([...ticketRes.users, ...comments.users].map((u: any) => [u.id, u]))
  const group = ticketRes.groups?.find((g: any) => g.id === t.group_id)
  const organization = ticketRes.organizations?.find((o: any) => o.id === t.organization_id)

  const fields: Field[] = []
  for (const { id: fieldId, value } of t.custom_fields) {
    const def = defs.get(fieldId)
    if (!def?.active) continue
    const shown = fieldValue(def, value)
    if (shown) fields.push({ title: def.title_in_portal || def.title, value: shown })
  }

  return {
    id: t.id,
    url: `${ZENDESK}/agent/tickets/${t.id}`,
    subject: t.subject ?? t.raw_subject ?? '(no subject)',
    status: {
      category: (status?.status_category ?? t.status) as StatusCategory,
      label: status?.agent_label ?? t.status,
    },
    priority: t.priority,
    type: t.type,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    requester: person(users.get(t.requester_id)),
    assignee: person(users.get(t.assignee_id)),
    group: group?.name ?? null,
    organization: organization?.name ?? null,
    tags: t.tags,
    fields,
    comments: comments.items.map(
      (c): Comment => ({
        id: c.id,
        public: c.public,
        author: person(users.get(c.author_id)),
        createdAt: c.created_at,
        html: c.html_body,
        attachments: c.attachments.map((a: any) => ({
          id: a.id,
          fileName: a.file_name,
          url: a.content_url,
          size: a.size,
          contentType: a.content_type,
        })),
      }),
    ),
  }
}

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const match = req.method === 'GET' && req.url?.match(/^\/api\/tickets\/(\d+)$/)
  if (!match) return send(404, { error: 'Not found' })
  try {
    send(200, await getTicket(Number(match[1])))
  } catch (err) {
    const status = err instanceof ZendeskError ? err.status : 500
    console.error(err)
    send(status, { error: status === 404 ? 'Ticket not found' : (err as Error).message })
  }
}).listen(PORT, () => {
  console.log(`Sheen backend on http://localhost:${PORT}`)
  // Warm the caches so the first ticket load is as fast as the rest.
  Promise.allSettled([ticketFields(), customStatuses()])
})
