// ─── HTML Footnotes Renderer ──────────────────────────────────────
// Converts [^id] inline markers and [^id]: definitions into proper
// footnote HTML. Output matches markdown-it-footnote structure so
// existing Wiki.js CSS applies to both editor types.

const defined = /\[\^([^\]]+)\]:\s*(.*)/
const inline = /\[\^([^\]]+)\]/g

module.exports = {
  init ($, config) {
    const definitions = {}  // id -> text
    const refOrder = []     // ids in order of first inline appearance

    // ─── Pass 1: Extract definitions ────────────────────────────
    // Definitions are paragraphs (or lines) matching [^id]: text
    // Remove them from the DOM and store the text.

    $('body *').contents().filter(function () {
      return this.type === 'text'
    }).each(function () {
      const node = $(this)
      const text = node.text()
      const match = text.match(defined)
      if (!match) return

      const id = match[1]
      const content = match[2].trim()
      definitions[id] = content

      // If the entire parent element is just this definition, remove the parent
      const parent = node.parent()
      const parentText = parent.text().trim()
      if (parentText === text.trim()) {
        parent.remove()
      } else {
        // Just remove the definition text from the node
        node.replaceWith(text.replace(match[0], ''))
      }
    })

    // ─── Pass 2: Replace inline markers ─────────────────────────
    // Find [^id] in text nodes and replace with superscript links.

    $('body *').contents().filter(function () {
      return this.type === 'text'
    }).each(function () {
      const node = $(this)
      const text = node.text()
      if (!inline.test(text)) return
      inline.lastIndex = 0 // reset regex state

      const replaced = text.replace(inline, function (match, id) {
        // Only convert if there's a matching definition
        if (!definitions[id]) return match

        // Track appearance order for numbering
        if (refOrder.indexOf(id) === -1) {
          refOrder.push(id)
        }
        const n = refOrder.indexOf(id) + 1

        return '<sup class="footnote-ref"><a href="#fn' + n + '" id="fnref' + n + '">[' + n + ']</a></sup>'
      })

      if (replaced !== text) {
        node.replaceWith(replaced)
      }
    })

    // ─── Pass 3: Build footnotes section ────────────────────────

    if (refOrder.length === 0) return

    let html = '<hr class="footnotes-sep">\n'
    html += '<section class="footnotes">\n'
    html += '<ol class="footnotes-list">\n'

    for (let i = 0; i < refOrder.length; i++) {
      const id = refOrder[i]
      const n = i + 1
      const text = definitions[id] || ''
      html += '<li id="fn' + n + '" class="footnote-item">'
      html += '<p>' + text + ' <a href="#fnref' + n + '" class="footnote-backref">\u21a9</a></p>'
      html += '</li>\n'
    }

    html += '</ol>\n</section>\n'

    $('body').append(html)
  }
}
