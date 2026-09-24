import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Avatar, Banner, Button, Heading, Label, Link, RelativeTime, SkeletonBox, VisuallyHidden, type LabelProps } from '@primer/react'
import { KeybindingHint, SkeletonAvatar, SkeletonText } from '@primer/react/experimental'
import { FileIcon, LinkExternalIcon } from '@primer/octicons-react'
import { Composer } from './Composer.tsx'
import { ShortcutsDialog } from './ShortcutsDialog.tsx'
import { useShortcuts } from './shortcuts.ts'
import { sanitize } from './sanitize.ts'
import type { Comment, Person, StatusCategory, Ticket } from './types.ts'

const statusVariant: Record<StatusCategory, LabelProps['variant']> = {
  new: 'attention',
  open: 'success',
  pending: 'accent',
  hold: 'default',
  solved: 'done',
  closed: 'done',
}

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; ticket: Ticket }

export function TicketPage({ id }: { id: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [showShortcuts, setShowShortcuts] = useState(false)
  useShortcuts({ '?': () => setShowShortcuts(true) })

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/tickets/${id}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json()
        setState(res.ok ? { kind: 'ready', ticket: body } : { kind: 'error', message: body.error })
      })
      .catch((err) => {
        if (!controller.signal.aborted) setState({ kind: 'error', message: String(err) })
      })
    return () => controller.abort()
  }, [id])

  useEffect(() => {
    document.title = state.kind === 'ready' ? `#${id} ${state.ticket.subject} · Sheen` : `#${id} · Sheen`
  }, [id, state])

  if (state.kind === 'loading') return <TicketSkeleton id={id} />
  if (state.kind === 'error') {
    return (
      <div className="centered">
        <Banner variant="critical" title={`Couldn't load ticket #${id}`} description={state.message} />
      </div>
    )
  }

  const { ticket } = state
  return (
    <div className="ticket">
      <header className="ticket-header">
        <Label variant={statusVariant[ticket.status.category]} size="large">
          {ticket.status.label}
        </Label>
        <Heading as="h1" variant="small" className="ticket-subject">
          {ticket.subject} <span className="muted">#{ticket.id}</span>
        </Heading>
        <Button size="small" variant="invisible" onClick={() => setShowShortcuts(true)} trailingVisual={<KeybindingHint keys="?" size="small" />}>
          Shortcuts
        </Button>
        <Button as="a" href={ticket.url} target="_blank" rel="noopener noreferrer" size="small" trailingVisual={LinkExternalIcon}>
          Open in Zendesk
        </Button>
      </header>

      <main className="conversation" aria-label="Conversation">
        {ticket.comments.map((comment) => (
          <CommentView
            key={comment.id}
            comment={comment}
            flaggedArticle={ticket.tags.includes('knowledge_capture_flagged_article')}
          />
        ))}
      </main>

      <div className="composer-column">
        <Composer requester={ticket.requester?.name ?? null} currentStatus={ticket.status.category} />
      </div>

      <aside className="properties" aria-label="Ticket properties">
        <dl>
          <Property label="Requester">
            {ticket.requester && <PersonView person={ticket.requester} withEmail />}
          </Property>
          <Property label="Organization">{ticket.organization}</Property>
          <Property label="Assignee">
            {ticket.assignee && <PersonView person={ticket.assignee} />}
          </Property>
          <Property label="Group">{ticket.group}</Property>
          <Property label="Priority">{capitalize(ticket.priority)}</Property>
          <Property label="Type">{capitalize(ticket.type)}</Property>
          <Property label="Created">
            <RelativeTime datetime={ticket.createdAt} />
          </Property>
          <Property label="Updated">
            <RelativeTime datetime={ticket.updatedAt} />
          </Property>
          {ticket.fields.map((field) => (
            <Property key={field.title} label={field.title}>
              {field.value}
            </Property>
          ))}
          <Property label="Tags">
            {ticket.tags.length > 0 && (
              <span className="tags">
                {ticket.tags.map((tag) => (
                  <Label key={tag}>{tag}</Label>
                ))}
              </span>
            )}
          </Property>
        </dl>
      </aside>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}

// The page layout with placeholders, shown while the ticket loads.
function TicketSkeleton({ id }: { id: number }) {
  return (
    <div className="ticket" aria-busy="true">
      <VisuallyHidden>Loading ticket #{id}</VisuallyHidden>
      <header className="ticket-header" aria-hidden="true">
        <SkeletonBox width="48px" height="24px" />
        <Heading as="h1" variant="small" className="ticket-subject">
          <SkeletonText size="titleSmall" maxWidth="360px" />
        </Heading>
        <SkeletonBox width="128px" height="28px" />
      </header>

      <main className="conversation" aria-hidden="true">
        {[3, 2].map((lines, i) => (
          <article key={i} className="comment">
            <header className="comment-header">
              <SkeletonAvatar size={20} />
              <SkeletonText maxWidth="160px" />
            </header>
            <SkeletonText lines={lines} />
          </article>
        ))}
      </main>

      <div className="composer-column" aria-hidden="true">
        <div className="composer">
          <SkeletonBox width="200px" height="28px" />
          <SkeletonBox height="218px" />
        </div>
      </div>

      <aside className="properties" aria-hidden="true">
        <dl>
          {['Requester', 'Organization', 'Assignee', 'Group', 'Priority', 'Type', 'Created', 'Updated', 'Tags'].map(
            (label) => (
              <Property key={label} label={label}>
                <SkeletonText maxWidth="120px" />
              </Property>
            ),
          )}
        </dl>
      </aside>
    </div>
  )
}

function CommentView({ comment, flaggedArticle }: { comment: Comment; flaggedArticle: boolean }) {
  const html = useMemo(() => sanitize(comment.html, { flaggedArticle }), [comment.html, flaggedArticle])
  return (
    <article className={comment.public ? 'comment' : 'comment internal'}>
      <header className="comment-header">
        {comment.author?.photoUrl && <Avatar src={comment.author.photoUrl} alt="" size={20} />}
        <strong>{comment.author?.name ?? 'Unknown'}</strong>
        {!comment.public && <Label variant="attention">Internal note</Label>}
        <RelativeTime datetime={comment.createdAt} className="muted" />
      </header>
      <div className="comment-body" dangerouslySetInnerHTML={{ __html: html }} />
      {comment.attachments.length > 0 && (
        <ul className="attachments">
          {comment.attachments.map((a) => (
            <li key={a.id}>
              <FileIcon size={16} />
              <Link href={a.url} target="_blank" rel="noopener noreferrer">
                {a.fileName}
              </Link>
              <span className="muted">{formatSize(a.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="property">
      <dt>{label}</dt>
      <dd>{children || <span className="muted">—</span>}</dd>
    </div>
  )
}

function PersonView({ person, withEmail }: { person: Person; withEmail?: boolean }) {
  return (
    <>
      {person.name}
      {withEmail && person.email && <div className="muted">{person.email}</div>}
    </>
  )
}

function capitalize(value: string | null) {
  return value ? value[0].toUpperCase() + value.slice(1) : null
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
