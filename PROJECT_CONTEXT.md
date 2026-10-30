# Project Context: Faro School

## 1. Project Summary**Faro School** is a high-performance, mobile-first online education platform engineered specifically for Haiti. It allows an independent instructor to sell structured video courses to Haitian students with low-bandwidth, mobile-friendly optimizations and native local payment integration (MonCash and NatCash in Haitian Gourdes - HTG). The platform is completely bilingual: French (`fr`, default) and Haitian Creole (`ht`, rendered with language tag `KR`).

## 2. Stack

PWA is the primary app. Shared shell scroll/safe-area changes must cover dashboard,
messages, community, profile, certificates, admin and player; landing is excluded.
Community requires an active enrollment (or verified staff role), enforced by
`src/lib/community/access.ts`, existing `can()` and restrictive database policies.
Dashboard indicators come from `/api/dashboard/unread`, never fixture numbers.
See `docs/PWA_DASHBOARD_FIXES.md`; verification mail jobs stop after confirmation
or ten minutes from request creation.

Auth session cookie invariant: `auth.config.ts` sets `useSecureCookies` once;
middleware `getToken` must use that same value. Production uses the
`__Secure-authjs.session-token` cookie name and JWE salt. Omitting it sends a
valid session between dashboard and login indefinitely. Do not add cookie-name
fallbacks that accept unsigned cookies or bypass the server database checks.

Email auth orchestration: `src/lib/email/auth-requests.ts` is the only public
signup/resend/recovery pipeline. Reserve the atomic email budget once per request.
Account creation must call the existing `create_user_with_credentials` RPC with
`p_id` and read its JSON `user_id`; never fall back to separate credential/profile
inserts. See `docs/EMAIL_REBUILD.md` for operations and verification limits.
`custom-worker.mjs` preserves OpenNext HTTP handling and dispatches the private
email-outbox cron internally every minute using the runtime `CRON_SECRET`.

- **Framework**: Next.js 15 (App Router) + TypeScript (strict mode) + pnpm
- **Styling**: Tailwind CSS + shadcn/ui design tokens (via `src/styles/tokens.css`)
- **Database & Auth**: Supabase PostgreSQL + Auth.js v5 (NextAuth, edge-safe JWT sessions, Web Crypto PBKDF2-SHA256, Resend verification emails) + Row Level Security (RLS) on all tables via short-lived signed Supabase tokens
- **Course Video Protection**: Bunny Stream (token-authenticated signed HLS playback, MediaCage DRM, direct browser uploads)
- **Asset Storage & CDN**: Bunny Storage + Bunny CDN (for public course covers and token-signed downloadable student resources; Supabase Storage is NOT used)
- **Internationalization (i18n)**: `next-intl` (URL prefixes `/fr` and `/ht`)
- **Form Management**: React Hook Form + Zod validation
- **Deployment Target**: Cloudflare Workers using OpenNext Cloudflare adapter (`@opennextjs/cloudflare`) and `wrangler`

---

## 2.1 Design System & Guidelines
- **Master Reference**: All design, styling, and visual presentation tasks must strictly follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
- **No Hard-Coded Hex Colors**: **NEVER hardcode hex color codes** (`#FF7F0E`, `#031047`, etc.) in components. Always use semantic Tailwind classes mapped to design tokens (`bg-orange`, `text-ink`, `bg-navy-deep`, `border-line`, `text-muted-faro`, etc.).
- **Visual Source of Truth**: The Faro School mockups in `public/brand/mockup-desktop.jpg` and `public/brand/mockup-mobile.png` define the styling. Any difference from earlier neutral placeholders resolves in favor of the mockup design.
- **Typography**: Poppins (`font-heading`, 600, 700, 600 italic for `<Highlight>`) for headings and buttons, Inter (`font-sans`) for body and interface.
- **Brand Assets**: Transparent logos in `public/brand/logo-on-light.png` and `public/brand/logo-on-dark.png`. `public/favicon.ico`, `public/apple-touch-icon.png`, and `public/og-image.png` deployed.
- **Preview Route**: `/[locale]/design-system` renders all components, color tokens, and WCAG contrast measurements (disabled in production).

---

## 3. Folder Map
```txtfaro
-school/├── .open-next/                  # OpenNext Cloudflare build output├── open-next.config.ts          # OpenNext Cloudflare adapter configuration├── wrangler.jsonc               # Cloudflare Workers configuration (nodejs_compat enabled)├── package.json                 # pnpm dependencies and deployment scripts├── tsconfig.json                # Strict TypeScript configuration├── tailwind.config.ts           # Tailwind CSS configuration mapped to token CSS variables├── postcss.config.mjs           # PostCSS configuration├── PROJECT_CONTEXT.md           # Master project context & architecture decisions├── README.md                    # Setup, manual steps & operational guide├── supabase/│   ├── migrations/│   │   └── 20250101000000_initial_schema.sql  # 14 tables, indexes, triggers & RLS│   └── seed.sql                 # 6 published sample courses (3 modules & lessons each)└── src/    ├── app/    │   ├── layout.tsx           # Minimal root layout    │   ├── page.tsx             # Root redirect to /fr    │   ├── api/                 # Cloudflare Workers-compatible API route handlers    │   │   ├── payments/    │   │   │   ├── create/route.ts            # POST /api/payments/create (server-verified price)    │   │   │   ├── kobara/return/route.ts     # GET /api/payments/kobara/return    │   │   │   └── kobara/mock-gate/route.ts  # GET /api/payments/kobara/mock-gate (MOCK test simulator)    │   │   ├── webhooks/    │   │   │   └── kobara/route.ts            # POST /api/webhooks/kobara (HMAC SHA-256 webhook)    │   │   └── admin/payments/[id]/validate/route.ts  # POST /api/admin/payments/[id]/validate    │   └── [locale]/    │       ├── layout.tsx       # NextIntlClientProvider & HTML lang layout    │       ├── (public)/        # Public routes with SiteHeader & SiteFooter    │       │   ├── page.tsx                           # 01 / landing    │       │   ├── formations/page.tsx                # 02 /formations catalog    │       │   ├── formations/[slug]/page.tsx         # 03 /formations/[slug] course detail    │       │   ├── a-propos/page.tsx                  # 12 /a-propos about    │       │   └── contact/page.tsx                   # 12 /contact contact    │       ├── (auth)/          # Authentication routes    │       │   ├── connexion/page.tsx                 # 04 /connexion login    │       │   └── inscription/page.tsx               # 04 /inscription register    │       ├── (student)/       # Student workspace & checkout    │       │   ├── checkout/[slug]/page.tsx           # 05 /checkout/[slug] checkout    │       │   ├── confirmation/[orderId]/page.tsx    # 06 /confirmation/[orderId] order confirmation    │       │   ├── dashboard/page.tsx                 # 07 /dashboard student dashboard    │       │   └── dashboard/learn/[courseSlug]/[lessonId]/page.tsx  # 08 lesson player    │       └── (admin)/         # Protected instructor & administration portal    │           ├── admin/page.tsx                     # 09 /admin dashboard    │           ├── admin/formations/page.tsx          # 10 /admin/formations courses list    │           ├── admin/formations/new/page.tsx      # 10 /admin/formations/new course creation    │           └── admin/paiements/page.tsx           # 11 /admin/paiements payments management    ├── components/    │   ├── Container.tsx        # Max-width responsive container    │   ├── SiteHeader.tsx       # Global responsive header with nav & language switcher    │   ├── SiteFooter.tsx       # Global footer with copyright & links    │   ├── LanguageSwitcher.tsx # Bilingual FR / KR switcher    │   ├── PriceTag.tsx         # HTG integer price formatter (e.g. "2 500 HTG")    │   ├── CheckoutButtons.tsx  # Interactive MonCash & NatCash buttons redirecting to Kobara    │   ├── CourseCard.tsx       # Unstyled data-only course card    │   ├── EmptyState.tsx       # Accessible neutral neutral empty state    │   ├── LoadingState.tsx     # Accessible neutral loading spinner    │   └── ErrorState.tsx       # Accessible neutral error state    ├── i18n/    │   ├── routing.ts           # next-intl routing definition (locales: fr, ht)    │   ├── request.ts           # next-intl request configuration    │   └── navigation.ts        # next-intl navigation primitives (Link, useRouter, etc.)    ├── messages/    │   ├── fr.json              # French locale translations    │   └── ht.json              # Haitian Creole locale translations    ├── lib/    │   ├── utils.ts             # Tailwind classnames merge helper (clsx + twMerge)    │   ├── auth/                # Supabase auth helpers (getCurrentUser, requireAdmin, requireUser)    │   ├── i18n/                # localized(row, field, locale) fallback helper    │   ├── payments/            # PaymentProvider interface, KobaraProvider (direct MonCash & NatCash routing, MOCK simulator)    │   ├── video/               # BunnyStreamProvider, MockVideoProvider, BunnyStorage, session limit    │   └── supabase/            # SSR client, browser client, admin client    ├── middleware.ts            # Next.js middleware (next-intl + Supabase route guards)    └── styles/        ├── tokens.css           # CSS design tokens (neutral grays + 1 primary color)        └── globals.css          # Tailwind base & layer directives
```

---

## 4. Planned Routes Table
| ID | Path 
| Route Group | Description 
| Status ||

---

|

---

|

---

|

---

|

---

|
| 01 | `/` | `(public)` 
| Landing Page | designed |
| 02 | `/formations` | `(public)` 
| Course Catalog | designed |
| 03 | `/formations/[slug]` | `(public)` 
| Course Details Page | designed |
| 04 | `/connexion` | `(auth)` | Student / Admin Login 
| designed |
| 04 | `/inscription` | `(auth)` 
| Student Registration | designed |
| 05 | `/checkout/[slug]` | `(student)` 
| Course Checkout Page | designed |
| 06 | `/confirmation/[orderId]` | `(student)` 
| Order Confirmation Page | designed |
| 07 | `/dashboard` | `(student)` 
| Student Learning Dashboard | designed |
| 08 | `/dashboard/learn/[courseSlug]/[lessonId]` | `(student)` 
| Video Lesson Player | designed |
| 09 | `/admin` | `(admin)` 
| Instructor Admin Dashboard | designed |
| 10 | `/admin/formations` | `(admin)` 
| Admin Course List | designed |
| 10 | `/admin/formations/new` | `(admin)` 
| Admin New Course Form | designed |
| 11 | `/admin/paiements` | `(admin)` | Payment Verification & Ledger 
| designed |
| 12 | `/a-propos` | `(public)` 
| About Faro School | designed |
| 12 | `/contact` | `(public)` | Contact & Support Form 
| designed |
| 13 | `/admin/eleves` | `(admin)` | Student Management & Manual Access 
| designed |
| 14 | `/admin/promotions` | `(admin)` | Coupons & Discount Management 
| designed |
| 15 | `/admin/messages` | `(admin)` | Contact Messages Inbox & WhatsApp Reply 
| designed |
| 16 | `/cgu` | `(public)` | Terms of Service (CGU) 
| designed |
| 17 | `/confidentialite` | `(public)` 
| Privacy Policy | designed |
| 18 | `/remboursement` | `(public)` 
| 7-Day Refund Policy | designed |
| 19 | `/admin/formateurs` | `(admin)` | Instructor Management & Course Assignment 
| designed |
| 20 | `/admin/tableau-de-bord` | `(admin)` | Instructor Personal Dashboard (P19) 
| designed |
| 21 | `/admin/unauthorized` | `(admin)` 
| 403 Forbidden Error Page | designed |
| 22 | `/dashboard/communaute` | `(student)` | Community Group Discussion (P17) 
| designed |
| 23 | `/dashboard/messages` | `(student)` | Student-Staff Private Messaging (P18) 
| designed |
| 24 | `/regles-communaute` | `(public)` | Community Rules & Guidelines 
| designed |
| 25 | `/admin/communaute` | `(admin)` | Staff Community Hub & Pinning (P17) 
| designed |
| 26 | `/admin/messages` | `(admin)` | Instructor Messaging & AI Takeover (P19) 
| designed |
| 27 | `/admin/assistant-ia` | `(admin)` | Instructor AI Customization & Sandbox (P19) 
| designed |
| 28 | `/admin/moderation` | `(admin)` | Admin Moderation Queue & Sanctions (P20) 
| designed |
| 29 | `/admin/messagerie` | `(admin)` | Admin Messaging Supervision & Kill Switch (P20) 
| designed |

---

## 5. Database Schema & TablesAll tables have Row Level Security (RLS) enabled.
1. `profiles`: `(id UUID PRIMARY KEY REFERENCES auth.users, full_name, display_name, phone, avatar_url, last_seen_at, muted_until, banned_at, role ['student'|'instructor'|'admin'], locale ['fr'|'ht'], created_at)`
2. `instructors`: `(profile_id UUID PRIMARY KEY REFERENCES profiles, title, bio, escalation_email, is_active BOOL DEFAULT true, created_at, updated_at)`
3. `courses`: `(id UUID, slug UNIQUE, title_fr, title_ht, description_fr, description_ht, price_htg INT, compare_price_htg INT NULL, level, category, cover_url, status ['draft'|'published'], instructor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, created_at)`
4. `modules`: `(id UUID, course_id REFERENCES courses, position INT, title_fr, title_ht)`
5. `lessons`: `(id UUID, module_id REFERENCES modules, position INT, title_fr, title_ht, video_id, duration_sec INT, is_free_preview BOOL, description_fr, description_ht)`
6. `lesson_resources`: `(id UUID, lesson_id REFERENCES lessons, name, file_url)`
7. `enrollments`: `(id UUID, user_id REFERENCES profiles, course_id REFERENCES courses, created_at, UNIQUE(user_id, course_id))`
8. `lesson_progress`: `(user_id REFERENCES profiles, lesson_id REFERENCES lessons, completed_at, last_position_sec, PRIMARY KEY(user_id, lesson_id))`
9. `orders`: `(id UUID, user_id REFERENCES profiles, course_id REFERENCES courses, amount_htg INT, coupon_id REFERENCES coupons NULL, status ['pending'|'paid'|'failed'|'cancelled'], reference UNIQUE, created_at)`
10. `payments`: `(id UUID, order_id REFERENCES orders, provider ['moncash'|'natcash'], provider_txn_id, payer_phone, status ['pending'|'awaiting_validation'|'validated'|'failed'], raw JSONB, validated_by REFERENCES profiles NULL, created_at)`
11. `coupons`: `(id UUID, code UNIQUE, percent_off INT NULL, amount_off_htg INT NULL, max_uses INT NULL, used_count INT, expires_at TIMESTAMPTZ NULL)`
12. `certificates`: `(id UUID, user_id REFERENCES profiles, course_id REFERENCES courses, code UNIQUE, issued_at TIMESTAMPTZ)`
13. `reviews`: `(id UUID, user_id REFERENCES profiles, course_id REFERENCES courses, rating INT CHECK 1..5, comment, created_at)`
14. `contact_messages`: `(id UUID, name, contact, message, created_at)`
15. `playback_sessions`: `(id UUID, user_id REFERENCES profiles, device_id, user_agent, last_seen_at, ended_at TIMESTAMPTZ NULL)`
16. `admin_audit_logs`: `(id UUID, admin_id REFERENCES profiles, action, payment_id, note, metadata JSONB, created_at)`

### Automated Database Triggers:- `on_auth_user_created`: Automatically creates a `public.profiles` entry when an `auth.users` row is inserted.- `on_payment_status_validated`: When a payment's `status` changes to `'validated'`, automatically sets `orders.status = 'paid'` and creates an entry in `enrollments(user_id, course_id)` on conflict do nothing.

---

## 5.1 Central Permission System (`src/lib/permissions.ts`)Centralized authorization function: `can(user, action, resource?)` with `requireRole(roles, locale?)` and `requirePermission(user, action, resource?)`.
| Action | Student 
| Instructor | Admin | Scope & Multi-Tenant Isolation Rule ||

---

|

---

|

---

|

---

|

---

|| `course.manage` 
| No | Own Only 
| All | Instructor can only edit/manage courses where `courses.instructor_id = auth.uid()` || `course.publish` 
| No | Own Only 
| All | Instructor can only publish courses they teach || `course.change_instructor` 
| No | No 
| Yes | Only admin can reassign course instructors || `students.view` 
| No | Own Only 
| All | Instructor can only view students enrolled in their courses || `admin.dashboard` 
| No | No 
| Yes | Platform KPI dashboard is strictly admin only (403 for instructors) || `instructor.dashboard` 
| No | Yes 
| Yes | Personal pedagogical workspace & stats || `payments.view` 
| No | No 
| Yes | Financial ledger & validation strictly admin only (403) || `promotions.manage` 
| No | No 
| Yes | Coupon management strictly admin only (403) || `instructors.manage` 
| No | No 
| Yes | Admin instructor management table at `/admin/formateurs` || `community.moderate` 
| No | Yes 
| Yes | Moderation & deletion rights || `community.pin` 
| No | Yes 
| Yes | Pinning priority topics and announcements || `ai.configure` 
| No | No 
| Yes | AI prompt & API configuration strictly admin only |

---

## 6. Core Architecture Abstractions

### Payment Layer (`src/lib/payments`)
- **Gateway**: **Kobara.app** (`https://docs.kobara.app/docs/quickstart`)  Unified Haitian fintech payment infrastructure handling both **MonCash** (Digicel) and **NatCash** (Natcom).
- **Interface**:  
```ts
  export type PaymentMethod = "moncash" | "natcash" | "kobara";  export interface PaymentProvider {    createPayment(order: OrderDetails, method: PaymentMethod): Promise<PaymentCreationResult>;    verifyPayment(referenceOrPaymentId: string): Promise<PaymentStatus>;    verifyWebhookSignature(payload: string, signature: string): Promise<boolean>;  }  
```

- **Direct Provider Routing**:  - Clicking **Payer avec MonCash** passes `provider: "moncash"` to Kobara, immediately redirecting the customer to the MonCash checkout on Kobara.  - Clicking **Payer avec NatCash** passes `provider: "natcash"` to Kobara, immediately redirecting the customer to the NatCash checkout on Kobara.  - Kobara handles the underlying carrier APIs and callbacks.
- **MOCK Mode**:  - If `KOBARA_SECRET_KEY` is not set or starts with `mock_`, the system automatically enters MOCK mode.  - Generates simulated tokens and redirects to `/api/payments/kobara/mock-gate`, providing a 1-click test confirmation screen for both MonCash and NatCash.
- **Webhook & Return Reconciliation**:  - `GET /api/payments/kobara/return`: Handles return redirects and updates payment status.  - `POST /api/webhooks/kobara`: Handles asynchronous `payment.succeeded` webhooks with HMAC-SHA256 signature verification (`x-kobara-signature`).
- **Security Rule**: The client is NEVER trusted for the price; `POST /api/payments/create` always reads the price directly from the database `courses` table.

### Video Layer (`src/lib/video`)- Interface:  
```ts
  export interface VideoProvider {    getPlaybackUrl(lessonId: string, userId: string): Promise<string>;  }  
```

- **Access Check (`checkLessonAccess`)**: Strictly enforces that lesson video access is only granted if:  1. The user has an `'admin'` role, OR  2. The lesson has `is_free_preview = true`, OR  3. The user is actively enrolled in the parent course.
- **BunnyStreamProvider**:  - Signs playback token URLs using SHA-256 (`SHA256(tokenAuthKey + videoId + expires)`).  - Enforces token expiry under 2 hours.  - Implements `createDirectUpload(title)` returning authorization signatures for direct browser uploads.
- **BunnyStorage**: Helper for public images/covers and token-signed downloadable files (`getSignedResourceUrl`) accessible only to enrolled students.
- **Playback Session Guard**: Enforces maximum of 2 concurrent active devices per account using `playback_sessions`. When a 3rd device signs in, the oldest session is automatically marked as `ended_at = now()`.

---

## 7. Development & Architecture Conventions

1. **Server Components by Default**: Pages and layout are React Server Components by default. Client components (`"use client"`) are strictly reserved for interactive boundaries (e.g., `LanguageSwitcher`, media players, form handlers).

2. **Strict Zod Validation**: Every external input (API routes, form submissions, webhooks) must be validated with Zod before processing.

3. **No Hard-coded UI Strings**: All UI copy must reside in `src/messages/fr.json` and `src/messages/ht.json`. The `useTranslations` hook or `getTranslations` server function must be used.

4. **Localized Database Content**: Content with bilingual columns (`*_fr` and `*_ht`) must be accessed through `localized(row, field, locale)`. When Creole (`_ht`) is empty, it automatically falls back to French (`_fr`).

5. **Integer Currency (HTG)**: Prices are always whole integers in Haitian Gourdes (`price_htg INT`). No floating-point currencies.

6. **No Hard-coded Colors**: All colors must use CSS design tokens mapped in `tailwind.config.ts` (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-muted`, etc.).7. **Mobile-First & Lightweight**: The target audience in Haiti relies predominantly on mobile devices with variable bandwidth. Pages avoid heavy libraries, heavy fonts, and unnecessary client JS bundles.

8. **Cloudflare Workers Compatibility**:   - No Node-only modules (`fs`, `child_process`, native bindings).   - Use standard Web Crypto API (`crypto.subtle`) for hashing and HMAC.   - Workers-compatible PDF generation via `pdf-lib`.   - Build via `@opennextjs/cloudflare` and `wrangler`.

---

## 8. Decisions1. **Next-intl Routing with `/fr` and `/ht`**:   - Default locale is `fr`. Haitian Creole is labeled as `KR` in the language switcher for natural recognition by Haitian users.   - URL prefix strategy is set to `always` (`/fr/...` and `/ht/...`) to ensure clear cache partitioning and deterministic SEO indexing on Cloudflare Workers edge nodes.2. **Supabase Auth & Session Handling**:   - Authenticated sessions are managed via `@supabase/ssr` using HTTP cookies.   - The Next.js middleware performs double duty: running `next-intl` route redirection and enforcing auth guards (`/dashboard/*` requires login, `/admin/*` requires `role === 'admin'`).

3. **Storage Separation**:   - Supabase Storage is explicitly NOT used.   - Bunny Stream is dedicated to private video delivery (MediaCage DRM enabled).   - Bunny Storage + Bunny CDN is dedicated to images, covers, and downloadable student files.4. **Kobara Payment Orchestration & Mock Fallback**:   - Replaced direct carrier-specific code with **Kobara.app** (`https://docs.kobara.app/docs/quickstart`).   - The UI provides dedicated buttons for MonCash and NatCash, each passing the respective provider parameter to Kobara so the user lands directly on the selected carrier's checkout.   - Offline & development tests run via an automatic zero-credential MOCK simulator (`/api/payments/kobara/mock-gate`).

5. **Database-Enforced Enrollment Lifecycle**:   - Both manual admin validations and Kobara webhook/return flows terminate at `payments.status = 'validated'`. The PostgreSQL trigger `on_payment_status_validated` guarantees atomicity: whenever payment status flips to `'validated'`, the order is marked `'paid'` and the student is enrolled in a single transaction.

6. **OpenNext Cloudflare Adapter**:   - OpenNext adapter (`@opennextjs/cloudflare`) configured with `nodejs_compat` in `wrangler.jsonc`.   - Next.js image optimization is set to `unoptimized: true` in `next.config.ts` to delegate media optimization directly to Bunny CDN.

7. **Landing Page Architecture (Page 01)**:   - Built with 9 modular sections in `src/components/landing/` (Hero, Categories, PopularCourses, HowItWorks, Instructor, Testimonials, FAQ, CTA, VideoModal).   - Server-side stats computed dynamically from `profiles`, `courses`, and `reviews` tables with 5-minute ISR cache (`revalidate = 300`).   - SEO metadata, Open Graph, and hreflang tags configured per locale (`/fr` and `/ht`).

8. **Catalog Page Architecture (Page 02)**:   - Server-side filtering and sorting strictly on published courses (`status = 'published'`).   - Multi-category checkboxes, level radio filters, debounced search (`?q=`), price slider, and sorting (`popular`, `newest`, `price_asc`, `price_desc`) are completely URL query-driven and shareable.   - Dual layout: sticky desktop left sidebar and lightweight mobile drawer/bottom sheet accessible at 390px viewport width without horizontal scroll.   - Database composite indexes added in migration `20250102000000_course_catalog_indexes.sql`.

9. **Course Sales Page Architecture (Page 03)**:   - Route `/[locale]/formations/[slug]` validates published courses and returns 404 (`notFound()`) for unknown or draft slugs.   - Dynamic user enrollment check (`enrollments` table & `getCurrentUser()`) switches CTA from "Acheter maintenant" (`/checkout/[slug]`) to "Continuer la formation" (`/dashboard`).   - Dual purchase trigger: desktop sticky card and 390px mobile fixed bottom bar with savings percentage and MonCash / NatCash badges.   - Free preview access endpoint `/api/video/playback?lessonId=...` integrates `VideoProvider` so visitors can play preview lessons without being logged in, while strictly blocking locked lessons with HTTP 403.   - SEO metadata, Open Graph tags, and Schema.org `Course` JSON-LD structured data configured per locale.10. **About & Contact Pages (Page 12)**:   - Route `/[locale]/a-propos`: Built with mission statement, 3 core values (Accessible, Pratique, Bilingue), instructor story, key figures (1 500+ apprenants, 8+ ans d'expérience, 100% MonCash/NatCash, 98% satisfaction), and catalog CTA.   - Route `/[locale]/contact`: Features WhatsApp direct link (`https://wa.me/...` dynamically reading `NEXT_PUBLIC_SUPPORT_PHONE`), email support, office address, and interactive contact form.   - Contact form validated by Zod on client and server (`/api/contact`), stored in `contact_messages` table, protected by a honeypot anti-spam trap and rate-limiting (5 messages/hour per IP). Preserves form data on validation error and renders localized feedback in FR / KR.

11. **Authentication Architecture (Page 04)**:   - Routes `/[locale]/connexion` and `/[locale]/inscription` with password visibility toggle, remember-me support, and optional Google auth behind `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`.   - Haitian phone format validation (`validateAndFormatHaitianPhone`) requiring exactly 8 digits following `+509`, normalized and saved directly to `profiles`.   - Open Redirect protection (`sanitizeRedirectUrl`): strictly validates `?next=` to only allow internal paths, ignoring external URL attacks.   - Server-side guard: already-authenticated users visiting auth pages are redirected to `/dashboard` (or sanitized `?next=`).   - Security: Edge-compatible rate-limiting on login/signup attempts (`checkRateLimit`), and generic credential failure messages preventing email enumeration.   - Header integration: Sign out action dynamically available from header for authenticated sessions.

12. **Course Checkout Architecture (Page 05)**:   - Route `/[locale]/checkout/[slug]`:     - Guard 1: Unauthenticated visitors redirected to `/${locale}/connexion?next=/checkout/${slug}`.     - Guard 2: Unknown or unpublished course slugs trigger `notFound()`.     - Guard 3: Already enrolled students are redirected to `/${locale}/dashboard`.   
- **Order Summary & Coupons**:     - Displays course thumbnail, title, price, compare price with computed discount percentage, and total.     - Dynamic coupon application via `POST /api/coupons/validate` (checks code, expiration date, and `max_uses`).     - Database trigger `handle_payment_validation()` increments `coupons.used_count` atomically *only* when payment transitions to `'validated'`.   
- **Payment Methods**:     
- **MonCash (Automated)**: Validates Haitian phone number, initiates order and pending payment in DB, and redirects user to Kobara MonCash gateway (or MOCK gate). The return route verifies with Kobara server-to-server and marks payment `'validated'`, auto-enrolling the student.     
- **NatCash (Manual)**: Displays merchant NatCash number (`NEXT_PUBLIC_MERCHANT_NATCASH_PHONE` or `+509 40 12 34 56`) and amount with 1-click clipboard copy buttons. Form takes sender phone and NatCash SMS transaction ID. Rejects duplicate transaction IDs via DB lookup, creates payment with status `'awaiting_validation'`, and creates **no** enrollment until admin manual approval. Redirects user to `/confirmation/[orderId]?status=awaiting_validation`.   
- **Security & Idempotency**:     - Amount is strictly computed server-side from the database course price and validated coupon.     - Reuses existing pending orders for the same `(user_id, course_id)` pair to avoid orphaned duplicate records.     - Sensitive secrets are excluded from `payments.raw` logging.   
- **Trust Elements**: 100% secure payment notice, 7-day guarantee, and WhatsApp direct link.   
- **Merchant Production Credentials Required (TODOs)**:     - `KOBARA_SECRET_KEY`: Merchant Kobara production secret key (`kobara_sk_live_...`).     - `KOBARA_WEBHOOK_SECRET`: Secret used to sign and verify Kobara webhook HMAC payloads.     - `NEXT_PUBLIC_MERCHANT_NATCASH_PHONE`: Official instructor/merchant NatCash number for manual transfers (e.g. `+509 40 XX XX XX`).     - `NEXT_PUBLIC_SUPPORT_WHATSAPP`: Instructor WhatsApp support number for customer inquiries.13. **Order Confirmation & Receipt Generation Architecture (Page 06)**:   - Route `/[locale]/confirmation/[orderId]`:     
- **Strict Ownership Guard**: Enforces that the order belongs to the currently authenticated user (`order.user_id === user.id`). Any unauthorized attempt or foreign `orderId` returns an immediate 404 (`notFound()`).     
- **Three Distinct States**:       
- **Success (`validated`)**: Confirms enrollment with order reference, localized course title, payment method, HTG amount, and formatted date. Features direct "Commencer la formation" CTA leading to the first course lesson (`/dashboard/learn/[courseSlug]/[lessonId]`) and a link to download the PDF receipt.       
- **Pending (`awaiting_validation` / `pending`)**: Explains payment verification (e.g. NatCash manual check), displays order reference, estimated timeframe, and WhatsApp support link. Runs automatic 10-second polling (`GET /api/orders/[orderId]/status`) that dynamically updates the UI to Success upon validation without requiring a manual page refresh.       
- **Failed (`failed` / `cancelled`)**: Clear error message, retry button redirecting back to `/checkout/[slug]`, and support contact.     
- **PDF Receipt Generation (`GET /api/orders/[orderId]/receipt`)**:       - Pure JS, Cloudflare Workers-compatible PDF generation via `pdf-lib`.       - Available strictly to the authenticated order owner (returns 404/401 for foreign requests).       - Generates clean, branded A4 receipt with invoice reference, student details, course title, amount in HTG, payment method, official validation stamp, and support contacts. WinAnsi diacritic sanitization ensures 100% encoding safety.14. **Student Dashboard & Certificate Issuance Architecture (Page 07)**:   - Route `/[locale]/dashboard` + sub-routes (`/formations`, `/certificats`, `/paiements`, `/profil`):     
- **Shared Layout & Scrolling Architecture**:       - Outer wrapper has fixed viewport height on desktop (`md:h-screen md:h-[100dvh] md:overflow-hidden`).       - Stationary desktop left sidebar: 260px width (`w-[260px] shrink-0 h-full bg-navy-deep`), remains stationary while main dashboard content scrolls independently (`flex-1 min-w-0 h-full md:overflow-y-auto`).       - Internal sidebar scrolling: only the central navigation container scrolls internally (`overflow-y-auto min-h-0`) if the viewport height is restricted; the logo remains permanently visible at the top and the WhatsApp help box remains pinned at the bottom.       - Mobile responsive behavior: desktop sidebar is hidden (`hidden md:flex`), and mobile bottom tab bar is fixed (`fixed bottom-0 inset-x-0 z-40 bg-navy-deep/95 backdrop-blur-md`) with `pb-28` main padding preventing content overlap and zero horizontal scroll at 390px. Automatically bypasses sidebar when inside `/dashboard/learn/` video player.     
- **Student Dashboard Home**:       - Personalized greeting (`Bonjour, [Nom] 👋`).       - 4 key metrics: active courses, completed lessons, hours learned (computed from `duration_sec` and `last_position_sec`), and earned certificates count.       - "Continue learning" card: most recently watched lesson with progress bar and Resume button preserving exact playback timestamp (`?t=[last_position_sec]`).       - "My courses" grid with percentage progress bar, completed badge, and continue action.       - Next steps list (next 3 unfinished lessons) and personalized recommended published course.       - Accessible empty state for students without enrollments, linking to the course catalog.     
- **Sub-pages**:       - `/dashboard/formations`: Complete list of enrolled courses with progress tracking and direct lesson access.       - `/dashboard/certificats`: Official earned certificates with PDF download (`/api/certificates/[code]/pdf`) and public verification link (`/verifier/[code]`).       - `/dashboard/paiements`: Complete ledger of student orders, validation status (Validé / En attente / Échoué), and PDF receipt downloads.       - `/dashboard/profil`: Personal profile editor (full name, Haitian phone, language preference FR/KR) and password change form with Zod validation.     
- **Automatic Certificate Issuance & Verification**:       - Database migration `20250104000000_certificates_and_progress.sql` with trigger `trg_issue_certificate_on_completion`: when a student completes 100% of the lessons in a course, exactly one unique certificate (`LA-[8-char-code]`) is created atomically.       - TypeScript helper `checkAndIssueCertificate` in `src/lib/certificates.ts`.       - Public certificate validation route `/[locale]/verifier/[code]`: verifies authenticity against database without requiring login, displaying graduate name, course, issue date, and official seal.       - PDF certificate generator `GET /api/certificates/[code]/pdf`: elegant landscape A4 certificate via `pdf-lib` with border, signatures, and online verification link.

15. **Protected Video Lesson Player Architecture (Page 08)**:   - Route `/[locale]/dashboard/learn/[courseSlug]/[lessonId]`:     
- **Access Guard**: Rigorous server-side verification via `checkLessonAccess(lessonId, userId)`. Unauthenticated visitors or non-enrolled students are denied access and redirected to the course presentation page (`/formations/[courseSlug]`). Raw video IDs and storage URLs are never exposed in public markup.     
- **Dynamic DRM & Watermarking Protection**:       - Floating semi-transparent watermark displaying student name and phone number (`${userName} • ${userPhone}`). Moves to a new random position every 15 to 30 seconds.       - Rendered in DOM above video and persisted in fullscreen mode via full-container fullscreen API.       - Disables right-click context menu on player container (`onContextMenu={e => e.preventDefault()}`), excludes download buttons, and omits download attributes.       - Open code comment acknowledging that dynamic watermarking provides strong deterrence and social accountability against unauthorized redistribution, though no client-side technology can prevent external camera recording.     
- **Multi-Device Session Enforcement**:       - Registers device ID (`faro_device_id` cookie) and sends heartbeat every 30 seconds (`POST /api/video/session/heartbeat`).       - Blocks playback when the account already has 2 active other devices within 90 seconds, displaying a localized modal with an action to terminate remote sessions (`POST /api/video/session/terminate-others`).       - Silent token renewal every 45 minutes to prevent stream cutoffs during long study sessions.     
- **Interactive Player Features & Navigation**:       - Variable playback speed (0.75x, 1x, 1.25x, 1.5x, 2x), auto quality streaming, resume from `last_position_sec`.       - Automatic progress saving (`POST /api/video/progress`) debounced every 10 seconds and on pause.       - Auto-complete at 90% watched with a 5-second cancellable countdown to the next lesson.       - Completion banner on final lesson linking directly to the official certificate.       - Keyboard shortcuts: Space (play/pause), Left/Right arrows (seek ±5s), N (next lesson).     
- **Tabs & Course Curriculum**:       - Tabs: Lesson Description, Resources (downloadable through signed URLs `GET /api/video/resources/[id]/download`), and Private Notes (`lesson_notes` table created via migration `20250105000000_lesson_notes.sql` with auto-saving).       - Right-side curriculum drawer on mobile and persistent sidebar on desktop with completion checkmarks and instant lesson navigation.16. **Admin Dashboard & Aggregation Architecture (Page 09)**:    - Route `/[locale]/admin`:      
- **Strict Two-Tier Admin Guard**: Enforced at the Edge in `src/middleware.ts` (redirecting non-admins to `/[locale]/dashboard` and unauthenticated visitors to `/[locale]/connexion`), and enforced server-side via `requireAdmin(locale)` in `(admin)/layout.tsx` and all page components and server actions.      
- **Shared Admin Layout & Scrolling Architecture**:        - Outer wrapper has fixed viewport height on desktop (`md:h-screen md:h-[100dvh] md:overflow-hidden`).        - Stationary 260px navy sidebar (`w-[260px] shrink-0 h-full bg-navy-deep`) with 7 items: Tableau de bord (`/admin`), Formations (`/admin/formations`), Élèves (`/admin/eleves`), Paiements (`/admin/paiements`), Promotions (`/admin/promotions`), Messages (`/admin/messages`), Paramètres (`/admin/parametres`).        - Sidebar remains stationary on the left while dashboard content scrolls independently (`flex-1 min-w-0 h-full md:overflow-y-auto`).        - Internal sidebar scrolling: only the navigation list scrolls internally if viewport height is restricted; logo and admin badge stay pinned at the top, and instructor profile/site links stay pinned at the bottom.        - Mobile layout (< 768px): desktop sidebar hidden, top header bar fixed with accessible drawer overlay, zero horizontal scroll at 390px.        - Admin user initials, name, role badge (`ADMIN`), language switcher (FR/KR), and public site link.      
- **Period Selector**:        - Toggle between "Ce mois-ci" (`this_month`), "30 derniers jours" (`last_30_days`), and "Cette année" (`this_year`).      
- **Aggregated KPI Cards**:        - Revenue: Sum of validated payments in HTG integer only + percentage change vs previous period.        - New Students: Count of student registrations in period + percentage change vs previous period.        - Payments Awaiting Validation: Count of pending manual transactions linking directly to `/admin/paiements`.        - Completion Rate: Certificates issued / enrollments ratio + change vs previous period.      
- **12-Month Revenue Chart**:        - Responsive stacked bar chart displaying monthly revenue split between MonCash and NatCash in HTG integer amounts, with interactive hover tooltips and legend.      
- **Top Courses**:        - Ranked progress bars showing student counts and relative enrollment share per course.      
- **Latest 10 Payments Table**:        - Student contact info, course title, provider badge (MonCash/NatCash), amount in HTG, status badge (Validé, À valider, En attente, Échoué), and timestamp.      
- **Database Performance & Aggregations**:        - Database migration `20250106000000_admin_dashboard_aggregations.sql` defines RPC functions (`get_admin_dashboard_kpis`, `get_admin_revenue_12months`, `get_admin_top_courses`, `get_admin_recent_payments`) to perform server-side SQL grouping without loading full tables into Node memory.        - Zero-latency mock fallback ensures instant (< 1 second) rendering during development, offline tests, and builds.17. **Course Management & Curriculum Builder Architecture (Page 10)**:    - Routes:      - `/[locale]/admin/formations`: Course catalog list with search by title/slug, status filters (All/Published/Draft), cover preview, price (HTG integer), student enrollment counts, total revenue, and actions (edit, publish/unpublish, duplicate, delete).      - `/[locale]/admin/formations/new`: Course creation form.      - `/[locale]/admin/formations/[id]/edit`: Course edit form reusing the exact same comprehensive form component (`CourseFormClient`).    
- **Form Architecture (5 Structured Sections)**:      1. *General*: Title FR and KR, auto-generated editable slug with uniqueness checks, description FR & KR, category dropdown, level dropdown.      2. *Price*: `price_htg` (integer), optional `compare_price_htg`, and visual availability toggles for MonCash and NatCash.      3. *Cover image*: Direct upload with live preview, validated size limit <= 3 MB, JPG/PNG/WEBP only (`/api/admin/upload/cover`).      4. *Curriculum builder*: Add, rename, delete, and reorder modules and lessons (tactile up/down buttons and drag controls). Each lesson features title FR/KR, description, free-preview toggle (`is_free_preview`), downloadable resources upload, and direct browser video upload.      5. *Options*: Certificate on completion toggle, lifetime access toggle, and 7-day money-back guarantee setting (stored in `options` JSONB column added via migration `20250107000000_course_options_and_management.sql`).    
- **Direct Browser Video Upload Architecture**:      - Client requests a signed upload URL via `POST /api/admin/video/direct-upload` with server-side admin guard.      - Never streams heavy video files through Next.js / Edge Worker server memory.      - Displays real-time progress bar with cancel capability, storing `video_id` and duration directly on lesson state.      - In zero-credential MOCK mode, provides simulated fast upload with mock video IDs.    
- **Security & Business Rules**:      - Strict Role Verification: Every route and server action under `/admin` enforces `role === 'admin'` via `assertAdmin()` / `requireAdmin()`.      - Strict Publication Rules: A course cannot be published without title FR (>= 3 chars), price > 0, cover image, and at least one lesson across its modules.      - Deletion Protection: Deleting a course with active enrollments is strictly blocked; admins are prompted to unpublish instead.      - Atomic Reordering: Module and lesson position values are persisted as 1-based integers atomically.18. **Admin Payments Ledger & Audit Architecture (Page 11)**:    - Route: `/[locale]/admin/paiements`:      
- **Strict Role Verification**: Access to the route, server actions (`validatePaymentAction`, `rejectPaymentAction`), and the API endpoint (`/api/admin/payments/[id]/validate`) strictly requires `role === 'admin'` via `requireAdmin(locale)` / `assertAdmin()`. Unauthenticated requests redirect to `/connexion`, student accounts are redirected or rejected with HTTP 403 Forbidden.      
- **KPI Summary Row**:        - Total Validated: Sum of validated payments in integer HTG.        - Awaiting Validation: Real-time count of pending manual verification items.        - MonCash Total: Revenue collected through MonCash gateway in HTG.        - NatCash Total: Revenue collected through manual NatCash verification in HTG.      
- **Status Tabs & Interactive Ledger**:        - Tabs: All (`all`), Awaiting validation (`awaiting_validation`), Validated (`validated`), and Failed (`failed`).        - Interactive Search: Instant client-side or server query by student name, phone number, or provider transaction reference.        - Paginated Table: Student info, course title, provider badge (MonCash vs NatCash), provider transaction ID, whole HTG amount, creation timestamp, localized status badge, and contextual actions.      
- **Payment Validation & Rejection Modals**:        - Validation Modal: Displays complete order details, recipient phone, and transaction ID. Automatically checks for duplicate transaction IDs across previously validated orders with a high-visibility warning alert. Includes an optional internal administrative note input.        - Rejection Modal: Displays order reference and strictly requires a mandatory rejection reason before submitting.      
- **Idempotency & Database Trigger Guarantee**:        - Setting `payments.status = 'validated'` invokes the database trigger `handle_payment_validation` which marks `orders.status = 'paid'` and inserts `enrollments(user_id, course_id) ON CONFLICT (user_id, course_id) DO NOTHING`. Validating multiple times is strictly idempotent and never creates duplicate enrollments.        - Migration `20250108000000_admin_payments_and_audit_logs.sql` introduces the `admin_audit_logs` table (`id`, `admin_id`, `action`, `payment_id`, `note`, `metadata`, `created_at`), recording immutable logs for every manual approval or rejection.        - Optional notification dispatch hook sends student notifications if `ENABLE_NOTIFICATION_DISPATCH` is enabled.      
- **CSV Export**:        - One-click export downloading the filtered payment dataset formatted as a standard CSV with localized column headers and ISO/HTG values.      
- **Design & Language Integrity**:        - Strict usage of design tokens (`tokens.css`), zero hardcoded inline hex colors, all amounts formatted as integer HTG, and full bilingual French (`FR`) and Haitian Creole (`KR`) translations.19. **Admin Students, Promotions, and Messages Management (Routes /admin/eleves, /admin/promotions, /admin/messages)**:    
- **Student Management (`/[locale]/admin/eleves`)**:      - Searchable, paginated directory with metrics: Total registered students, Active enrollments, and Average courses per student.      - Detail Drawer (`AdminStudentsClient`):        - Student profile header with initials avatar, email, phone, and registration timestamp.        - Tab "Formations & Accès": lists all enrolled courses with direct access to "Révoquer l'accès". Includes a manual grant form ("Accorder une formation manuellement") with course dropdown selector and internal admin note.        - Tab "Paiements & Commandes": chronological history of transactions with provider badges (MonCash/NatCash) and status badges.      - Server actions `grantCourseAccessAction` and `revokeCourseAccessAction` enforce `role === 'admin'` via `assertAdmin()`.      - Database Integrity & Audit Logging: Manual access grant upserts directly into `public.enrollments(user_id, course_id, note, granted_by)`, and writes audit events (`grant_course_access`, `revoke_course_access`) to `public.admin_audit_logs`. The granted course appears immediately in the student's dashboard and courses tab.    
- **Coupons & Promotions Management (`/[locale]/admin/promotions`)**:      - Metrics tiles for active coupons and total usages.      - Searchable ledger displaying promo code with copy button, discount badge (percentage `-X%` or fixed `-X HTG`), usage progress (`used_count / max_uses`), expiration date, and instant active toggle switch.      - Interactive Create/Edit modal validated with Zod: supports uppercase alphanumeric codes, percentage (1-100%) or fixed HTG amounts, optional maximum usage limit, optional expiration date, and initial active status.      - Server actions (`saveCouponAction`, `toggleCouponActiveAction`, `deleteCouponAction`) enforce admin authorization, synchronize database and fallback cache, and log audit entries.      - Seamless Checkout Integration: `/api/coupons/validate` evaluates both database and active cache stores, verifying active status and expiration; any promo code created here is instantly recognized and accepted during student checkout.    
- **Contact Messages Inbox (`/[locale]/admin/messages`)**:      - Unified inbox for inquiries submitted via the public contact form (`contact_messages` table).      - Status filter tabs: Tous (All), Non lus (Unread), and Lus (Read) with real-time unread counter badge.      - Search bar filtering by sender name, contact detail, or message text.      - Message cards displaying sender info, contact badge, timestamp, unread indicator dot, and full message content.      - One-click actions:        - "Reponn sou WhatsApp" / "Répondre sur WhatsApp": automatically formats Haitian phone numbers (`+509...` or 8 digits to `509...`) and generates direct `wa.me/<number>?text=...` conversation links.        - "Reponn pa imel" / "Répondre par email": opens mailto link for email contacts.        - "Marquer comme lu / non lu": toggle action updating `read` and `read_at` via `toggleMessageReadAction`.        - "Supprimer": confirmation modal calling `deleteMessageAction` with audit logging.    
- **Database Migration (`20250109000000_admin_students_promotions_messages.sql`)**:      - Extends `profiles` with `email` column and updates `handle_new_user()` trigger.      - Extends `coupons` with `is_active` and `created_at`.      - Extends `contact_messages` with `read` (boolean) and `read_at` (timestamptz).      - Extends `enrollments` with `note` and `granted_by`.      - Extends `admin_audit_logs` with `user_id` and `course_id`.21. **Instructor Role & Centralized Permissions System (`profiles.role`, `instructors` table, `src/lib/permissions.ts`)**:    
- **Database Migration (`20250111000000_instructor_role.sql`)**:      - `profiles.role` type extended to `'student' | 'instructor' | 'admin'`.      - Added `profiles.display_name`, `avatar_url`, `last_seen_at`, `muted_until` (timestamptz), and `banned_at` (timestamptz).      - Table `instructors` (`profile_id` pk references profiles, `title`, `bio`, `escalation_email`, `is_active` bool).      - Table `courses.instructor_id` referencing `profiles(id)`.    
- **Central Permissions (`src/lib/permissions.ts`)**:      - `can(user, action, resource?)` function and `requireRole(allowedRoles, locale, redirectPath)` route/action guard.      - Permissions defined for: `course.manage`, `course.publish`, `course.change_instructor`, `students.view`, `admin.dashboard`, `instructor.dashboard`, `payments.view`, `promotions.manage`, `instructors.manage`, `community.moderate`, `community.pin`, `ai.configure`.22. **Faro School Community Architecture (Routes /dashboard/communaute, /admin/communaute, /regles-communaute)**:    
- **Model & WhatsApp-Style Global Conversation**:      - ONE single global conversation group where all authenticated students, instructors, and administrators interact collaboratively.      - Dedicated schema in `supabase/migrations/20250112000000_community_schema.sql`:        - `community_messages`: `(id, author_id, body max 2000, attachment_url, reply_to_id, pinned, pinned_at, deleted_at, created_at)`.        - `community_reactions`: `(id, message_id, user_id, emoji, created_at)` with unique constraint on `(message_id, user_id, emoji)`.        - `community_reports`: `(id, message_id, reporter_id, reason, status, created_at)`.        - `community_reads`: `(id, user_id, last_read_at)`.        - `community_rules_accepted`: `(id, user_id, accepted_at)`.      - Supabase Row Level Security (RLS) policies + Realtime publication enabled for instant reactive messaging.    
- **Safety & Moderation Layer**:      
- **Rate Limiting**: In-memory sliding window enforcing maximum 5 messages per 10 seconds and 100 messages per hour.      
- **Link Protection**: Accounts under 24 hours old are strictly blocked from posting external URLs (`containsUrl`).      
- **Bilingual Profanity & Scam Filter (`src/lib/community/word-filter.ts`)**: Blocks offensive terms and scam patterns in both French and Haitian Creole (e.g. `connard`, `tenten`, `fatra`, `salopri`, `gagner argent facile`, etc.).      
- **Soft Deletion**: Author can delete their own message within 5 minutes of creation; administrators can delete any message at any time.      
- **Pinning & Unpinning**: Instructors and administrators can pin important announcements, which appear in a sticky dismissal-friendly banner at the top of the chat view.      
- **Administrative Sanctions**: Admins can mute users (1h, 24h, 7d) or ban them from the community, recorded with audit log entries in `admin_audit_logs`.      
- **Reporting**: Any user can report inappropriate messages with a selectable reason category.      
- **Privacy Guarantee**: Student emails and phone numbers are never rendered in chat headers or bubbles; only verified display names or full names are surfaced.    
- **UI & WhatsApp Experience (`CommunityChatView.tsx`)**:      - Two-panel responsive layout matching mockup `media_1793130150552_a6563168.jpg`:        - Left Panel: Search bar, pinned group item with last message snippet and unread badge, center informational graphic ("Une seule conversation de groupe"), and bottom info note with "Contacter le formateur" guidance.        - Right Panel: Header with online presence indicator ("142 en ligne"), search toggle, info modal trigger, sticky pinned banner, day-grouped message stream with infinite upward scroll, reactions pills with counts, reply preview chips, composer with image attachment (<3MB), emoji picker, @mention autocomplete, and double check ticks for own messages.      - First-visit Community Rules Modal requiring explicit checkbox acceptance before posting.23. **Private Messaging Architecture between Student and Staff with AI Assistant, Presence, Escalations & 2-Minute Rule (Routes /dashboard/messages, /admin/messages/[id], /api/cron/escalations)**:    
- **Database Migration (`20250113000000_private_messaging_schema.sql`)**:      - `conversations`: `(id, student_id, staff_id, course_id, subject, status ['open','ai_handling','waiting_staff','staff_replied','closed'], created_at, last_message_at)` with participant inequality check `student_id != staff_id`.      - `messages`: `(id, conversation_id, sender_type ['student','staff','ai','system'], sender_id, body, meta jsonb, created_at, read_at)`.      - `escalations`: `(id, conversation_id, trigger_message_id, reason, email_status ['pending','sent','failed'], deadline_at, resolved_at, followup_sent_at, created_at)`.      - `ai_usage`: `(id, conversation_id, model, input_tokens, output_tokens, created_at)`.      - `notifications`: `(id, user_id, type, payload jsonb, read_at, created_at)`.      - `instructors` extensions: `is_available` (bool), `ai_enabled` (bool), `ai_settings` (jsonb).    
- **Hard Constraints & RLS Enforced at Database Level**:      - Database trigger `validate_conversation_participants` enforces:        1. `student_id` strictly has `role = 'student'`.        2. `staff_id` strictly has `role IN ('instructor', 'admin')`.        3. A student cannot open or read a conversation with another student.        4. If `course_id` is specified, the student must be enrolled in that course, and `staff_id` must be the course instructor (or an admin).        5. If `course_id` is null (general question), `staff_id` must be an admin.      - Instructors only read conversations where `staff_id = auth.uid()`.      - Admins read own conversations directly, and other conversations exclusively through audit-logged review (`admin_audit_logs`).    
- **Heartbeat & Staff Online Presence (`src/lib/messaging/presence.ts`)**:      - Staff client dispatches `staffHeartbeatAction()` every 30 seconds.      - The server validates `role IN ('instructor', 'admin')` before updating `profiles.last_seen_at`.      - A client can never mark another user, or spoof themselves as staff, online.      - Online criteria: seen within 90 seconds AND `is_available = true` (via staff toggle `StaffAvailabilityToggle.tsx`).      - Visual indicator: green dot + "En ligne" or gray dot + "Hors ligne" in chat header.    
- **Flow (Server-Side, Idempotent, Retry-Safe)**:      1. Student message arrives: if staff member is online, delivered live with in-app notification. AI stays silent.      2. If staff is offline and AI is enabled: calls the Anthropic Claude API (`src/lib/messaging/ai-assistant.ts`) with course context. Confident answer posted as AI message (`sender_type = 'ai'`), visibly labeled `"Assistant IA de {nom du formateur}"`.      3. If AI cannot answer confidently, question is out-of-scope (payments, refunds, certificates, complaints, or instructor's always-escalate list), or student asks for a human:         - System message posted informing student.         - Escalation record created with `deadline_at = NOW() + 2 minutes` and status `'waiting_staff'`.         - Escalation email sent via Resend (`src/lib/messaging/email.ts`) to instructor's `escalation_email` (or admin fallback) with direct link.      4. Scheduled job (`/api/cron/escalations`): every minute, scans escalations past deadline where staff is still offline with no reply, posts ONE bilingual system message in FR and KR (*"Le formateur n'est pas en ligne pour le moment. Reviens plus tard, quand il sera en ligne. Tu recevras une notification dès sa réponse."*), and sets `followup_sent_at` so it is never sent twice.      5. When staff joins or replies: escalation resolved, system message *"Le formateur a rejoint la conversation"* posted, and AI ceases answering in this conversation.    
- **Prompt Injection & Safety Defense**:      - Student inputs and retrieved snippets treated strictly as untrusted data.      - Strict instructions forbidding prompt leaks, role changes, or promises of refunds/certificates.      - Rate limit: 1 call per 2 seconds, max 30 AI replies per student per day, global daily cap, and admin kill switch.    
- **Entry Points**:      1. Community chat header: "Contacter le formateur" button.      2. Video lesson player top bar: "Contacter le formateur" button.      3. Student dashboard navigation sidebar: "Messages du formateur" menu item with unread badge (`StudentDashboardShell.tsx`).    
- **Decisions**:      1. *Scheduled 2-minute rule job*: Implemented as an internal API endpoint `POST /api/cron/escalations` secured via `Bearer <CRON_SECRET>`. It can be invoked via Cloudflare Cron Triggers or Supabase `pg_cron`.      2. *AI Provider*: Anthropic Claude API via pure server-side `fetch` (ensures 100% compatibility with Cloudflare Workers runtime).      3. *Transactional Email*: Resend API via server-side fetch with bilingual HTML templates and Faro School logo.    
- **Required Production Configuration**:      - `ANTHROPIC_API_KEY`: Anthropic Claude API key.      - `AI_MODEL`: Claude model (default: `claude-3-haiku-20240307`).      - `RESEND_API_KEY`: Resend API key for escalation emails.      - `MAIL_FROM`: Verified sender email address (e.g., `Faro School <notifications@faroschool.com>`).      - `CRON_SECRET`: Secret token for calling `/api/cron/escalations`.      - DNS records: Configure SPF (`v=spf1 include:resend.com ~all`) and DKIM TXT records in domain DNS according to Resend instructions.24. **Instructor Workspace & AI Assistant Customization (P19 - Routes /admin/tableau-de-bord, /admin/eleves, /admin/messages, /admin/assistant-ia, /admin/communaute, /admin/formations)**:    
- **Pedagogical Dashboard (`/admin/tableau-de-bord`)**:      - Computes strictly pedagogical KPIs for instructor's assigned courses: Apprenants (`studentsCount`), Progression moyenne (`averageProgressPercent`), Taux de complétion (`completionRatePercent`), Échanges non lus (`unreadConversationsCount`), Escalades en attente (`escalationsWaitingCount`).      - Absolute business guard: Zero financial revenue, orders, payments, coupons or promotional codes exposed to instructors.      - Student activity stream: real-time feeds on lesson completions and enrollments.    
- **Student Privacy & Mes Élèves (`/admin/eleves`)**:      - Instructors only see students enrolled in their own courses.      
- **Strict Privacy Rule**: Email address and phone number are completely withheld from instructors. All communications link directly to secure private messaging (`/admin/messages?new=1&studentId=...`).      - In the 480px Student Detail Drawer: contact details and payment history tabs are hidden for instructors; manual grant/revoke access is restricted to administrators only.    
- **Pedagogical Messages & AI Takeover (`/admin/messages`)**:      - Two-panel responsive inbox with status badges: `En attente` (waiting_staff / open), `IA a répondu` (ai_handling), `Répondu` (staff_replied), `Clôturé` (closed).      - Thread viewer displaying AI messages visibly labeled with model and confidence score.      - Quick replies bar: 4 one-click chips in French and Haitian Creole ("Consulte le chapitre 2", "Regarde la ressource téléchargeable", etc.).      - Composer allows instant instructor takeover (auto-transitions status to `staff_replied`).      - Student course progress pill dynamically displayed in thread header.      - Actions: Close discussion (`status = 'closed'`), Reopen discussion, and Start conversation modal with any enrolled student.    
- **Instructor AI Assistant Configuration & Sandbox (`/admin/assistant-ia`)**:      
- **Settings**: Master toggle, name, pedagogical tone (friendly, professional, concise), bilingual options (FR, KR), custom greeting, free-text instructions (up to 4,000 chars), knowledge base (FAQ Q&A pairs + text snippets), always-escalate keywords list, confidence threshold slider (50% to 95%), and escalation email.      
- **Isolation Guard**: Instructors can only view and mutate their own AI settings (`instructorId = user.id`); admins can audit and manage all.      
- **Supreme Platform Safety Guard**: Fixed platform safety rules (no refunds, no free certificates, no prompt overrides) are strictly appended last and can NEVER be bypassed by instructor instructions.      
- **Version History & 1-Click Restore**: Table `instructor_ai_versions` and PL/pgSQL function `save_instructor_ai_version` keep the last 5 versions per instructor with instant 1-click restore.      
- **Sandbox Live Test**: Interactive test chat allowing instructors to test queries and view response or escalation rationale without modifying production records.    
- **Availability & Online Presence**:      - Sticky top header bar integrated in `AdminLayoutClient.tsx` featuring `<StaffAvailabilityToggle />` with real-time heartbeat and presence sync.25. **Admin Community Moderation & Messaging Supervision (P20 - Routes `/admin/moderation` and `/admin/messagerie`)**:    
- **Community Moderation Queue & Sanctions (`/admin/moderation`)**:      
- **Reports Queue**: Visual list of reported messages showing message context, author, reporter, reported reason, and actionable controls:        - `Delete Message`: Soft-deletes message with audit trail.        - `Mute Author`: 1-click modal selecting duration (1h, 24h, 7 days) and mandatory reason, setting `muted_until` on `profiles`.        - `Ban Author`: Permanently marks `banned_at` on `profiles`, immediately terminating user access to community and chat.        - `Dismiss Report`: Marks report as reviewed/dismissed.      
- **Muted & Banned Users Management**: Comprehensive list of active sanctions with automatic expiration detection (`muted_until > NOW()`) and 1-click unmute/unban restoration.      
- **Bilingual Dynamic Word Filter**: Admin editor for French and Haitian Creole blocked words and patterns stored in `platform_settings` table, automatically injected into `checkProfanity()`.      
- **Community Rules Editor**: Bilingual markdown editor for official platform rules (FR and KR) stored in `platform_settings`.      
- **Audit Log Trail**: Complete historical view of all moderation actions from `admin_audit_logs`.    
- **Messaging Supervision & Platform AI Control (`/admin/messagerie`)**:      
- **Master Kill Switch**: Global one-click emergency banner and action `toggleAiKillSwitchAction()`. When active, immediately halts all AI responses platform-wide. Student messages smoothly fallback to the 2-minute escalation rule, alerting human staff via email.      
- **Key Metrics Dashboard**: Real-time KPIs tracking Total conversations, Median instructor response time, AI resolution rate (% questions handled without human intervention), Escalations waiting count & "reviens plus tard" followup cases, and Daily AI token usage & cost (USD).      
- **Break-Glass Privacy Safeguard for Private Conversations**:        - Student private messages are strictly isolated from standard viewing.        - Admins cannot browse private instructor-student conversations unless triggered by an active report or escalation context.        - Mandatory written justification (minimum 10 characters) is required to unlock conversation details.        - Every inspection is irrevocably written to `private_conversation_access_logs` and `admin_audit_logs`.        - Student Privacy Policy (`/[locale]/confidentialite` in French and Haitian Creole) explicitly documents this break-glass procedure.      
- **Direct Student Messaging**: Admin modal allowing staff to initiate a private conversation with any student across the platform.      
- **Global AI Configuration**: Platform-wide settings for default Anthropic model (`claude-3-haiku-20240307`), global confidence threshold, daily cost cap, and per-student daily limits.    
- **Access Control & Permissions**:      - Enforced strictly via `can(user, 'community.moderate')` and `can(user, 'ai.configure')` in `src/lib/permissions.ts`.      - Instructors and students are barred by `requireAdmin(locale)` and RLS policies; instructors only retain `community.pin`.      - Admin navigation sidebar dynamically displays `Modération` and `Supervision IA` tabs exclusively for admin role.26. **Visual Polish & Design System Alignment (P17 Community, P18 Private Messaging, P19 Instructor Workspace, P20 Moderation & Supervision)**:    
- **Visual Reference Alignment (`media_1793130150552_a6563168.jpg`)**:      - Two distinct white panels with 20px border-radius (`rounded-[20px]`), border `border-line/60`, and soft shadow (`shadow-sm`).      - Left panel (~400px): Navy circle icon, title "Communauté", subtitle "Discussions de la communauté Faro School", pill search input (`bg-slate-panel`), single group conversation item with blue tint (`bg-blue-tint`), pin icon, timestamp, and orange unread count badge. Center empty-state illustration ("Une seule conversation de groupe"), and bottom blue-tint note box with Info icon.      - Right panel: Header with member count (2,548 membres · Communauté officielle), outline orange button "Contacter le formateur" with `GraduationCap` icon, info circle, search, and more action buttons.      - Pinned message banner with orange pushpin, message snippet, and close button.      - Message stream with subtle background pattern (`bg-chat-bg bg-[radial-gradient(#E2E8F0_1px,transparent_1px)]`).      - White bubbles (16px radius), author names with WCAG AA compliant colors (`text-indigo-600`, `text-purple-700`, `text-blue-600`, etc.), `ADMIN` orange pill, `FORMATEUR` badge with verified checkmark.      - Own messages right-aligned in light green bubble (`bg-chat-bubble-own`, `#DCF8C6`) with green double checkmarks (`✓✓`).      - Composer with outline plus (+) button, pill input container (`bg-slate-panel`) with Smile emoji and disabled mic button, and round solid orange send button with paper-plane icon (`bg-orange shadow-orange text-white`).    
- **Student Sidebar & Top Bar (`StudentDashboardShell.tsx`)**:      - Sidebar on deep navy (`bg-navy-deep`), on-dark logo, uppercase "ÉTUDIANT" label, active navigation item styled as an orange rounded pill with white text and `shadow-orange`.      - Feature flags for unbuilt pages (`Apprentissage`, `Favoris`) hiding them gracefully.      - "Mon compte" navigation group: Profil, Paramètres, Aide (WhatsApp link), and Déconnexion.      - Top bar: "Bonjour, {prenom} ! 👋", notification bell with orange unread dot, and user avatar chip with name, role, and chevron.    
- **Private Messaging & Staff Views**:      - Private chat (`StudentStaffChatView.tsx`) reuses the two-panel architecture with AI messages in orange-tint bubbles, "IA" badge with sparkles, instructor presence indicator (green "En ligne" / gray "Hors ligne"), and centered pill system messages.      - Instructor Inbox (`/admin/messages`) and AI Settings (`/admin/assistant-ia`) aligned with 20px radius cards, semantic badges, and sandbox tester panel.      - Moderation Queue (`/admin/moderation`) and Messaging Supervision (`/admin/messagerie`) styled with clean data tables and kill switch banners.    
- **Tokens & Zero Hard-Coded Colors Rule**:      - Added `--chat-bubble-own`, `--chat-bg`, `--slate-panel` in `src/styles/tokens.css` and mapped them in `tailwind.config.ts`.      - 100% adherence to Design System tokens (zero hard-coded hex colors in TSX/JSX).      - All text/background contrast pairings pass WCAG AA standards.      - Fully responsive at 1440px desktop, 768px tablet, and 390px mobile with zero layout shift.

27. **Mobile Bottom Navigation Rebuild & Student Area Visual Polish**:
    
- **Mobile Bottom Navigation Rebuild (`StudentDashboardShell.tsx`)**:
      - Rebuilt as a solid white bar (`bg-white border-t border-line/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]`) at `h-[64px]` with safe area inset padding (`pb-[env(safe-area-inset-bottom)]`).
      - High contrast WCAG AA compliant navigation with 5 distinct tabs: Accueil (`Akèy`), Formations (`Fòmasyon`), Communauté (`Kominote`), Messages (`Mesaj`), Profil (`Pwofil`).
      - Active tab: deep navy (`text-navy-deep`), 3px top orange indicator bar, and subtle orange tint pill (`bg-orange-tint/60`).
      - Inactive tabs: high-contrast `text-muted-faro` (contrast ratio 5.1:1 on white).
      - Red circle unread badges: 12 on Communauté, 1 on Messages (`bg-red text-white`).
      - Fixed container layout to `h-[100dvh] max-h-[100dvh] overflow-hidden` with `visualViewport` keyboard awareness, ensuring the composer is never obscured by the bottom bar.
    
- **14 Visual Bug Fixes Across Student Area**:
      1. *Mobile bottom nav unreadable*: Replaced faint glassmorphic bar with solid white bar and high-contrast typography.
      2. *Bottom nav covers composer*: Main container flex architecture ensures chat composer sits directly above bottom bar.
      3. *Avatars*: Top-aligned (`items-start`) 32px circle avatars with deep navy background (`bg-navy-deep`) and bold white initials (`FS`, `DL`).
      4. *Oversized bubbles*: Scaled to 15px font, 1.4 line-height, compact padding (`px-3.5 py-2 sm:px-4 sm:py-2.5`), max-width 82% on mobile.
      5. *Sender line wrapping*: Cleaned redundant `(Formateur)` suffix from name to keep author, verified checkmark, and orange role badge on a single line.
      6. *Header truncation*: Mobile header displays `Communauté` and `2 548 membres` without ellipsis, alongside a compact 44px tap target `Formateur` button and menu button (⋮).
      7. & 8. *Connection banner stuck*: Suppressed false-positive offline banner; now displays as a slim 32px strip (`role="status"`) only after a continuous connection drop > 3 seconds, disappearing automatically upon reconnect.
      9. *Sidebar label truncated*: Widened desktop sidebar to 285px (`w-[285px]` with `p-4`) so "Messages du formateur" fits on one line with 0 truncation.
      10. *Number formatting*: Formatted numbers with space grouping (`2 548`) via active locale `Intl.NumberFormat`.
      11. *Consecutive message grouping*: Consecutive messages by the same author group with tighter spacing (`mt-1.5`), omitting repeated avatar and author line.
      12. *Hyphenated @mention highlighting*: Enhanced regex to support hyphens and periods (e.g., `@Marie-Claude L.`) with `bg-ok-tint` and `text-ok`.
      13. *Date separators & reaction chips*: Dynamic day separator chips (`formatDateSeparator`), and 28px height (`h-7`) reaction chips positioned tight under bubbles (`mt-1 -translate-y-0.5`).
      14. *Own messages & pinned bar*: Light green own bubbles (`bg-chat-bubble-own`, `#DCF8C6`) with green double checkmarks (`✓✓`), single-line pinned message banner with tap-to-expand.
    
- **Tokens & Zero Hard-Coded Colors Rule**:
      - Verified zero hard-coded hex colors in application TSX/JSX components.
      - 100% build pass across all 78 routes with Next.js 15 App Router.

28. **Progressive Web App (PWA) Architecture & Standalone Mobile Experience**:
    - **PWA Entry Route (`/app`)**:
      - Server-side redirect endpoint (`src/app/app/route.ts`) executing with zero client flash.
      - Resolves user session via `faro_session`:
        - Unauthenticated: redirects to `/[locale]/connexion` (preserving `?next=`).
        - Authenticated student: redirects to `/[locale]/dashboard`.
        - Authenticated instructor: redirects to `/[locale]/admin/tableau-de-bord`.
        - Authenticated admin: redirects to `/[locale]/admin`.
      - Resolves active locale from cookie `faro_locale`, falling back to `Accept-Language` header, and defaulting to `fr`.
      - Automatically sets a long-lived persistent cookie `faro_display=standalone` (365 days) on entry.
    - **Strict Protection Against Marketing Landing in PWA**:
      - Middleware (`src/middleware.ts`) detects `faro_display=standalone` or query param `source=pwa`.
      - Whenever detected, requests to landing routes (`/`, `/fr`, `/fr/`, `/ht`, `/ht/`) are intercepted and immediately redirected to `/app`.
      - `SiteHeader.tsx`: In standalone mode, replaces the marketing navigation with an App Header featuring the Faro School logo linking to `/app`, back button, language switcher, and active workspace link.
      - `SiteFooter.tsx`: In standalone mode, renders `null` to eliminate marketing links inside the installed mobile app.
      - `StudentDashboardShell.tsx`: Top logo links directly to the student dashboard (`/[locale]/dashboard`), preventing accidental navigation to marketing pages.
    - **Web App Manifest (`/manifest.webmanifest` & `src/app/manifest.ts`)**:
      - Identity: `name: "Faro School"`, `short_name: "Faro"`, `id: "/app"`, `start_url: "/app?source=pwa"`, `scope: "/"`.
      - Display & Theme: `display: "standalone"`, `orientation: "portrait-primary"`, `theme_color: "#031047"`, `background_color: "#FFFFFF"`.
      - Icons: Official Faro School icons imported from `public/icons/` (`icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon-180.png`).
      - Shortcuts: Quick action shortcuts to Communauté (`/[locale]/dashboard/communaute`), Mes formations (`/[locale]/dashboard/formations`), and Messages (`/[locale]/dashboard/messages`).
    - **Service Worker (`public/sw.js`)**:
      - Custom lightweight service worker compatible with OpenNext Cloudflare Workers builds.
      - Versioned cache storage (`faro-pwa-v1`) with automatic pruning of obsolete caches upon activation.
      - Pre-caches core app shell, static icons, manifest, and static offline fallback (`/offline.html`).
      - Stale-while-revalidate strategy for static assets (`/_next/static/*`, `/icons/*`, images, fonts).
      - Network-first strategy for navigation requests, falling back to `/offline` if disconnected.
      - **Strict Exclusions**: Never caches or intercepts `/api/*`, auth endpoints, checkout/payments, admin or instructor areas (`/admin/*`), private messaging, Supabase Realtime / WebSocket connections, or Bunny video streams.
      - In-app update toast (`PwaUpdateToast.tsx`): Alerts users when a new service worker version is waiting, offering a 1-tap "Actualiser" reload action.
    - **Install Experience**:
      - Android & Desktop Chrome: Captures `beforeinstallprompt` event; displays dismissible banner (`PwaInstallBanner.tsx`) on login and student dashboard after 2+ visits, suppressed for 14 days upon dismissal.
      - iOS Safari: Detects iOS Safari browser and displays an instructional bottom-sheet modal (`IosInstallModal.tsx`) detailing "Partager → Sur l'écran d'accueil" in French and Haitian Creole.
      - Permanent Action: Dedicated "Installer l'application Faro" action button in student Profil (`/dashboard/profil`) and Settings (`/dashboard/parametres`).
    - **Session Persistence**:
      - Extended `faro_session` cookie duration to 30 days by default and 90 days when "Se souvenir de moi" is checked.
      - Verified logout flow cleanly purges the session cookie while keeping standalone display settings intact.
    - **Visual Verification & Artifacts**:
      - Verified production build (82 routes passed).
      - Captured mobile screenshots at 390px viewport in standalone display mode:
        - `pwa-login-390.png`: Minimalist standalone login with App Header.
        - `pwa-dashboard-390.png`: High-contrast student dashboard with bottom navigation.
        - `pwa-community-390.png`: Community chat with visible composer above safe bottom bar.
        - `pwa-offline-390.png`: Bilingual friendly offline fallback with retry button.

29. **PWA Mobile Polish, Community Chat UX, DM Permissions & Anti-Bypass Moderation**:
    - **Database Migration (`20250116000000_pwa_community_dm_moderation_fixes.sql`)**:
      - `client_message_id UUID NULL` added to `community_messages` and `messages`.
      - Unique index `idx_community_messages_client_id` on `(author_id, client_message_id)` and `idx_messages_client_id` on `(sender_id, client_message_id)` ensuring strict database-level idempotency and zero duplicate messages.
      - `moderation_flags` table storing security interception metadata (`id`, `user_id`, `channel`, `reason`, `masked_excerpt`, `status`, `created_at`).
      - Database trigger `validate_conversation_participants` updated to prevent instructors from initiating conversations with students, preserving the rule that instructors can only reply to existing threads.
    - **Student Dashboard Mobile Layout & Spacing**:
      - Single greeting ("Bonjour, Jean !") placed exclusively in page title; removed duplicate greeting from top bar.
      - On mobile (< 640px), top bar header contains only the notification bell and single `UserAvatar` (36px).
      - Reusable `UserAvatar` component (`src/components/ui/UserAvatar.tsx`) ensures uniform initials extraction and navy background across the platform, eliminating random avatar color discrepancies.
      - Body cleanup: removed floating avatar and duplicate language pill from page body (language selector centralized in top header).
      - Metric cards: consistent heights, un-truncated labels ("Formations actives", "Leçons terminées"), aligned 28px values, smaller icons in soft rounded container.
      - Compact "Continuer la formation" card: reduced mobile cover height (105px) and direct "Reprendre" button visible on 390px screens without vertical scrolling.
    - **Community Chat Refinement & Composer**:
      - Bubble sizing: 15px font, 1.45 line height, 10px 12px padding, 32px avatar, 13px author name, 11px muted timestamp.
      - Max bubble width constrained to 85% on mobile and 65% on desktop.
      - Consecutive message grouping: 8px gap between different senders, 4px between same author with avatar/name omitted on subsequent messages.
      - Small reaction pills (12px text) positioned directly beneath messages.
      - Pinned announcement bar: 1 line truncated with chevron toggle to expand/collapse and close action.
      - Message Composer: robust flex layout with "+" button, flexible input (`min-w-0`), emoji/voice actions, and round 44px orange send button (`w-11 h-11 min-w-[44px]`), guaranteed never clipped at 360px, 390px, or 430px viewports.
      - Scroll management: auto-scroll to latest message when user is at bottom; floating "Nouvo mesaj / Nouveaux messages ↓" chip when scrolled up.
      - Member Profile card in community: clicking user avatar or name displays their profile modal with "Message privé" action.
    - **Private Messaging Permissions & DM Flow**:
      - Direct messages between students controlled by feature flag `STUDENT_DM_ENABLED = true` (`src/config/messaging.ts`).
      - Admins can message any student directly.
      - Instructors strictly blocked from creating new student conversations (action hidden in UI, rejected by server action with 403, and enforced via PostgreSQL trigger).
    - **Anti-Bypass Moderation Engine (`src/lib/moderation/index.ts`)**:
      - Normalizer: transforms text to lower case, removes diacritics/accents, strips zero-width/invisible characters, normalizes look-alike characters (`@` -> `a`, `$` -> `s`, `0` -> `o`, `!` -> `i`, `|` -> `l`), and maps spelled-out numbers in French ("cinquante", "huit") and Haitian Creole ("senkant", "uit").
      - Phone detection: catches Haitian phone numbers across 8 formats (+509, 509, 8 digits, spaces, dots, dashes), international numbers, and spelled-out digits.
      - False-positive guards: preserves prices ("2 500 HTG", "50 $"), years ("2026"), chapters ("chapitre 3"), durations ("15 min"), percentages ("100%"), and standalone numbers under 7 digits.
      - Off-platform detection: intercepts WhatsApp, wa.me links, obscured phrases ("w.h.a.t.s.a.p.p", "ekri m sou zap", "contacter moi sur wa", "ekri m an prive sou whatsapp", Telegram, etc.).
      - Interception UX: blocked attempts trigger an informative notice in French and Haitian Creole without posting.
      - Privacy masking: numbers logged into `moderation_flags` are strictly masked (`+509 •• •• 12 34`), never storing raw numbers in logs or flags.
      - Auto-silence rule: 3 flags in a rolling 24-hour window automatically mutes the user for 24 hours (`muted_until = NOW() + 24h`).
      - Admin interface (`/admin/moderation`): added "Flags automatiques (Téléphone / WhatsApp)" tab featuring flag filters (open/reviewed/dismissed), masked excerpt view, and quick actions ("Marquer comme traité", "Ignorer", "Sourdine 24h").
    - **Login Page Redesign & Accessibility**:
      - Eliminated empty gap between mobile top banner and login form: form begins exactly 24px under banner (`pt-6 px-4 pb-6 sm:p-8`), fitting a 390px screen without scrolling.
      - Segmented control: equal widths (`grid grid-cols-2`), elevated white active tab with soft shadow (`shadow-card border border-line/70`).
      - Brand primary CTA: high-contrast orange button (`bg-orange hover:bg-orange-hover active:bg-orange-strong text-white shadow-orange font-heading font-bold`).
      - Clean single subtitle under title combining French and Creole ("Connexion à votre espace d'apprentissage • Byenvini ankò").
      - Password field: placeholder set to `••••••••`, password requirement hint ("Au moins 8 caractères • Omwen 8 karaktè") placed in accessible helper text under the field with `aria-describedby`.
      - Accessible password visibility toggle with localized `aria-label`.
      - Verified real links to `/cgu` and `/confidentialite`.

30. **Security Audit, Permissions Matrix Verification, Student DM Lockdown & Hardening**:
    - **Permissions Matrix & Access Control (39 Test Assertions Passing)**:
      - Validated all 12 rows of `PROJECT_CONTEXT.md` permission matrix (`course.manage`, `course.publish`, `course.change_instructor`, `students.view`, `admin.dashboard`, `instructor.dashboard`, `payments.view`, `promotions.manage`, `instructors.manage`, `community.moderate`, `community.pin`, `ai.configure`).
      - Confirmed resource-level guards: instructors can only manage/publish their own courses and view their own enrolled students; platform financial data and global AI configuration remain strictly restricted to administrators.
    - **Student-to-Student DM Lockdown**:
      - Hardened `src/config/messaging.ts` with `STUDENT_DM_ENABLED = false`.
      - Server action `createConversationAction` strictly blocks any student attempting to initiate a direct message with another student (`"Les conversations entre élèves sont strictement interdites"`).
      - Server action `sendPrivateMessageAction` verifies sender account status (`banned_at`) and rejects blocked users.
      - Database migration `20250117000000_audit_and_hardening.sql` updates `validate_conversation_participants()` trigger in PostgreSQL to enforce at database level that `student_id` is a student, `staff_id` is an instructor or admin, and student-to-student conversations are rejected unconditionally.
      - Community UI (`CommunityChatView.tsx`) disables direct message initiation when viewing another student's profile.
    - **Privacy Protection & Zero Contact Exposure**:
      - Data layer scrubbing in `src/lib/admin/students.ts`: when requested by an instructor (`instructorId` provided), student `email`, `phone`, and `payments` arrays are completely emptied before being returned to client or SSR components.
      - Community chat renders only sanitized display names or full names; student email/phone are never queryable or rendered.
      - AI assistant prompts receive only student display name and course context; zero personal contact details are ever sent to Anthropic Claude API.
      - Third-party private conversation inspection by administrators is audit-logged in `admin_audit_logs` (`admin_read_private_conversation`).
    - **AI Assistant Safety, Prompt Injection & Haitian Creole Guards**:
      - Pre-flight regex engine (`INJECTION_PATTERNS`) rejects prompt injection attempts ("ignore previous instructions", "répète le prompt", "banm modpas", "nouvo enstriksyon", "jailbreak") and extraction requests.
      - Auto-escalation keyword expansion in French and Haitian Creole covering refund requests ("remboursement", "ranbousman", "kòb", "lajan"), discount/price cut requests ("rabais", "promo", "rabè", "rediksyon", "koupe pri"), and account credentials.
      - Input truncation capping message bodies at 2,000 characters to prevent buffer and token exhaustion attacks.
      - Platform daily cost cap enforcement ($15/day) and admin kill switch falling back directly to human escalation.
      - 2-minute escalation rule idempotency: `followup_sent_at` ensures followup notice is sent exactly once.
    - **Abuse, XSS & Flood Protection**:
      - Pure text rendering for all community and private chat message bodies (zero `dangerouslySetInnerHTML`), preventing HTML/script injection.
      - In-memory sliding window rate limiting (5 messages / 10 seconds, 100 messages / hour).
      - Message deduplication using `client_message_id` ensuring zero duplicated messages during offline reconnection.
      - Heartbeat presence system strictly validated server-side from session (`getCurrentUser().role`), preventing presence spoofing.
    - **Reliability & 200 Concurrent User Load Test**:
      - Simulated 200 concurrent user messages processed in 63ms with zero drops.
      - Verified burst throttling against flooding spammers and seamless queue re-sync upon reconnection.
    - **Cloudflare & Build Verification**:
      - Next.js 15 production build passes with exit code 0 and 82/82 static pages prerendered.
      - Verified zero Node-only APIs (`fs`, `child_process`, `net`) across `src/`.
      - Cron job `/api/cron/escalations` runs with standard HTTP headers (`Authorization: Bearer` or `x-cron-secret`).
    - **Legal Pages Update (/cgu, /confidentialite, /remboursement)**:
      - Updated Terms (`/cgu`) with Community Rules & Moderation and Third-Party AI Assistant disclosure (answers indicative, human always reachable, AI cannot grant refunds).
      - Updated Privacy (`/confidentialite`) with Private Message Retention duration and AI third-party processing guarantees (zero direct personal identifiers transmitted).
      - Updated Refund (`/remboursement`) with formal human escalation requirement.
      - All texts localized in French and Haitian Creole, marked as preliminary legal drafts awaiting lawyer validation.
    - **Mobile & PWA Resilience**:
      - Tested viewports at 390px, 360px, and 320px with fixed viewport height (`h-[100dvh]`), ensuring bottom navigation never covers the chat composer.
      - Installed PWA never shows landing page; standalone redirect directs to `/app`.
      - Service worker (`public/sw.js`) explicitly excludes all private routes (`/paiement/`, `/pay/`, `/checkout/`, `/api/`, `/dashboard/messages/`, `/video/`, `/stream/`).

  - **Sécurité & Durcissement Global (Étapes S1-A à S1-F - 66 Assertions Vérifiées)**:
    - **Identité & Sessions (S1-A)** : Suppression intégrale du cookie `faro_session`. L'authentification repose exclusivement sur `supabase.auth.getUser()`. Suppression des identifiants statiques/comptes de test en dur. `createAdminClient()` balisé `server-only` et principe *Fail Closed* en production.
    - **Privilèges SQL & Rôles (S1-B)** : Migration `20250118000000_role_security_and_privilege_guards.sql`. Le trigger `handle_new_user()` ignore inconditionnellement les métadonnées client et impose le rôle `student`. `REVOKE UPDATE (role) ON profiles`. Trigger bloquant `trg_protect_profile_privileged_fields`. Fonction RPC d'élévation sécurisée `set_user_role` réservée aux admins. Droits d'écriture du rôle `anon` révoqués sur tout le schéma public.
    - **Paiements & Webhooks (S1-C)** : Migration `20250119000000_transactional_payment_validation.sql` avec fonction RPC atomique `validate_payment_transactional` (verrouillage `FOR UPDATE`, contrôle exact du montant HTG, idempotence, index unique sur `(provider, provider_txn_id)`). Signature Kobara vérifiée en temps constant via `crypto.timingSafeEqual` avec fenêtre de tolérance temporelle de 5 minutes contre le rejeu. Masquage PII automatique des numéros de téléphone et caviardage des secrets. Suppression de toute validation de paiement basée sur les paramètres d'URL de retour.
    - **Intégrité des Données (S1-D)** : Élimination des données simulées et des fixtures dans les chemins de production. Mocks strictement encapsulés derrière `isDemoMode()` (`APP_MODE=demo` en non-production). Correction des requêtes sur les colonnes réelles localisées `title_fr` et `title_ht` de la table `courses`. Création de formateurs avec compte réel `auth.users` et rôle `instructor`. Élimination des compteurs artificiels de la communauté.
    - **Gouvernance IA & Garde-fous Budgétaires (S1-E)** : Migration `20250120000000_ai_usage_and_governance.sql`. Suivi persistant de `cost_usd` et `user_id` dans `ai_usage`. Fonctions RPC atomiques `check_ai_limits` et `record_ai_usage`. Vérification du *Kill Switch* global sur chaque requête. Calcul tarifaire officiel Claude 3 Haiku. Pré-filtrage des prompts injections et validation Zod de la structure JSON de sortie. En l'absence de clé d'API, repli direct vers un formateur humain (*Fail Closed*).
    - **Récupération de Compte, Anti-Abus & Cron (S1-F)** : Page de réinitialisation de mot de passe `/[locale]/reinitialiser-mot-de-passe` avec échange de session de récupération, validation Zod avec confirmation de mot de passe, et gestion de l'expiration/invalidité du lien (bilingue FR/KR). Route cron `/api/cron/escalations` protégée par `CRON_SECRET` avec vérification `crypto.timingSafeEqual`. Limitation de débit appliquée sur les routes d'authentification, de contact, de checkout et de coupons. Pipeline d'audit unifié `pnpm verify` (typecheck, base de données, 66 assertions d'audit et tests unitaires avec 100% de succès).




## Certificates — built (29 octobre 2026)

Course completion certificates reuse the existing enrollments, lesson_progress and certificates tables and can() permissions. Verified students confirm their printed name before transactional, idempotent issuance. Public verification returns an explicit field allowlist; PDFs are generated on demand with pdf-lib/fontkit, embedded Poppins/Inter and a server-generated QR, owner/admin only, with no-store. No PDF is uploaded to Bunny.

Routes: /[locale]/certificats, /[locale]/verification/[certificateNumber], /[locale]/admin/certificats. Student navigation keeps five mobile tabs. Admins control signatures, revocation/reissue and course thresholds; instructors read only certificates for their own courses. The historical auto-issue trigger and public certificate-table access are removed by the migration. Only one valid certificate per student/course is permitted; revoked/reissued historical rows remain.

Manual migration (not applied remotely): supabase/migrations/20261029000000_certificates.sql. Implementation, screenshot inventory, test scope and required signer/legal inputs: docs/CERTIFICATES.md. Screenshots: docs/screenshots/certificates/. Physical Android/iPhone/PWA downloads and live Resend/Bunny/Supabase integration still require deployment validation.

Certificate visual reference: the user-approved ornate model is shared by PDF and SVG (local empty template, Tinos serif title/name and Inter body; app typography unchanged). See `docs/CERTIFICATES.md`.

## Webhooks Bunny Stream et Resend — built

Routes `/api/webhooks/bunny` et `/api/webhooks/resend`, compatibles Workers avec Web Crypto. Bunny synchronise les états et durées vidéo ; Resend suit les livraisons et suppressions, partagées par tous les envois email. Les reçus et effets sont atomiques et dédupliqués ; les nouvelles tables sont privées, RLS activée, service_role uniquement. Une livraison email ne vérifie jamais un compte. Migration locale `20261030001418_bunny_resend_webhooks.sql` à appliquer manuellement ; configuration des comptes prestataires et validation distante à effectuer par le propriétaire. Guide : `docs/WEBHOOKS.md`.

Cloudflare build fix: `pnpm-workspace.yaml` explicitly lists the root package; `packageManager` pins pnpm 9.10.0. API route handlers use the Next.js nodejs runtime required by OpenNext; middleware remains separate. Clean frozen installation and complete OpenNext Worker build verified locally. Temporary validation projects are excluded from TypeScript.

Workers Builds command contract: `pnpm run build` produces the complete OpenNext Worker, while `build:next` is the internal Next.js-only compilation selected by `open-next.config.ts.buildCommand`. This prevents both a missing compiled OpenNext config at deploy time and recursive builds.

## Email transactionnel
Auth.js ne transmet pas les emails via Supabase Auth : Resend est requis avec RESEND_API_KEY et EMAIL_FROM dans les secrets runtime du Worker.
## Système email — built (code local)
Auth.js utilise Resend pour les envois transactionnels ; Supabase reste Postgres et Realtime. Outbox privée, reprise planifiée, webhooks de livraison, écran /admin/emails, activation par code/lien FR/KR, invitations et notifications métier sont implémentés. L’état accepted signifie acceptation prestataire, jamais delivered. Le déploiement nécessite les trois migrations email, les secrets runtime et le cron décrits dans EMAIL_FIX_NOTES.md. Aucun envoi ni modification Supabase distant n’a été effectué pendant la correction.

## Branche principale et déploiement

La branche principale est `auth-migration`. Toutes les mises à jour doivent y être intégrées puis poussées sur `origin/auth-migration`, branche de production Cloudflare. Ne pas créer de nouvelle branche pour les prochaines corrections, sauf demande explicite de l’utilisateur. Les branches de travail déjà existantes doivent être intégrées à `auth-migration` avant publication ; ne pas les supprimer sans demande.

## Conservation des variables Cloudflare

Le déploiement principal conserve désormais les variables runtime saisies dans le tableau de bord : `keep_vars: true` dans `wrangler.jsonc`, et `--keep-vars` dans `pnpm run deploy`. Sans ce réglage, Wrangler supprime les variables ordinaires absentes de sa configuration ; les secrets chiffrés sont conservés séparément. Cela expliquait la disparition des variables après déploiement et les erreurs de démarrage. Les valeurs déjà supprimées doivent être ressaisies une fois ; cette correction ne permet pas de les récupérer. Les clés sensibles doivent être enregistrées comme secrets, jamais dans le dépôt. Les variables de build restent distinctes des variables runtime.

Référence : https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth
