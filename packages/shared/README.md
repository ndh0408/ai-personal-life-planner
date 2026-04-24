# @planner/shared

Shared TypeScript types and Zod validation schemas used by both `apps/api` and `apps/mobile`.

## Layout
- `src/types/` — pure TypeScript domain types (no runtime dependencies beyond `zod` for schemas).
- `src/schemas/` — Zod schemas + inferred input types (used for both server-side validation and client-side forms).

## Build
```bash
npm run build --workspace @planner/shared
```

The package is consumed via npm workspaces — both `apps/api` and `apps/mobile` import directly from `@planner/shared`.
