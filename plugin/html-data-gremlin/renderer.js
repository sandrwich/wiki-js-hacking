/* global WIKI */

const _ = require('lodash')

// ─── Supported Languages ─────────────────────────────────────────────

const SUPPORTED_LANGS = ['json', 'csv', 'tsv', 'text']

// ─── Parsing ─────────────────────────────────────────────────────────

function parseFrontmatter (raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const meta = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      meta[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
    }
  }
  return { meta, body: match[2] }
}

function parseCsv (text, delimiter) {
  const lines = text.trim().split('\n')
  if (lines.length === 0) return []

  const headers = lines[0].split(delimiter).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(delimiter)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() })
    return obj
  })
}

function parseBody (body, lang) {
  const trimmed = body.trim()
  switch (lang) {
    case 'json': return JSON.parse(trimmed)
    case 'csv':  return parseCsv(trimmed, ',')
    case 'tsv':  return parseCsv(trimmed, '\t')
    case 'text': return trimmed.split('\n').map(line => ({ text: line }))
    default:     return null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

const esc = v => _.escape(v != null ? String(v) : '')

function detectLang (className) {
  return SUPPORTED_LANGS.find(l => className.includes(`language-${l}`)) || null
}

function getColumns (data) {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    return Object.keys(data[0])
  }
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return ['Key', 'Value']
  }
  return ['Value']
}

// ─── Table Rendering ─────────────────────────────────────────────────

function renderArrayOfObjects (data) {
  const columns = Object.keys(data[0])
  return [
    `<thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>`,
    '<tbody>',
    ...data.map(row =>
      `  <tr>${columns.map(c => `<td>${esc(row[c])}</td>`).join('')}</tr>`
    ),
    '</tbody>'
  ].join('\n')
}

function renderKeyValue (data) {
  return [
    '<thead><tr><th>Key</th><th>Value</th></tr></thead>',
    '<tbody>',
    ...Object.entries(data).map(([k, v]) =>
      `  <tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`
    ),
    '</tbody>'
  ].join('\n')
}

function renderPrimitiveArray (data) {
  return [
    '<thead><tr><th>Value</th></tr></thead>',
    '<tbody>',
    ...data.map(v => `  <tr><td>${esc(v)}</td></tr>`),
    '</tbody>'
  ].join('\n')
}

function defaultRenderer (data) {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    return renderArrayOfObjects(data)
  }
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return renderKeyValue(data)
  }
  if (Array.isArray(data)) {
    return renderPrimitiveArray(data)
  }
  return `<tbody><tr><td>${esc(JSON.stringify(data))}</td></tr></tbody>`
}

// ─── Custom Renderers ────────────────────────────────────────────────

function getCustomRenderers (config) {
  try {
    return JSON.parse(config.renderers || '[]')
  } catch (e) {
    WIKI.logger.warn('Data Gremlin: Failed to parse custom renderers config: ' + e.message)
    return []
  }
}

function renderTable (data, renderName, config) {
  if (!renderName) return defaultRenderer(data)

  const custom = getCustomRenderers(config).find(r => r.name === renderName)
  if (!custom?.code) {
    WIKI.logger.warn(`Data Gremlin: Renderer "${renderName}" not found, using default`)
    return defaultRenderer(data)
  }

  try {
    const columns = getColumns(data)
    return new Function('data', 'columns', custom.code)(data, columns)
  } catch (e) {
    WIKI.logger.warn(`Data Gremlin: Custom renderer "${renderName}" failed: ${e.message}`)
    return defaultRenderer(data)
  }
}

// ─── Footer ──────────────────────────────────────────────────────────

function buildFooter ({ id, lang, colCount, apiRoute, tableClass }) {
  const linkAttr = 'target="_blank" rel="noopener" class="is-external-link" style="color: #1976d2 !important;"'
  const jsonLink = `<a href="${apiRoute}" ${linkAttr}>JSON</a>`
  const rawLink = lang !== 'json'
    ? ` · <a href="${apiRoute}?raw" ${linkAttr}>Raw</a>`
    : ''

  return [
    '<tfoot>',
    `  <tr><td colspan="${colCount}" class="${esc(tableClass)}-api-link">`,
    `    API: ${jsonLink}${rawLink}`,
    '  </td></tr>',
    '</tfoot>'
  ].join('\n')
}

// ─── Init ────────────────────────────────────────────────────────────

module.exports = {
  init ($, config) {
    const tableClass = config.tableClass || 'json-api-table'

    const selector = SUPPORTED_LANGS.map(l => `pre > code.language-${l}`).join(', ')

    $(selector).each((i, elm) => {
      const $code = $(elm)
      const lang = detectLang($code.attr('class') || '')
      if (!lang) return

      const { meta, body } = parseFrontmatter($code.text())
      if (!Object.keys(meta).length) return

      let data
      try { data = parseBody(body, lang) } catch (e) { return }
      if (data === null) return

      const id = meta.id || ''
      const renderName = meta.render || ''
      const colCount = getColumns(data).length
      const apiRoute = (config.apiRoute || '/gremlin/:id').replace(':id', esc(id))

      const tableBody = renderTable(data, renderName, config)
      const footer = (id && config.showApiLink !== false)
        ? buildFooter({ id, lang, colCount, apiRoute, tableClass })
        : ''

      const html = [
        `<div class="${esc(tableClass)}-wrapper" data-json-api-id="${esc(id)}" data-lang="${esc(lang)}">`,
        `  <table class="${esc(tableClass)}">`,
        `    ${tableBody}`,
        `    ${footer}`,
        '  </table>',
        '</div>'
      ].join('\n')

      $code.parent().replaceWith(html)
    })
  }
}
