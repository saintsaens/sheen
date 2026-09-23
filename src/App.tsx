import { useEffect, useState, type SubmitEvent } from 'react'
import { Button, Heading, Stack, TextInput } from '@primer/react'
import { TicketPage } from './TicketPage.tsx'

function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const onPop = () => setPath(location.pathname)
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])
  const navigate = (to: string) => {
    history.pushState(null, '', to)
    setPath(to)
  }
  return { path, navigate }
}

export function App() {
  const { path, navigate } = usePath()
  const ticketId = path.match(/^\/tickets\/(\d+)$/)?.[1]
  return ticketId ? <TicketPage key={ticketId} id={Number(ticketId)} /> : <Home onOpen={(id) => navigate(`/tickets/${id}`)} />
}

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const [value, setValue] = useState('')
  // Accept a bare ticket number or a pasted Zendesk ticket URL.
  const id = value.match(/(\d+)\s*$/)?.[1]

  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    if (id) onOpen(id)
  }

  return (
    <main className="home">
      <Heading as="h1" variant="small">
        Sheen
      </Heading>
      <form onSubmit={submit}>
        <Stack direction="horizontal" gap="condensed">
          <TextInput
            aria-label="Ticket number or Zendesk URL"
            placeholder="Ticket number or Zendesk URL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            block
          />
          <Button type="submit" disabled={!id}>
            Open
          </Button>
        </Stack>
      </form>
    </main>
  )
}
