# TuitionFlow — V1 Specification (Beta Build)

**A mobile-friendly web app (PWA) for one tuition institute to run classes, attendance, fee collection, and tutor salaries — replacing paper registers and Excel.**

> **Context for the developer (Claude Code):** This is the **V1 / beta** scope for a single real institute. Build it in the phase order in Section 10. Do **not** build anything listed in Section 11 (Out of Scope). No online payment gateway in v1 — the app only *records* fees the institute collects offline. Build Phase A (foundation) and confirm it works before Phase B, and so on.

---

## 1. What V1 Is

A single institute (owner + admin staff) uses this daily to:
- manage tutors, students, classes, and enrolments
- mark attendance on a phone
- record fee payments collected offline (cash / bank transfer)
- see who paid, who owes, and total collected
- calculate what each tutor is owed (salary engine)

**Users in V1:** Owner and Admin Staff only. Tutor and student login portals are **later**, not v1.

**Payment note:** No money flows through the system. The institute collects fees their own way; the app records that it happened. Keep `method` and `reference` fields on payments so a future online-payment option needs no rework.

**Salary note:** The salary engine ships in v1 but only produces meaningful numbers once fees and attendance have been recorded (typically from month two). This is expected — it calculates from real captured data, so there is nothing to show until data exists.

---

## 2. Core Domain Model (concepts)

- The **Class** is the atomic unit: `Class = Tutor + Students + Schedule + Fee + Tutor-Payment-Model`.
- A student can be enrolled in many classes.
- Each class has one assigned tutor and a fee.
- Users are identified by **phone number** (unique).

> V1 is **single-institute**. Design the schema with `institute_id` on every table anyway (so multi-institute is possible later) but the app only ever operates within one institute in v1.

---

## 3. Roles & Permissions (V1)

Two active roles in v1: **Owner** and **Admin Staff**.

| Capability | Owner | Admin Staff |
|---|:---:|:---:|
| Mark attendance | ✅ | ✅ |
| Record fee payments | ✅ | ✅ |
| Add/edit students | ✅ | ✅ |
| Add/edit classes | ✅ | ✅ |
| Add/edit tutors | ✅ | ✅ |
| Manage admin staff | ✅ | ❌ |
| Institute settings | ✅ | ❌ |
| View total revenue / collected totals | ✅ | ❌ |
| View net profit | ✅ | ❌ |
| View tutor salaries | ✅ | ❌ |

**Hard rule:** financial *aggregates* (revenue totals, salaries, profit) are **owner-only**. Admin staff can record an individual payment but must never see institute-wide money totals or any salary figure. Enforce this **server-side**, not just by hiding UI.

---

## 4. Functional Requirements

### 4.1 Auth & Accounts
- **FR-1.1** Owner signs up: institute name, owner name, phone, email, password.
- **FR-1.2** Phone number is the unique identifier; verified by OTP at signup.
- **FR-1.3** Login via phone + password; password reset via OTP.
- **FR-1.4** Owner can add admin staff (create account by phone; send invite SMS with set-password link).

### 4.2 Onboarding
- **FR-2.1** After signup, a 3-step wizard: (1) add first tutor, (2) create first class, (3) add first student. Each step skippable.
- **FR-2.2** Never show an empty dashboard — always guide to the next action.

### 4.3 People Management
- **FR-3.1** Add/edit/deactivate **tutors** (name, phone, email).
- **FR-3.2** Add/edit/deactivate **students** (name, phone, **parent phone**).
- **FR-3.3** Add/manage **admin staff** (owner only).
- **FR-3.4** Phone-first add: if a phone already exists in the system, link that account; otherwise create it. (In single-institute v1 this mainly prevents duplicates.)

### 4.4 Classes & Enrolments
- **FR-4.1** Create a class: subject, assigned tutor, day(s), time, room (optional), max students (optional), **fee amount**, **fee type** (monthly_flat / per_session), and **tutor payment model** + value (see 4.7).
- **FR-4.2** Enrol students into classes; a student may join many classes.
- **FR-4.3** Unenrol / mark enrolment inactive (preserve history).

### 4.5 Attendance (mobile-first)
- **FR-5.1** Home shows **today's classes**, colour-coded now / upcoming / done.
- **FR-5.2** Marked by owner or admin staff.
- **FR-5.3** "Mark All Present," then tap students to toggle.
- **FR-5.4** Three states: Present / Absent / Late.
- **FR-5.5** Each student row shows that student's **fee status badge** for the current month.
- **FR-5.6** **Inline payment**: tapping the fee badge opens a bottom sheet to record a payment without leaving attendance. Attendance toggle (left) and fee badge (right) are visually separated to prevent mistaps.
- **FR-5.7** Sticky "Submit Attendance." After submit: summary + optional "Send absence SMS to parents."
- **FR-5.8** Support backdated marking and "Mark Class as Cancelled" (no attendance recorded, nobody marked absent).
- **FR-5.9** Edit submitted attendance (e.g., Absent → Late).

### 4.6 Fees (no online payments)
- **FR-6.1** Monthly fee records **auto-generated** per active enrolment on the 1st (status: pending).
- **FR-6.2** Record payment manually: amount (pre-filled to due, editable), method (Cash / Bank Transfer / Other), optional reference/note, date received (editable for backdating).
- **FR-6.3** Statuses: pending / partial / paid / overdue / waived.
- **FR-6.4** **Partial payment**: amount < due; balance carries forward and is tracked.
- **FR-6.5** **Multi-class**: record payment for several of a student's classes at once.
- **FR-6.6** **Multi-month**: settle several months' dues at once.
- **FR-6.7** Entry points: fee list (overdue first), student search (name or phone), and inline during attendance.
- **FR-6.8** Optional SMS receipt to parent after recording.
- **FR-6.9** Every payment stores `recorded_by` and `recorded_at`.

### 4.7 Tutor Salary Engine (V1)
- **FR-7.1** Payment model set **per tutor, per class**. Four models:
  1. **Revenue Share** — % of fees **collected** for that class that month.
  2. **Fixed Salary** — flat monthly amount.
  3. **Per Student** — rate × number of **paid** students that month.
  4. **Per Session** — rate × sessions held that month (counted from attendance).
- **FR-7.2** Share/per-student calculations use **collected** money / **paid** students — the institute never pays out more than it took in.
- **FR-7.3** **Owner-only** salary screen: per tutor, broken down by class and model, total owed for the month, paid/unpaid status, **"Mark as Paid."**
- **FR-7.4** Recording a salary payment writes to `salary_payments`.
- **FR-7.5** Salary calculation (per tutor, per month):
  ```
  for each class the tutor teaches:
      revenue_share : salary += collected_fees(class, month) * value%
      fixed         : salary += value
      per_student   : salary += paid_students(class, month) * value
      per_session   : salary += sessions_held(class, month) * value
  total = sum across the tutor's classes
  ```
- **FR-7.6** Salary figures appear only after real fee/attendance data exists; show a friendly empty state until then.

### 4.8 Owner Money View (V1 — simple)
- **FR-8.1** For the selected month: **Collected**, **Pending**, **Overdue**, and collection %.
- **FR-8.2** **Net figure**: collected − tutor salaries owed.
- **FR-8.3** Per-class summary: students, collected, collection rate.
- **FR-8.4** Tap through to the underlying students where practical.
- **FR-8.5** Month switcher (this month / last month at minimum).
- **FR-8.6** Owner-only. Admin staff never see this.

> Full charts, 6-month trend, drill-down everywhere, and action-items zone are **later** — v1 keeps this view simple.

### 4.9 SMS
- **FR-9.1** SMS via **Notify.lk** (Sri Lankan gateway) — not Supabase's default international SMS.
- **FR-9.2** SMS uses in v1: OTP/invite set-password link, optional fee receipt, optional absence alert. **No automated reminder sequences in v1** (that's later).
- **FR-9.3** All SMS sends are explicit/optional — never silent bulk.

---

## 5. Non-Functional Requirements

- **NFR-1 Tenancy-ready schema + RLS:** `institute_id` on every tenant table. Enable Postgres **Row Level Security** so data is scoped to the institute even in single-institute v1. Sets up multi-institute later with no rework.
- **NFR-2 Security:** Supabase Auth handles password hashing. No card/financial data stored. **Every financial/salary query checks role server-side.**
- **NFR-3 Performance:** Instant for one institute up to ~500 students. Index every filter the money/attendance views use (Section 6). No pre-aggregation, partitioning, or caching in v1 — not needed at this scale.
- **NFR-4 Mobile-first PWA:** Installable, works in any smartphone browser. Attendance + fee recording optimised for one-thumb use.
- **NFR-5 Responsive:** Mobile = operational tasks; desktop = owner review. Same permissions on both.
- **NFR-6 Data integrity:** Unique phones. Attendance/payment records carry `recorded_by` + `recorded_at`. Backdating allowed so nothing is lost.
- **NFR-7 Portability:** Standard PostgreSQL only, so the DB can move off Supabase later.
- **NFR-8 Localisation:** LKR currency; Asia/Colombo timezone; English UI.

---

## 6. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js + Tailwind CSS (PWA) |
| Auth | Supabase Auth (phone OTP + password) |
| Database | Supabase (PostgreSQL) with RLS |
| SMS | Notify.lk |
| Hosting | Vercel |
| Email (optional invites/receipts) | Resend |
| Payments | **None in v1** |

> **Auth/SMS note:** Supabase phone OTP uses its own SMS provider by default. To send OTP/invites via Notify.lk, implement Supabase's custom SMS hook (or a small custom OTP flow). Handle this in Phase A.

---

## 7. Data Model

> Every tenant table has `institute_id`, `id` (uuid), `created_at`. Index filters exactly as the views need.

```sql
users (id uuid pk, name, phone unique, email, password_hash, created_at)

user_roles (
  id uuid pk, user_id fk, institute_id fk,
  role enum('owner','admin_staff','tutor','student'), created_at
)
INDEX (user_id); INDEX (institute_id, role)

institutes (id uuid pk, name, address, owner_id fk, logo_url, created_at)

institute_tutors (
  id uuid pk, institute_id fk, tutor_id fk,
  joined_date, status enum('active','inactive')
)
INDEX (institute_id); INDEX (tutor_id)

classes (
  id uuid pk, institute_id fk, tutor_id fk,
  subject, schedule_days, schedule_time, room, max_students,
  fee_amount numeric, fee_type enum('monthly_flat','per_session'),
  tutor_payment_model enum('revenue_share','fixed','per_student','per_session'),
  tutor_payment_value numeric, created_at
)
INDEX (institute_id); INDEX (tutor_id)

enrollments (
  id uuid pk, institute_id fk, student_id fk, class_id fk,
  status enum('active','inactive'), enrolled_at
)
INDEX (institute_id, class_id); INDEX (student_id)

attendance (
  id uuid pk, institute_id fk, enrollment_id fk, class_id fk,
  date, status enum('present','absent','late'),
  recorded_by fk, recorded_at
)
INDEX (class_id, date); INDEX (enrollment_id, date)

payments (
  id uuid pk, institute_id fk, student_id fk, class_id fk,
  month, amount_due numeric, amount_paid numeric, balance numeric,
  status enum('pending','partial','paid','overdue','waived'),
  method enum('cash','bank_transfer','other'), reference, paid_date,
  recorded_by fk, recorded_at
)
INDEX (institute_id, month); INDEX (class_id, month)
INDEX (student_id); INDEX (institute_id, status)

salary_payments (
  id uuid pk, institute_id fk, tutor_id fk,
  month, amount numeric, method, status enum('pending','paid'),
  paid_date, recorded_by fk, recorded_at
)
INDEX (institute_id, month); INDEX (tutor_id)

notifications (
  id uuid pk, user_id fk, institute_id fk,
  type enum('invite','receipt','attendance_alert'), message, sent_at
)
```

---

## 8. Key UX Flows

1. **Onboarding:** signup → OTP → 3-step wizard (tutor, class, student) → dashboard with real data.
2. **Add person (phone-first):** enter phone → if exists link, else create + invite SMS.
3. **Attendance:** today's classes → open class → Mark All Present → tap absentees → optional inline payment → Submit → optional absence SMS.
4. **Record fee:** fee list (overdue first) or student search → payment sheet (amount / method / date) → confirm → optional receipt SMS. Supports partial / multi-class / multi-month.
5. **Salaries (owner):** per tutor → breakdown by class + model → total owed → Mark as Paid.
6. **Money view (owner):** collected / pending / overdue + net (collected − salaries) + per-class summary, with month switcher.

---

## 9. Deployment & Publishing

The app is a **PWA — no app stores involved.** Publishing = putting the website live.

- **Source control:** push code to a **GitHub** repo.
- **Hosting:** connect the GitHub repo to **Vercel**. Every push auto-builds and deploys. Free tier is enough for the beta.
- **Database/Auth:** **Supabase** is cloud-hosted already; the app connects via keys.
- **Secrets:** put Supabase keys + Notify.lk key in **Vercel environment variables**. Never commit secrets to GitHub.
- **HTTPS:** automatic and free on Vercel (required for PWA + OTP).
- **Domain (optional):** point a custom domain (e.g. a `.lk` or `.com`) at Vercel; it issues the certificate automatically.
- **Install on phone:** the beta institute opens the Vercel URL and uses "Add to Home Screen."
- **Test early on a real phone** (iPhone Safari and Android Chrome behave slightly differently) — especially the attendance and payment flows.

---

## 10. Build Order (BUILD IN THIS ORDER)

**Phase A — Foundation**
Next.js + Tailwind PWA skeleton; Supabase project; full schema (Section 7) + RLS policies; auth (phone OTP + password) with Notify.lk SMS hook; owner + admin_staff roles; server-side permission checks. **Confirm tenant isolation and role gating before continuing.**

**Phase B — Core Operations**
Onboarding wizard; people management (phone-first add/link, incl. admin staff); classes & enrolments; mobile attendance (mark-all-present, 3 states, cancel, backdate, edit); fee auto-generation + manual recording (partial / multi-class / multi-month) + inline payment during attendance; fee status tracking.

**Phase C — Money & Salaries**
Owner money view (collected/pending/overdue, per-class summary, month switcher); tutor salary engine (4 models, collected-based); salary payment tracking; net figure (collected − salaries). All owner-only.

**Phase D — Polish for beta**
Optional SMS (receipt, absence); PWA install polish; empty states; real-phone testing; deploy to Vercel with a shareable URL for the institute.

---

## 11. Out of Scope for V1 (DO NOT BUILD)

Tutor login portal; student/parent login portal; multi-institute account switching (schema supports it, but no UI); full analytics dashboard (6-month trend charts, action-items zone, drill-down everywhere); automated SMS reminder sequences (Day 1/7/15); online/gateway payments (PayHere); reports/exports (PDF/Excel); payslips; salary advances/bonuses/deductions; granular staff permissions; Excel student import; native mobile apps; multi-branch; account-merge tooling.

---

## 12. Build Notes for Claude Code

- Start with **Phase A**. Deliver the SQL schema + RLS + auth first; verify role gating and tenant isolation before any feature UI.
- Enforce every financial/salary permission **server-side**; never rely on hidden UI.
- Keep `method` + `reference` on payments from day one so v2 online payments need no migration.
- Salary engine calculates from captured fee/attendance data — build a friendly empty state for when no data exists yet.
- Use **Asia/Colombo** timezone and **LKR** throughout.
- Make **mobile attendance + fee recording** the fastest, most polished flows — they run live during classes.
- No pre-aggregation/partitioning/caching in v1.
- Treat Sections 10 & 11 as binding: build A→B→C→D, and do not build anything in Section 11.
