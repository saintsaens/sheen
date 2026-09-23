import { useId } from 'react'
import { Dialog, Text, ToggleSwitch } from '@primer/react'
import { KeybindingHint } from '@primer/react/experimental'
import { setSingleKeysEnabled, useSingleKeysEnabled } from './shortcuts.ts'

const GROUPS = [
  {
    title: 'Anywhere',
    shortcuts: [{ keys: 'Mod+Enter', label: 'Submit the answer' }],
  },
  {
    title: 'In the composer',
    shortcuts: [{ keys: 'Escape', label: 'Leave the composer for reading mode' }],
  },
  {
    title: 'Reading mode',
    singleKey: true,
    shortcuts: [
      { keys: 'r', label: 'Go to the composer' },
      { keys: 'i', label: 'Switch between public reply and internal note' },
      { keys: 'o', label: 'Set status to Open' },
      { keys: 'p', label: 'Set status to Pending' },
      { keys: 'h', label: 'Set status to On-hold' },
      { keys: 's', label: 'Set status to Solved' },
      { keys: '?', label: 'Show keyboard shortcuts' },
    ],
  },
]

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const enabled = useSingleKeysEnabled()
  const labelId = useId()
  const captionId = useId()

  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width="large">
      {GROUPS.map((group) => (
        <section key={group.title} className="shortcut-group">
          <h2 className="shortcut-group-title">{group.title}</h2>
          <dl>
            {group.shortcuts.map((s) => (
              <div key={s.keys} className={group.singleKey && !enabled ? 'shortcut disabled' : 'shortcut'}>
                <dt>{s.label}</dt>
                <dd>
                  <KeybindingHint keys={s.keys} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <div className="shortcut-setting">
        <div>
          <Text as="p" id={labelId} weight="semibold">
            Single-key shortcuts
          </Text>
          <Text as="p" id={captionId} size="small" className="muted">
            Turn off if they get in the way, for example with a screen reader.
          </Text>
        </div>
        <ToggleSwitch
          aria-labelledby={labelId}
          aria-describedby={captionId}
          checked={enabled}
          onChange={setSingleKeysEnabled}
          size="small"
        />
      </div>
    </Dialog>
  )
}
