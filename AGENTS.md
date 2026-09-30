## Site structure — read before touching the code

- The site structure is mapped in `docs/sitemap.md` (routes, navigation, page
  contents, signed-in area) and `docs/wireframe.md` (layout of each page/screen
  + the file paths of its components). Read both before any task that touches
  a page, section, or screen.
- Adding, removing, or changing a page/section/screen/content: first write a
  proposed change to the sitemap + wireframe (before/after) and get the user's
  approval. Once approved, overwrite the affected parts of both documents, then
  change the code. Documents and code go in the same commit.
- Fixes that don't change structure or content (bugs, styling, performance)
  need no proposal.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
