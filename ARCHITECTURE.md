# ExamForge Project Architecture

## Project Overview

ExamForge is a Progressive Web App (PWA) built to help Nigerian students prepare for JAMB, WAEC, and NECO exams. It provides AI-powered explanations, CBT simulation, personalized coaching, and subscription management.

- Framework: Next.js (app directory)
- Language: TypeScript
- Styling: Tailwind CSS + inline styles
- Authentication: Clerk
- Database: Supabase (Postgres)
- Payments: Paystack
- Webhooks: Svix (webhook management / Clerk webhooks)

---

## Middleware & Routing

The middleware enforces access rules and user flow:

1. Public routes (/login, /signup, public API webhooks, /)
2. System health routes require a secret header
3. Unauthenticated users are redirected to /login
4. API routes handle their own auth
5. The middleware queries Supabase to verify user row existence and fields:
   - subscription_status
   - onboarding_completed
   - role
6. Maintenance mode redirect for non-admins
7. Banned users are allowed only to /banned
8. Admin-only routes are restricted
9. Enforces onboarding completion
10. Subscribe routes check subscription status

Key points:
- The middleware uses the Supabase admin client (service role key) server-side only.
- Static assets and certain public endpoints are excluded from middleware checks.

---

## Inferred Database Schema

### users

- id (UUID primary key)
- clerk_user_id (TEXT unique)
- full_name (TEXT)
- email (TEXT)
- exam_type (TEXT) — JAMB/WAEC/NECO
- department (TEXT)
- target_score (INT)
- weak_subjects (TEXT[] / JSON)
- subscription_status (TEXT) — active/demo/expired/grace_period/banned
- onboarding_completed (BOOLEAN)
- role (TEXT) — admin/student/viewer
- last_active_at (TIMESTAMP)
- created_at, updated_at

### settings

- id
- setting_name (TEXT unique)
- setting_value (TEXT) — stored as strings; flags like "true"/"false"

Flags in settings: maintenance_mode, payments_enabled, signups_enabled, demo_enabled, referral_system_enabled, referrals_enabled, coupons_enabled, ai_explanations_enabled

### questions

- id, question_text, option_1..option_5, correct_answer_index
- subject, topic, year, exam_type
- has_diagram, diagram_image_url, diagram_description
- timestamps

### answers (explanations)

- id
- question_id → questions
- explanation (TEXT)
- verification_status (verified/unverified/flagged)

### attempts

- id
- user_id → users
- question_id → questions
- session_id → sessions
- selected_answer_index
- is_correct
- time_spent_seconds
- created_at

### sessions

- id
- user_id
- exam_type
- session_type (full_exam/free_practice/mock)
- duration_seconds
- questions_count
- score, total_questions
- created_at

### referrals

- id
- referrer_user_id → users
- referral_code (TEXT unique)
- referee_user_id → users (nullable)
- reward_status (none/pending/completed/claimed)
- created_at

### error_logs

- id
- error_code
- message
- clerk_user_id
- metadata (JSONB)
- created_at

---

## API Routes (selected)

### /api/flags (GET)

- Returns platform feature flags read from `settings`.
- No auth required (public pages use it).
- Returns flags as booleans; on error returns empty object so client can fall back to safe defaults.

### /api/user (GET)

- GET /api/user?clerk_id=xxx — returns safe profile fields used by the client (never exposes role)
- Verifies the requester via Clerk auth and matches clerk_id
- Updates last_active_at as a fire-and-forget operation

- POST /api/user — updates user profile fields (called by account and onboarding)

- POST /api/user/complete-onboarding — marks onboarding complete and saves exam date (note: file had a mismatched field name in some places; code sets onboarding_complete true)

### /api/attempts/record (POST)

- Atomically records an attempt and updates performance metrics using a Supabase RPC `record_attempt`.
- Body: user_id, question_id, selected_answer_index, time_spent_seconds, session_id
- Returns: attempt_id, is_correct, correct_answer_index, subject, topic

### /api/referrals/generate (POST)

- Generates a unique 8-character referral code; checks existing code for the user; retries on collision up to 5 times.

### /api/referrals/apply (POST)

- Applies a referral code during signup: prevents self-referral, double use, and marks reward_status pending.

### /api/ai/* (POST)

- /api/ai/welcome — generates non-critical AI welcome messages when users are inactive
- /api/ai/milestone — generates celebratory milestone messages
- /api/ai/smart-reminder — scheduled checks to generate reminders (streak or exam countdown)
- /api/ai/flag-explanation — student flags an explanation; marks flagged, logs to error_logs, generates fresh explanation via AI

### /api/admin/questions (GET)

- Admin-only route to list and filter questions. Supports pagination, search, filters, and returns joined answers with verification status.

### Webhooks

- /api/webhooks/clerk — syncs Clerk events to Supabase (user.created / user.updated / user.deleted) so middleware can rely on Supabase rows.
- Payment webhooks (Paystack) update subscription status.

---

## Hooks

### useFlags

- Fetches `/api/flags` and caches in sessionStorage for 5 minutes.
- Provides safe defaults so a flags fetch failure does not block users.
- Returns { flags, loading, error, refetch }.
- Use to hide or disable features on the client (payments section, AI explanations, referral sections, coupons, maintenance). 

### useUser

- Combines Clerk auth state with Supabase user record.
- Returns: { user, loading, error, refetch, isLoaded }.
- Verifies Clerk is loaded before calling `/api/user`.
- Note: useUser uses GET /api/user?clerk_id=... and expects auth verification server-side.

---

## Dashboard Flow (app/dashboard/page.tsx)

- Fetches three resources on mount when a userId is available:
  1. /api/student/context?user_id=USERID — returns user context payload (streak, accuracy_by_subject, weak_topics, neglected_subjects, recent_sessions, milestones, exam_info)
  2. /api/news — returns exam news displayed in dashboard
  3. /api/ai/welcome?user_id=USERID — optional AI message if student has been inactive

- UI Sections:
  - Greeting and small profile summary
  - AI welcome message (non-blocking)
  - Stats row: Questions answered, Accuracy, Streak
  - Exam countdown (days until exam, exam date, target score)
  - Neglected subjects warning
  - Quick actions: CBT session, Free Practice, Mock Exam
  - Performance by subject (accuracy bars)
  - Weak topics and CTA to practice them
  - Recent sessions
  - Exam news

- Skeletons are used widely to provide fast perceived performance while data loads.

---

## AI Integration

- Gemini (GEMINI_API_KEY env var) is used for generating messages and explanations.
- A small AI library builds a system prompt based on student context and calls Gemini for:
  - Welcome messages
  - Milestone celebrations
  - Smart reminders
  - Regenerating flagged explanations

- Interactions are saved for history and audit using `saveInteraction`.

---

## Payments & Subscriptions

- Paystack is integrated for payments. Public key is exposed to frontend; secret key used server-side for webhooks.
- Subscription statuses: active, demo, expired, grace_period, banned.
- Referral rewards are granted after referee makes their first payment.

---

## Environment Variables

Important vars (found in .env.example):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- CLERK_WEBHOOK_SECRET
- NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
- PAYSTACK_SECRET_KEY
- GEMINI_API_KEY
- NEXT_PUBLIC_URL

Note: ANY variable prefixed NEXT_PUBLIC_ is available client-side.

---

## Design System & UI

- Primary color: #1d4ed8
- Dark text: #0f172a
- Background: #faf9f7
- Typography: Georgia for headings/branding, system fonts for body
- Reusable components include PlanCard, AIMessage, StatCard, EmptyState, ErrorBanner, FlagBanner, Logo

---

## User Journeys (summary)

1. New student signs up via Clerk → redirected to /onboarding → generates referral code → completes onboarding → redirected to /dashboard
2. Returning student lands on dashboard, receives optional AI welcome, starts CBT session, each attempt recorded via /api/attempts/record
3. Payment flow: Student goes to /subscribe, pays via Paystack, webhook updates subscription status
4. Referral: On signup, new user can apply a referral code; reward granted after first payment

---

## Security Notes & Best Practices

- Service role key MUST NOT be imported into client bundles.
- Flags endpoint is public intentionally — avoid leaking secrets in settings table.
- Webhook endpoints must verify signatures (Clerk webhook secret, Paystack signature).
- Store only non-sensitive data in `settings.setting_value` if it is public-facing; convert to booleans server-side.

---

## File Map (high level)

- app/page.tsx — marketing landing page
- app/dashboard/page.tsx — student dashboard
- app/practice/* — practice flows (select, session, mock, results)
- app/api/* — API routes grouped by domain (ai, attempts, admin, flags, referrals, payments, webhooks, user, student, subscription, practice)
- component/* — UI components (UI.tsx, Logo.tsx, others)
- hooks/* — useUser.ts, useFlags.ts
- lib/* — supabase.ts, ai helpers
- .env.example — example env vars

---

## Summary Diagram

Client (Next.js) → Middleware (auth & gating) → API routes (Next JS server) → Supabase (Postgres)

External: Clerk (auth & webhooks), Paystack (payments & webhooks), Gemini (AI)

---

## Next Steps / Suggestions

- Add server-side unit/integration tests for critical RPCs (record_attempt, referral application, subscription webhooks).
- Harden webhook verification and log malformed requests.
- Consider storing flags as typed JSONB rather than string values to avoid conversion errors.
- Add rate limiting/abuse protection on /api/ai/* endpoints to avoid excessive GPT/Gemini usage costs.

---

## Contact

If you want, I can:
- Commit this file to the repository as ARCHITECTURE.md (I can create a branch or commit to the default branch).
- Split this doc into /docs/* pages.
- Generate an diagrams file (Mermaid) for README.

