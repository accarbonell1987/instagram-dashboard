#!/usr/bin/env bash
#
# PreToolUse hook (Write|Edit): injects the code standard contract into context
# before any source file in this monorepo is written.
#
# A document nobody reads is not a contract. This makes `.atl/code-standard.md`
# unavoidable at the exact moment it matters — the write itself.
#
# Silent no-op for non-source files and for files outside this repository.
set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
standard="$repo_root/.atl/code-standard.md"

file_path="$(jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -n "$file_path" ] || exit 0
[ -f "$standard" ] || exit 0

# Source files only.
case "$file_path" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs) ;;
  *) exit 0 ;;
esac

# Inside this repository only.
case "$file_path" in
  "$repo_root"/*) ;;
  *) exit 0 ;;
esac

context="MANDATORY: this write is governed by the code standard at .atl/code-standard.md.
Read it before writing if you have not already this session, and satisfy its
Definition of Done (§5). Non-negotiables:
  - Container/presentational split: presentational components never touch a service
    or a data hook.
  - Files kebab-case; named exports (default only where Next.js requires it).
  - One data layer per app (§4.1): @core/core is the default; apps/hub uses
    apiFetchWithInterceptors; instagram-dashboard/web uses its own fetch layer.
    No bare fetch or axios.create outside lib/, and no second client inside an app.
  - Mutable data is read from GET /auth/me, never carried as a JWT claim (§4.4).
  - UI copy follows the app's declared language; @core/ui takes copy as props (§3.1).
  - Semantic colours come from tokens, never a raw palette class like text-red-600.
  - No 'any' without a justifying comment; '===' always; braces always; import type.
  - One domain area never imports from another; packages/ never imports from apps/.
Structural rules live in .atl/webapp-architecture.md and are enforced by
'pnpm check:architecture'. 'pnpm build' is part of done — it is the only check
that runs next lint."

jq -n --arg ctx "$context" \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $ctx}}'
