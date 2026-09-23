// Sanitizes ticket comment HTML (often email HTML) for display in the app.
// Structure is kept (spacing, borders, bold, line breaks, flex layout); colors are swapped for theme tokens and
// typography is dropped, so content reads well in light and dark mode at the app's density.

import DOMPurify from 'dompurify'
import { collapseAroundFeedback } from './collapseArticle.ts'

// Longhand CSS properties we keep. None of them can load a URL.
const KEPT_PROPERTY =
  /^(?:(?:margin|padding)(?:-(?:top|right|bottom|left))?|border-(?:top|right|bottom|left)-(?:width|style|color)|border-(?:top|bottom)-(?:left|right)-radius|font-weight|font-style|text-decoration-line|white-space(?:-collapse)?|text-wrap-mode|display|flex-(?:direction|wrap|grow|shrink|basis)|align-items|align-self|justify-content|(?:row-|column-)?gap|vertical-align|text-align|list-style-(?:type|position))$/
// Images keep their size: Zendesk sets thumbnail widths inline.
const KEPT_IMAGE_PROPERTY = /^(?:width|height)$/

function hasVisibleBackground(style: CSSStyleDeclaration) {
  if (!['', 'none', 'initial'].includes(style.backgroundImage)) return true
  const color = style.backgroundColor
  if (!color || ['transparent', 'white', 'initial', 'inherit'].includes(color)) return false
  const channels = color.match(/rgba?\(([^)]+)\)/)?.[1].split(/[\s,/]+/).map(Number)
  if (!channels) return true
  const [r, g, b, alpha = 1] = channels
  return alpha > 0 && !(r === 255 && g === 255 && b === 255)
}

DOMPurify.addHook('beforeSanitizeAttributes', (node) => {
  if (!(node instanceof HTMLElement) || !node.hasAttribute('style')) return
  const { style } = node
  const hasBackground = hasVisibleBackground(style)
  for (const property of Array.from(style)) {
    if (!KEPT_PROPERTY.test(property) && !(node.tagName === 'IMG' && KEPT_IMAGE_PROPERTY.test(property))) {
      style.removeProperty(property)
    } else if (property.endsWith('-color')) {
      style.setProperty(property, 'var(--borderColor-default)')
    }
  }
  if (hasBackground) style.setProperty('background-color', 'var(--bgColor-muted)')
  // Write back the browser's serialization, which also drops anything it couldn't parse.
  if (style.length === 0) node.removeAttribute('style')
  else node.setAttribute('style', style.cssText)
})

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Only images keep a size; tables and cells follow the layout.
  if (node.tagName !== 'IMG') {
    node.removeAttribute('width')
    node.removeAttribute('height')
  }
  // Open links from ticket content in a new tab, never in the app.
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitize(html: string, { collapseFlaggedArticle = false } = {}) {
  const fragment = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style'],
    FORBID_ATTR: ['color', 'bgcolor', 'background', 'face', 'size', 'align'],
    RETURN_DOM_FRAGMENT: true,
  })
  // Images open full size in a new tab.
  for (const img of fragment.querySelectorAll('img')) {
    if (img.closest('a') || !/^https?:/.test(img.src)) continue
    const link = document.createElement('a')
    link.href = img.src
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    img.replaceWith(link)
    link.append(img)
  }
  if (collapseFlaggedArticle) collapseAroundFeedback(fragment)
  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}
