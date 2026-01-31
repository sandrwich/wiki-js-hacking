/* global WIKI */

// ─── Supported Languages ──────────────────────────────────────────────

const SUPPORTED_LANGS = ['json', 'csv', 'tsv', 'text']

// ─── Cache ────────────────────────────────────────────────────────────
// Maps block id → { data, contentType, raw, rawContentType, timestamp }

const cache = new Map()
const CACHE_TTL = 60 * 1000 // 1 minute

function cacheGet (id) {
  const entry = cache.get(id)
  if (!entry) return null
  if ((Date.now() - entry.timestamp) < CACHE_TTL) return entry
  cache.delete(id)
  return null
}

function cacheSet (id, result) {
  cache.set(id, { ...result, timestamp: Date.now() })
}

// ─── Parsing ──────────────────────────────────────────────────────────

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

const RAW_CONTENT_TYPES = {
  json: 'application/json',
  csv:  'text/csv',
  tsv:  'text/tab-separated-values',
  text: 'text/plain'
}

function parseBody (body, lang) {
  const trimmed = body.trim()
  switch (lang) {
    case 'json': return { data: JSON.parse(trimmed), contentType: 'application/json' }
    case 'csv':  return { data: parseCsv(trimmed, ','),  contentType: 'text/csv' }
    case 'tsv':  return { data: parseCsv(trimmed, '\t'), contentType: 'text/tab-separated-values' }
    case 'text':
    default:     return { data: trimmed, contentType: 'text/plain' }
  }
}

// ─── Block Extraction ─────────────────────────────────────────────────

function extractBlock (content, id) {
  const pattern = /```(json|csv|tsv|text)\s*\n([\s\S]*?)```/g
  let match
  while ((match = pattern.exec(content)) !== null) {
    const lang = match[1]
    const { meta, body } = parseFrontmatter(match[2])
    if (meta.id === id) {
      return {
        ...parseBody(body, lang),
        raw: body.trim(),
        rawContentType: RAW_CONTENT_TYPES[lang] || 'text/plain'
      }
    }
  }
  return null
}

async function lookupBlock (id) {
  const cached = cacheGet(id)
  if (cached) return cached

  const pages = await WIKI.models.pages.query()
    .select('content')
    .where('contentType', 'markdown')
    .where('content', 'like', '%---%')

  for (const page of pages) {
    try {
      const result = extractBlock(page.content, id)
      if (result) {
        cacheSet(id, result)
        return result
      }
    } catch (_) {
      // Parse failed for this page, continue
    }
  }
  return null
}

// ─── Config ───────────────────────────────────────────────────────────

async function getConfig () {
  try {
    const renderer = await WIKI.models.renderers.query()
      .findOne({ key: 'htmlDataGremlin' })
      .select('config')
    return (renderer && renderer.config) || {}
  } catch (_) {
    return {}
  }
}

// ─── Route Handler ────────────────────────────────────────────────────

async function handleRequest (req, res) {
  try {
    const result = await lookupBlock(req.params.id)

    if (!result) {
      return res.status(404).json({ error: 'Block not found', id: req.params.id })
    }
    if ('raw' in req.query) {
      return res.type(result.rawContentType).send(result.raw)
    }
    if (result.contentType === 'text/plain') {
      return res.type('text/plain').send(result.data)
    }
    return res.json(result.data)
  } catch (e) {
    WIKI.logger.error('Data Gremlin API error: ' + e.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── Extension Module ─────────────────────────────────────────────────

module.exports = {
  key: 'data-gremlin',
  title: 'Data Gremlin API',
  isInstalled: false,

  async check () {
    if (!WIKI.app) {
      this.isInstalled = true
      return true
    }

    const config = await getConfig()
    if (config.apiEnabled === false) {
      WIKI.logger.info('Data Gremlin: API endpoint disabled in config')
      this.isInstalled = true
      return true
    }

    const routePath = config.apiRoute || '/gremlin/:id'

    // Invalidate cache when pages change
    if (WIKI.events) {
      WIKI.events.outbound.on('page.*', () => cache.clear())
    }

    // Extensions run after Wiki.js registers its catch-all page router,
    // so we reposition our route ahead of it. We use i18nextMiddleware as
    // a landmark when available; otherwise fall back to early insertion
    // (safe because our route pattern is specific, not a wildcard).
    WIKI.app.get(routePath, handleRequest)
    const stack = WIKI.app._router.stack
    const layer = stack.pop()
    const landmark = stack.findIndex(l => l.name === 'i18nextMiddleware')
    stack.splice(landmark >= 0 ? landmark + 2 : 0, 0, layer)

    WIKI.logger.info(`Data Gremlin: API route registered at ${routePath}`)
    this.isInstalled = true
    return true
  }
}
