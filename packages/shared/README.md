# @lifeos/shared

Shared types and Zod schemas between `@lifeos/api` and `@lifeos/mobile`.

Source-only package — workspaces resolve `src/index.ts` directly so there's no
build step in the dev loop. The API uses these schemas for request validation;
the mobile app uses them for response parsing and form types.

Add new schema groups as siblings of `auth.ts` / `ai.ts` and re-export from `index.ts`.
