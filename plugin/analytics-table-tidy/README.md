# Table Tidy

A Wiki.js v2 plugin that auto-formats markdown tables in the editor. Aligns pipes, pads cells, and lets you navigate between cells with Tab.

## How It Works

Table Tidy is an analytics module that injects a script into the Wiki.js editor page. It hooks into the CodeMirror 5 editor instance and adds:

- **Format keybind** (default `Shift-Alt-F`) — formats all markdown tables in the document
- **Tab navigation** (optional) — when the cursor is inside a table, Tab formats the table and moves to the next cell

### Before

```
| Name | Role | Dept |
|---|---|---|
| Alice | Engineering Lead | Engineering |
| Bob | PM | Product |
```

### After

```
| Name  | Role             | Dept        |
|-------|------------------|-------------|
| Alice | Engineering Lead | Engineering |
| Bob   | PM               | Product     |
```

Alignment markers (`:---`, `:---:`, `---:`) are preserved.

## Installation

### Docker Compose (development)

```yaml
services:
  wiki:
    image: requarks/wiki:2
    volumes:
      - ./plugin/analytics-table-tidy:/wiki/server/modules/analytics/table-tidy
```

### Dockerfile (production)

```dockerfile
FROM requarks/wiki:2
COPY plugin/analytics-table-tidy /wiki/server/modules/analytics/table-tidy
```

Restart Wiki.js, then enable **Table Tidy** in **Admin > Analytics**.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| **Format Keybind** | `Shift-Alt-F` | CodeMirror keybind to format all tables. |
| **Tab Navigation** | `true` | Use Tab to format and jump to next cell inside tables. |

## Standalone Versions

If you don't want to install the Wiki.js module, standalone versions are included:

- **`table-tidy.user.js`** — Tampermonkey / Greasemonkey userscript. Edit `FORMAT_KEYBIND` and `TAB_NAVIGATION` at the top of the file.
- **`bookmarklet.js`** — Bookmarklet. Create a bookmark with the file contents as the URL. Click it while on a Wiki.js editor page.

## Architecture

Analytics modules are the only Wiki.js injection vector that reaches the editor page — theme `injectHead`/`injectBody` are excluded from `editor.pug`, but `analyticsCode.bodyEnd` renders on all pages via `master.pug`.

The script polls for the `.CodeMirror` DOM element (the editor loads async via Vue), then hooks into its `extraKeys` configuration.
