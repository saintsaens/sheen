// Comments from Zendesk's "flag article" feature contain the whole help center article, with the agent's
// feedback inside the flagged block. Keep only the section around the feedback visible, from the nearest
// heading above it to the next heading, and collapse the rest of the article.

const HEADING = 'h1, h2, h3, h4, h5, h6'

// Runs on sanitized HTML, where the feedback panel is the only element given a background.
export function collapseAroundFeedback(root: DocumentFragment) {
  const panel = root.querySelector<HTMLElement>('[style*="background-color"]')
  if (!panel) return

  // Climb to the article block holding the panel: the ancestor whose siblings include headings.
  let block: HTMLElement = panel
  while (!hasHeadingSibling(block)) {
    if (!block.parentElement) return
    block = block.parentElement
  }

  const blocks = Array.from(block.parentElement!.children) as HTMLElement[]
  const index = blocks.indexOf(block)
  const isHeading = (el: Element) => el.matches(HEADING) || el.querySelector(HEADING) !== null
  const start = blocks.findLastIndex((el, i) => i < index && isHeading(el))
  const end = blocks.findIndex((el, i) => i > index && isHeading(el))

  if (start > 0) collapse(blocks.slice(0, start), 'Article before this section')
  if (end !== -1) collapse(blocks.slice(end), 'Article after this section')
}

function hasHeadingSibling(el: HTMLElement) {
  const siblings = el.parentElement ? Array.from(el.parentElement.children) : []
  return siblings.some((sibling) => sibling !== el && (sibling.matches(HEADING) || sibling.querySelector(HEADING)))
}

function collapse(elements: HTMLElement[], label: string) {
  const details = document.createElement('details')
  details.className = 'collapsed-article'
  const summary = document.createElement('summary')
  summary.textContent = label
  elements[0].before(details)
  details.append(summary, ...elements)
}
