-- Round 37: surface a "Why this?" rationale on every AI nudge.
-- Distinct from `content` (the user-visible body) — `explainText` is the
-- short meta-rationale ("Bạn ngủ < 6h ba đêm liên tiếp").
ALTER TABLE "AIRecommendation"
  ADD COLUMN IF NOT EXISTS "explainText" TEXT;
