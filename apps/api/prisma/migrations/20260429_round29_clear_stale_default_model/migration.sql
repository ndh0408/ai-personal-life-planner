-- Round 29: clear stale per-user `defaultModel` overrides.
--
-- Before R29 the codebase hardcoded `gpt-4o-mini` as the only default. Some
-- users explicitly saved that string into UserAiKey.defaultModel during the
-- pre-R29 onboarding (it was the only option in the picker). Now that
-- LlmService routes by tier (FAST/SMART) from env, those overrides would
-- pin every feature back to gpt-4o-mini and silently override the new
-- defaults gpt-5.4-mini / gpt-5.5.
--
-- We null out only the rows that are still on the legacy default. Custom
-- model strings (set by power users) stay intact.

UPDATE "UserAiKey"
SET "defaultModel" = NULL,
    "updatedAt" = NOW()
WHERE "defaultModel" = 'gpt-4o-mini';
