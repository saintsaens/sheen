import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { ActionList, ActionMenu, Banner, Button, ButtonGroup, ConfirmationDialog, IconButton, SegmentedControl, Textarea } from '@primer/react'
import { KeybindingHint } from '@primer/react/experimental'
import { TriangleDownIcon } from '@primer/octicons-react'
import { useShortcuts, useSingleKeysEnabled } from './shortcuts.ts'
import type { Answer, StatusCategory, Ticket } from './types.ts'

type Mode = 'public' | 'internal'

// The statuses an agent can submit as. Custom statuses come later.
const STATUSES = [
  { category: 'open', label: 'Open', action: 'Send and keep Open' },
  { category: 'pending', label: 'Pending', action: 'Send as Pending' },
  { category: 'hold', label: 'On-hold', action: 'Send as On-hold' },
  { category: 'solved', label: 'Solved', action: 'Solve' },
] as const satisfies { category: StatusCategory; label: string; action: string }[]

type SubmitStatus = (typeof STATUSES)[number]['category']
type Stage = { kind: 'editing' } | { kind: 'confirming' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'failed'; message: string }

export function Composer({ ticket, onSent }: { ticket: Ticket; onSent: (ticket: Ticket) => void }) {
  const requester = ticket.requester?.name ?? null
  const currentStatus = ticket.status.category
  const [mode, setMode] = useState<Mode>('public')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('solved')
  const [stage, setStage] = useState<Stage>({ kind: 'editing' })
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const singleKeys = useSingleKeysEnabled()

  // Focus the composer when the ticket opens, without scrolling: on narrow screens it sits below the conversation.
  // No focus event fires when the window itself isn't focused (e.g. a background tab), so set the state directly.
  useEffect(() => {
    input.current?.focus({ preventScroll: true })
    setFocused(document.activeElement === input.current)
  }, [])

  const { action, label } = STATUSES.find((s) => s.category === status)!
  const hasComment = body.trim() !== ''
  // Submitting only a status change, with no comment, is valid.
  const canSubmit = hasComment || status !== currentStatus
  const busy = stage.kind === 'confirming' || stage.kind === 'sending'

  // Submitting only opens the confirmation: this writes to the production Zendesk.
  const submit = () => {
    if (canSubmit && !busy) setStage({ kind: 'confirming' })
  }

  const send = async () => {
    setStage({ kind: 'sending' })
    const answer: Answer = { body, public: mode === 'public', status, updatedAt: ticket.updatedAt }
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer),
      })
      const result = await res.json()
      if (!res.ok) return setStage({ kind: 'failed', message: result.error })
      setBody('')
      setStage({ kind: 'sent' })
      onSent(result)
    } catch (err) {
      setStage({ kind: 'failed', message: String(err) })
    }
  }

  const chooseStatus = (next: SubmitStatus) => {
    setStatus(next)
    if (!busy) setStage({ kind: 'editing' })
  }

  // In the confirmation, Cancel has focus so a stray Enter doesn't send; ⌘Enter / Ctrl+Enter confirms.
  useEffect(() => {
    if (stage.kind !== 'confirming') return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        send()
      }
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  })

  useShortcuts({
    'Mod+Enter': submit,
    r: () => input.current?.focus(),
    i: () => setMode((m) => (m === 'public' ? 'internal' : 'public')),
    o: () => chooseStatus('open'),
    p: () => chooseStatus('pending'),
    h: () => chooseStatus('hold'),
    s: () => chooseStatus('solved'),
  })

  // Esc leaves the composer for reading mode, where single-key shortcuts work.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') e.currentTarget.blur()
  }

  return (
    <form
      className="composer"
      aria-label="Answer"
      onSubmit={(e: SubmitEvent) => {
        e.preventDefault()
        submit()
      }}
    >
      <SegmentedControl aria-label="Answer type" size="small" onChange={(i) => setMode(i === 0 ? 'public' : 'internal')}>
        <SegmentedControl.Button selected={mode === 'public'}>Public reply</SegmentedControl.Button>
        <SegmentedControl.Button selected={mode === 'internal'}>Internal note</SegmentedControl.Button>
      </SegmentedControl>

      <Textarea
        ref={input}
        aria-label={mode === 'public' ? 'Public reply' : 'Internal note'}
        placeholder={mode === 'public' ? `Reply to ${requester ?? 'the requester'}` : 'Note visible to agents only'}
        className={mode === 'internal' ? 'composer-input internal' : 'composer-input'}
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          if (!busy) setStage({ kind: 'editing' })
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={10}
        resize="vertical"
        block
      />

      <div className={`composer-actions status-${status}`}>
        {!focused && singleKeys && (
          <span className="reading-hint muted">
            <KeybindingHint keys="r" /> to reply · <KeybindingHint keys="?" /> for shortcuts
          </span>
        )}
        <ButtonGroup>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            loading={stage.kind === 'sending'}
            aria-keyshortcuts="Meta+Enter Control+Enter"
            trailingVisual={<KeybindingHint keys="Mod+Enter" variant="onPrimary" size="small" />}
          >
            {action}
          </Button>
          <ActionMenu>
            <ActionMenu.Anchor>
              <IconButton icon={TriangleDownIcon} variant="primary" aria-label="Choose status" />
            </ActionMenu.Anchor>
            <ActionMenu.Overlay align="end">
              <ActionList selectionVariant="single">
                {STATUSES.map((s) => (
                  <ActionList.Item key={s.category} selected={s.category === status} onSelect={() => chooseStatus(s.category)}>
                    <ActionList.LeadingVisual>
                      <span className={`status-dot ${s.category}`} />
                    </ActionList.LeadingVisual>
                    {s.label}
                  </ActionList.Item>
                ))}
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        </ButtonGroup>
      </div>

      {(stage.kind === 'confirming' || stage.kind === 'sending') && (
        <ConfirmationDialog
          title={`${action} on ticket #${ticket.id}?`}
          confirmButtonContent={
            <>
              {action} <KeybindingHint keys="Mod+Enter" variant="onPrimary" size="small" />
            </>
          }
          confirmButtonType="primary"
          confirmButtonLoading={stage.kind === 'sending'}
          overrideButtonFocus="cancel"
          width="large"
          onClose={(gesture) => {
            if (stage.kind === 'sending') return
            if (gesture === 'confirm') send()
            else setStage({ kind: 'editing' })
          }}
        >
          <dl className="confirm-summary">
            <dt>Sends</dt>
            <dd>{!hasComment ? 'No comment' : mode === 'public' ? `Public reply to ${requester ?? 'the requester'}` : 'Internal note'}</dd>
            <dt>Status</dt>
            <dd>{status === currentStatus ? `${label} (unchanged)` : `${ticket.status.label} → ${label}`}</dd>
          </dl>
          {hasComment && <blockquote className={mode === 'internal' ? 'confirm-body internal' : 'confirm-body'}>{body.trim()}</blockquote>}
        </ConfirmationDialog>
      )}

      {stage.kind === 'sent' && (
        <Banner variant="success" title="Sent to Zendesk" onDismiss={() => setStage({ kind: 'editing' })} />
      )}
      {stage.kind === 'failed' && (
        <Banner
          variant="critical"
          title="Couldn't send to Zendesk"
          description={`${stage.message} Your draft is kept.`}
          onDismiss={() => setStage({ kind: 'editing' })}
        />
      )}
    </form>
  )
}

