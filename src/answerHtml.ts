// Answers are typed as plain text. Pasted or dropped images are uploaded right away and appear in the text as
// Markdown image tags, like on GitHub; sending turns the text into HTML with those images inline.

const IMAGE = /!\[([^\]\n]*)\]\(([^)\s]+)\)/g

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// `images` maps each uploaded image's URL to the src to render it with. Image tags for other URLs stay text.
export function answerHtml(text: string, images: Map<string, string>): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => {
      let html = ''
      let last = 0
      for (const match of paragraph.matchAll(IMAGE)) {
        const src = images.get(match[2])
        if (!src) continue
        html += escape(paragraph.slice(last, match.index)) + `<img src="${escape(src)}" alt="${escape(match[1])}">`
        last = match.index + match[0].length
      }
      html += escape(paragraph.slice(last))
      return `<p>${html.replace(/\n/g, '<br>')}</p>`
    })
    .join('')
}

export const imageTag = (alt: string, url: string) => `![${alt.replace(/[[\]\n]/g, '')}](${url})`

// The uploaded image URLs an answer's text still references.
export function referencedImages(text: string): Set<string> {
  return new Set(Array.from(text.matchAll(IMAGE), (match) => match[2]))
}
