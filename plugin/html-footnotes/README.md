# Footnotes

Adds footnote/citation support for Wiki.js Visual Editor (CKEditor) pages. The Markdown editor already has footnotes via `markdown-it-footnote` — this plugin brings the same functionality to CKEditor.

## How It Works

Type `[^1]` inline as a citation marker and `[^1]: Reference text` anywhere in the document as the definition. The rendering module finds these patterns in the stored HTML and transforms them into proper footnote markup with a collected references section at the bottom of the page.

The output HTML matches the structure produced by `markdown-it-footnote`, so existing Wiki.js CSS applies to both editor types.

### Example

In CKEditor, type:

```
The solar system has eight planets[^1]. Pluto was reclassified in 2006[^2].

[^1]: As defined by the IAU since 2006.
[^2]: Resolution B5 of the 26th General Assembly.
```

This renders as:

> The solar system has eight planets<sup>[1]</sup>. Pluto was reclassified in 2006<sup>[2]</sup>.
>
> ---
> 1. As defined by the IAU since 2006. [↩]
> 2. Resolution B5 of the 26th General Assembly. [↩]

Footnote numbers link to their definitions and back.

## Installation

### Docker Compose

```yaml
services:
  wiki:
    image: requarks/wiki:2
    volumes:
      - ./plugin/html-footnotes:/wiki/server/modules/rendering/html-footnotes
```

### Dockerfile

```dockerfile
FROM requarks/wiki:2
COPY plugin/html-footnotes /wiki/server/modules/rendering/html-footnotes
```

Restart Wiki.js. The renderer appears in **Admin > Rendering** and is enabled by default.

## Footnote Button (optional)

An optional analytics module (`plugin/analytics-footnote-btn/`) adds a toolbar button and keyboard shortcut (`Ctrl+Shift+F`) to insert footnote markers in CKEditor. It auto-increments the footnote number and appends the definition to the existing definitions block.

Mount it separately:

```yaml
- ./plugin/analytics-footnote-btn:/wiki/server/modules/analytics/footnote-btn
```

Enable in **Admin > Analytics**.

| Setting | Default | Description |
|---------|---------|-------------|
| **Append Definitions To** | `first` | Which definitions block to append to. `first` = first block found, `last` = last block found. |

## Syntax

- **Inline marker**: `[^id]` where `id` is a number or name (e.g. `[^1]`, `[^note]`)
- **Definition**: `[^id]: Text of the footnote` — can appear anywhere in the document
- Footnotes are numbered in order of first inline appearance, regardless of the `id` used
- Markers without a matching definition are left as-is
- Definitions without a matching inline marker are still included in the footnotes section

## Architecture

This is an HTML rendering module (PRE phase, child of `htmlCore`). It receives a Cheerio `$` instance of the page HTML and:

1. Extracts `[^id]: text` definitions from text nodes
2. Replaces `[^id]` inline markers with `<sup>` links
3. Appends a `<section class="footnotes">` at the end
