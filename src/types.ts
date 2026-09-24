// View model returned by the Sheen backend. Shaped for the UI, not a mirror of the Zendesk API.

export type StatusCategory = 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed'

export interface Person {
  id: number
  name: string
  email: string | null
  photoUrl: string | null
}

export interface Attachment {
  id: number
  fileName: string
  url: string
  size: number
  contentType: string
}

export interface Comment {
  id: number
  public: boolean
  author: Person | null
  createdAt: string
  html: string
  attachments: Attachment[]
}

export interface Field {
  title: string
  value: string
}

export interface Ticket {
  id: number
  url: string
  subject: string
  status: { category: StatusCategory; label: string }
  priority: string | null
  type: string | null
  createdAt: string
  updatedAt: string
  requester: Person | null
  assignee: Person | null
  group: string | null
  organization: string | null
  tags: string[]
  fields: Field[]
  comments: Comment[]
}

// What the composer sends. An empty body only changes the status.
export interface Answer {
  body: string
  public: boolean
  status: 'open' | 'pending' | 'hold' | 'solved'
  // The ticket's updatedAt when the agent loaded it, so Zendesk rejects the answer if the ticket changed since.
  updatedAt: string
}
