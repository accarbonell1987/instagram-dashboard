# @corehub/web-instagram-dashboard

Standalone Next.js 15 web app for the Instagram analytics dashboard.

Unlike the canonical webapp-example, this app does **not** use `@core/core`
CRUD services or `ServicesProvider`. It talks to a separate analytics API over
its own bespoke fetch layer (added in a later step), with postMessage-based auth.
It keeps only the shared theming/layout shell (`ThemeProvider`, `TooltipProvider`,
`Toaster`). This is why it carries a `§1` exemption in
`.atl/webapp-architecture-exemptions.json`.

## Scripts

| Script         | Command                                                    |
| -------------- | --------------------------------------------------------- |
| Dev (port 3010)| `pnpm --filter @corehub/web-instagram-dashboard dev`      |
| Build          | `pnpm --filter @corehub/web-instagram-dashboard build`    |
| Type-check     | `pnpm --filter @corehub/web-instagram-dashboard type-check`|
| Lint           | `pnpm --filter @corehub/web-instagram-dashboard lint`     |
| Test           | `pnpm --filter @corehub/web-instagram-dashboard test`     |

## Structure (Screaming Architecture)

```
src/
├── app/        # Next.js App Router (layout, page, globals)
├── features/   # Domain features (Instagram module — added later)
├── shared/     # Reusable hooks and components
└── lib/        # Bespoke HTTP layer + utilities (added later)
```
