import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { ActionList, ActionMenu, Banner, Button, ButtonGroup, IconButton, SegmentedControl, Textarea } from '@primer/react'
import { KeybindingHint } from '@primer/react/experimental'
import { TriangleDownIcon } from '@primer/octicons-react'
import type { StatusCategory } from './types.ts'

type Mode = 'public' | 'internal'

// The statuses an agent can submit as. Custom statuses come later, once sending is connected.
const STATUSES = [
  { category: 'open', label: 'Open', action: 'Submit as Open' },
  { category: 'pending', label: 'Pending', action: 'Submit as Pending' },
  { category: 'hold', label: 'On-hold', action: 'Submit as On-hold' },
  { category: 'solved', label: 'Solved', action: 'Solve' },
] as const satisfies { category: StatusCategory; label: string; action: string }[]

type SubmitStatus = (typeof STATUSES)[number]['category']

export function Composer({ requester, currentStatus }: { requester: string | null; currentStatus: StatusCategory }) {
  const [mode, setMode] = useState<Mode>('public')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('solved')
  const [notice, setNotice] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)

  // Focus the composer when the ticket opens, without scrolling: on narrow screens it sits below the conversation.
  useEffect(() => input.current?.focus({ preventScroll: true }), [])

  const action = STATUSES.find((s) => s.category === status)!.action
  // Submitting only a status change, with no comment, is valid.
  const canSubmit = body.trim() !== '' || status !== currentStatus

  const submit = () => {
    if (canSubmit) setNotice(true)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
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
          setNotice(false)
        }}
        onKeyDown={onKeyDown}
        rows={10}
        resize="vertical"
        block
      />

      <div className={`composer-actions status-${status}`}>
        <ButtonGroup>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
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
                  <ActionList.Item key={s.category} selected={s.category === status} onSelect={() => setStatus(s.category)}>
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

      {notice && (
        <Banner
          variant="info"
          title="Sending isn't connected yet"
          description="Nothing was sent to Zendesk. Your draft is kept."
          onDismiss={() => setNotice(false)}
        />
      )}
    </form>
  )
}
