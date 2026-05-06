# Infovion Academic SaaS — Internal Platform Documentation

> **Classification:** Internal Use Only  
> **Version:** 1.0  
> **Last Updated:** April 8, 2026  
> **Maintained By:** Infovion Development Team  

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Multi-Tenancy Model](#4-multi-tenancy-model)
5. [Security Architecture](#5-security-architecture)
6. [Platform Layer — Developer Console](#6-platform-layer--developer-console)
7. [Institution Layer — Operator Dashboard](#7-institution-layer--operator-dashboard)
8. [Core Modules](#8-core-modules)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Subscription & Billing Model](#12-subscription--billing-model)
13. [End-to-End Workflows](#13-end-to-end-workflows)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Deployment & Environment](#15-deployment--environment)
16. [Developer Log](#16-developer-log)
17. [Known Issues & Roadmap](#17-known-issues--roadmap)

---

## 1. Product Overview

**Infovion** is a multi-tenant academic management SaaS platform designed for schools and colleges across India. Each institution operates in complete data isolation as a **tenant**. The platform is sold and managed by the Infovion development team directly, with each client (school) getting their own login portal, operator account, and data silo.

### What the platform does

| Layer | Who Uses It | Purpose |
|---|---|---|
| **Platform Console** (`/platform`) | Infovion developers | Onboard clients, manage subscriptions, monitor all tenants |
| **Operator Dashboard** (`/dashboard`) | School Operator / Admin | Day-to-day school management |
| **Staff Portals** | Teachers, Principal, Receptionist | Attendance, exams, timetables |
| **Parent Portal** | Parents | View child's attendance, exams, fees |

### Business Model

- SaaS subscription based on student strength
- Default pricing: **₹50 per student seat per year**
- Example: 500 students = ₹25,000/year
- Annual billing cycle (configurable to 1–3 years)
- Managed manually by the Infovion team via the Platform Console

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INFOVION PLATFORM                        │
│                                                                 │
│  ┌───────────────────┐          ┌────────────────────────────┐  │
│  │  Next.js Frontend │          │    NestJS Backend API      │  │
│  │  (Port 3001)      │ ◄──────► │    (Port 3000)             │  │
│  │                   │  HTTP    │                            │  │
│  │  /               │          │  /auth/*                   │  │
│  │  /dashboard/*    │          │  /platform/*               │  │
│  │  /platform/*     │          │  /students/*               │  │
│  │  /portal/*       │          │  /users/*  /fees/*         │  │
│  └───────────────────┘          │  /exams/*  /attendance/*  │  │
│                                 │  ...all modules            │  │
│                                 └────────────┬───────────────┘  │
│                                              │ Prisma ORM        │
│                                 ┌────────────▼───────────────┐  │
│                                 │  Neon PostgreSQL            │  │
│                                 │  (Serverless, Cloud)        │  │
│                                 └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Browser Request
     │
     ▼
Next.js (App Router)
     │  fetch()
     ▼
NestJS Backend
     │
     ├─ CORS Check
     ├─ TenantMiddleware (reads X-Institution-ID header)
     │    └─ Skips: /auth/login, /auth/forgot-password, /platform/*
     ├─ ValidationPipe (DTO validation, whitelist mode)
     ├─ AuthGuard (JWT verification, populates req.user)
     ├─ RolesGuard (permission check, where applicable)
     ├─ Controller Method
     ├─ Service Method → Prisma → PostgreSQL
     └─ AuditLogInterceptor (records action)
```

---

## 3. Technology Stack

### Backend

| Component | Technology | Version |
|---|---|---|
| Framework | NestJS | v11 |
| Language | TypeScript | v5.7 |
| ORM | Prisma | v5.17 |
| Database | PostgreSQL (Neon Serverless) | Latest |
| Auth | JWT (via @nestjs/jwt + passport-jwt) | - |
| Password Hashing | bcrypt | v6 |
| Validation | class-validator + class-transformer | - |

### Frontend

| Component | Technology | Notes |
|---|---|---|
| Framework | Next.js (App Router) | v15 |
| Language | TypeScript | - |
| Styling | Tailwind CSS | v4 |
| State Management | Zustand (with persist) | - |
| HTTP Client | Native `fetch` (custom wrapper) | `lib/api.ts` |

### Infrastructure

| Service | Provider | Notes |
|---|---|---|
| Database | Neon PostgreSQL | Serverless, auto-sleep |
| App Hosting | Local (dev) | Production TBD |
| Repository | Monorepo (pnpm workspaces) | `apps/backend`, `apps/frontend` |

---

## 4. Multi-Tenancy Model

Every piece of data in Infovion is scoped to an **Institution** (tenant). Data isolation is enforced at every layer.

### How it works

**1. Institution Code → Institution ID resolution**

When an operator logs in, they provide their **Institution Code** (e.g., `infovion`, `stmary`). The backend resolves this to an internal `institutionId` UUID.

**2. X-Institution-ID header**

After login, the frontend stores the `institutionId` from the JWT and sends it with every API request as:
```
X-Institution-ID: cmms6jl0k0000q3repb3w13hv
```

**3. TenantMiddleware**

The global `TenantMiddleware` reads this header and attaches it to the request object:
```typescript
(req as any).tenant = { institutionId };
```

**4. Service-level isolation**

Every database query is scoped with `where: { institutionId, ... }`. No cross-tenant data leakage is possible through the application layer.

**5. CASCADE deletes**

All tables have foreign keys to `institutions` with `ON DELETE CASCADE`. Removing an institution removes ALL its data atomically.

### Tenant Context Resolution Order

The `@Tenant()` decorator resolves the institution in this priority order:
1. `req.tenant.institutionId` — set by TenantMiddleware (most reliable)
2. `req.user.institutionId` — embedded in JWT payload (fallback)
3. `x-institution-id` header — last resort

### Routes excluded from tenant middleware

| Route | Reason |
|---|---|
| `POST /auth/login` | Uses institution code in body, not header |
| `POST /auth/forgot-password` | Public endpoint |
| `GET /platform/*` | Platform admin routes (own auth system) |
| `POST /platform/*` | Platform admin routes (own auth system) |

---

## 5. Security Architecture

### Authentication Tokens

| Token | Lifetime | Storage | Purpose |
|---|---|---|---|
| JWT Access Token | 24 hours | Zustand + localStorage | API authentication |
| Refresh Token | 7 days | Zustand + localStorage (raw) | Silent token refresh |
| Platform JWT | 24 hours | Zustand + localStorage | Platform console access |

The refresh token raw value is stored in localStorage. On the server, only a SHA-256 hash of the token is stored in the database. This means a compromised database does not expose active refresh tokens.

### Token Refresh Flow

```
API Call with expired access token
         │
         ▼
Backend returns 401
         │
         ▼
apiFetch catches 401 → calls tryRefreshToken()
         │
   ┌─────┴──────────────────────────┐
   │ refreshingPromise set           │
   │ (prevents concurrent refreshes)│
   └─────────────────────────────────┘
         │
         ▼
POST /auth/refresh (with refresh token + X-Institution-ID)
         │
   ┌─────┴────────────┐
   │ Success           │ Failure (401 from refresh)
   │ → new tokens      │ → logout() + redirect to /
   │ → retry request   │
   └───────────────────┘
```

**Important:** Network errors (server restart, timeout) during refresh do NOT trigger logout. Only a definitive 401 from the `/auth/refresh` endpoint itself logs the user out. This prevents false logouts during server hot-reloads in development.

### Password Security

- Passwords hashed with **bcrypt**, salt rounds: **12**
- Never stored or returned in plaintext (except once at the moment of platform-generated credentials, shown in UI and never persisted)
- Operator-managed password reset: no self-service email/SMS (by design for this phase)

### Role-Based Access Control (RBAC)

Permissions are stored as a JSON array per role in the database. They are embedded in the JWT payload at login time.

```typescript
// JWT Payload
{
  sub: "user-id",
  userId: "user-id",
  institutionId: "institution-id",
  roles: ["admin"],
  permissions: ["users.read", "users.write", "students.read", ...]
}
```

### Platform Admin Isolation

Platform admins use a completely separate authentication flow:
- Separate `PlatformAdmin` database table
- JWT payload contains `type: 'platform_admin'` 
- `PlatformGuard` validates this `type` field — institution JWTs are rejected
- Platform routes have NO access to institution data (no institutionId scoping)

---

## 6. Platform Layer — Developer Console

### Access

- **URL:** `http://your-domain/platform/login`
- **Scope:** Infovion development team only
- **Auth:** Separate `PlatformAdmin` credentials (not the same as any school login)

### Pages

| Page | Route | Purpose |
|---|---|---|
| Login | `/platform/login` | Platform admin authentication |
| Dashboard | `/platform/dashboard` | Aggregate stats across all clients |
| Clients List | `/platform/clients` | All institutions with subscription status |
| Onboard Client | `/platform/clients/new` | Full onboarding flow in one step |
| Client Detail | `/platform/clients/[id]` | Manage individual client + subscription |

### Dashboard Stats

- **Total Clients** — all institutions ever onboarded
- **Active** — institutions with non-expired subscriptions
- **Expiring Soon** — subscriptions ending within 30 days
- **Expired** — overdue subscriptions
- **Total Revenue** — sum of all subscription `totalAmount`
- **Pending Collection** — `totalAmount - amountPaid` across all clients

### Client Onboarding Workflow

When a new school is onboarded, the following happen in a **single atomic operation**:

```
1. AUTO-GENERATE institution code from school name
   "Vedant Vidya Mandir" → "vedantvidyam" (max 12 chars, lowercase, no spaces)
   If code taken → append suffix: "vedantvidya2", "vedantvidya3" ...

2. CREATE institution record
   { name, code, planCode, institutionType, status: 'active' }

3. CREATE 7 default roles
   super_admin, admin, principal, teacher, student, parent, receptionist

4. CREATE operator user account
   Email: provided OR auto-generated as admin@{code}.in
   Password: 10-char random (uppercase letters + digits, no ambiguous chars)

5. ASSIGN 'admin' role to operator

6. CREATE subscription record
   { maxStudents, pricePerUser, totalAmount, startDate, endDate }

7. SEED defaults (outside transaction)
   - 10 default fee heads (Tuition, Exam, Library, Lab, Sports, etc.)
   - 22 school subjects OR 12 college subjects

8. RETURN credentials to platform admin (shown once, never stored in plaintext)
```

**Credentials returned:**
```json
{
  "institution": { "id": "...", "name": "Vedant Vidya Mandir", "code": "vedantvidyam" },
  "operatorCredentials": {
    "institutionCode": "vedantvidyam",
    "email": "admin@vedantvidyam.in",
    "phone": null,
    "password": "XK7MN2PQRW"
  },
  "subscription": { "maxStudents": 500, "totalAmount": 25000, "endDate": "2027-04-08" }
}
```

### Client Management

| Action | Endpoint | Effect |
|---|---|---|
| View detail | `GET /platform/clients/:id` | Institution + subscription + user/student counts |
| Suspend | `PATCH /platform/clients/:id/status` `{ status: "suspended" }` | Sets institution status, blocking operator login |
| Activate | Same endpoint `{ status: "active" }` | Restores access |
| Deactivate | Same `{ status: "inactive" }` | Soft deactivation |
| Add/Renew subscription | `POST /platform/clients/:id/subscription` | Creates or updates subscription, auto-calculates `endDate` from `startDate + billingCycleYears` |
| Remove client | `DELETE /platform/clients/:id` | Soft delete (sets `deletedAt`, status → inactive). Data retained. |

---

## 7. Institution Layer — Operator Dashboard

### Who is the Operator?

The Operator (role code: `admin`) is the school's designated platform manager. This person:
- Receives credentials from the Infovion team at onboarding
- Has full access to the institution's data
- Manages staff, students, and day-to-day operations
- Is the first point of contact for platform issues

### Operator Dashboard Navigation

| Module | Path | Role |
|---|---|---|
| Overview | `/dashboard` | Operator, Director |
| Inquiries | `/dashboard/inquiries` | Operator, Receptionist |
| Students | `/dashboard/students` | Operator |
| Classes | `/dashboard/classes` | Operator |
| Promote | `/dashboard/promote` | Operator |
| Attendance | `/dashboard/attendance` | Teacher, Operator |
| Subjects | `/dashboard/subjects` | Operator |
| Timetable | `/dashboard/timetable` | Operator |
| Examinations | `/dashboard/exams` | Teacher, Operator |
| Fees | `/dashboard/fees` | Operator |
| Announcements | `/dashboard/announcements` | All staff |
| Staff | `/dashboard/staff` | Operator |
| Settings | `/dashboard/settings` | Operator |

### Operator Settings

Three sections in `/dashboard/settings`:

1. **Account Info** — Email and role display
2. **Password Reset Requests** — Approve/reject forgot-password requests from parents/staff. On approval, a 10-char temporary password is auto-generated and shown to the operator to share manually.
3. **Change Your Password** — Old password + new password (min 6 chars)

---

## 8. Core Modules

### 8.1 Authentication Module

**Base path:** `/auth`

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/auth/login` | POST | Public | Login with institutionCode + email/phone + password |
| `/auth/refresh` | POST | X-Institution-ID header | Refresh access + refresh token pair |
| `/auth/logout` | POST | Bearer JWT | Revoke all refresh tokens for user |
| `/auth/forgot-password` | POST | Public | Submit reset request (operator must approve) |
| `/auth/password-resets` | GET | Operator JWT | List pending reset requests |
| `/auth/password-resets/:id/approve` | POST | Operator JWT | Approve request, generate new password |
| `/auth/password-resets/:id/reject` | POST | Operator JWT | Reject reset request |

**Login behavior:**
- Accepts email OR phone as the identifier (Prisma `OR` query)
- Checks institution `status === 'active'` and `deletedAt === null`
- Checks user `isActive === true` and `deletedAt === null`
- On success: returns `{ accessToken, refreshToken, user: { id, email, institutionId, roles, permissions } }`

**Forgot Password Flow:**
```
Parent submits request (institutionCode + phone/email)
     │
     ▼
PasswordResetRequest created (status: pending)
     │
     ▼
Operator sees in Settings → Password Reset Requests
     │
     ▼
Operator clicks "Set New Password"
     │
     ▼
Random 10-char password generated + hashed
User.passwordHash updated + request.status → 'approved'
     │
     ▼
Operator copies password and shares with parent (out-of-band)
```

---

### 8.2 Students Module

**Base path:** `/students`

| Endpoint | Method | Description |
|---|---|---|
| `GET /students` | GET | List students with pagination (page, limit, search) |
| `GET /students/:id` | GET | Single student profile |
| `POST /students` | POST | Create student record |
| `PATCH /students/:id` | PATCH | Update student details |
| `DELETE /students/:id` | DELETE | Soft delete student |
| `POST /students/confirm-admission` | POST | Full admission workflow (atomic) |
| `POST /students/promote` | POST | Bulk promote/transfer/holdback |
| `POST /students/:id/link-user` | POST | Link portal login to student |
| `DELETE /students/:id/link-user` | DELETE | Unlink portal login |
| `GET /students/me` | GET | Student self-portal |
| `GET /students/child` | GET | Parent portal — view child |
| `GET /students/count` | GET | Aggregate count |

**Student Data Model Key Fields:**

```
admissionNo          — unique per institution
firstName, lastName
dateOfBirth
gender
phone, email         — student contact
fatherName, motherName
parentPhone          — primary parent contact
address
bloodGroup, nationality, religion, casteCategory
aadharNumber
siblingGroupId       — links siblings
admissionDate
academicUnitId       — enrolled class
status               — active | inactive | alumni
tcFromPrevious       — TC management (not_applicable | pending | received)
userId               — student portal link
parentUserId         — parent portal link
```

**Confirm Admission (atomic transaction):**
1. Create student record
2. Auto-generate `admissionNo` if not provided
3. Create parent User account (if `parentPhone` provided):
   - Auto-generate credentials (phone + random password)
   - Assign `parent` role
4. Link `student.parentUserId → parent user`
5. Optionally record initial fee payment (admission fee)
6. Return: `{ student, parentCredentials: { phone, password } }`

**Student Promotion:**
```json
POST /students/promote
{
  "studentIds": ["id1", "id2", "id3"],
  "targetUnitId": "class-10-id",
  "action": "promote"    // promote | holdback | transfer
}
```

---

### 8.3 Academic Module

**Base path:** `/academic`

Manages the hierarchical class structure of the institution.

**Academic Unit Hierarchy:**
```
Institution
  └── Level 0 (School/Wing): Primary School, Secondary School
       └── Level 1 (Grade): Class 1, Class 2 ... Class 10
            └── Level 2 (Section, optional): Section A, Section B
```

**Academic Years:**
- Each institution maintains multiple academic years
- Exactly one year is marked `isCurrent: true`
- Used to scope fee structures, exams, timetables

| Endpoint | Description |
|---|---|
| `GET /academic/units` | Full hierarchy |
| `GET /academic/units/leaf` | Leaf-level units only (for class operations) |
| `POST /academic/units` | Create unit with level + optional parentId |
| `PATCH /academic/units/:unitId/class-teacher` | Assign class teacher |
| `DELETE /academic/units/:unitId/class-teacher` | Remove class teacher |
| `GET /academic/my-class-units` | Teacher sees their assigned class(es) |
| `GET /academic/years` | All academic years |
| `POST /academic/years` | Create year (name, startDate, endDate) |
| `PATCH /academic/years/:id/set-current` | Set as current year |

---

### 8.4 Inquiry Module (CRM)

**Base path:** `/inquiries`

Tracks prospective students through the admissions pipeline.

**Inquiry Statuses:**
```
new → contacted → visited → enrolled → dropped
```

Standard CRUD with status filtering. Inquiry data: firstName, lastName, phone, email, address, classInterest, academicYearId, notes.

---

### 8.5 Subjects Module

**Base path:** `/subjects`

Two-level structure:
1. **Subject catalog** — Institution-wide subject list (seeded on onboarding)
2. **Unit-subject assignment** — Which subjects are taught in which class

```
GET  /subjects                    → All subjects
POST /subjects                    → Create new subject
DELETE /subjects/:id              → Remove subject

GET  /subjects/units/:unitId      → Subjects assigned to class
POST /subjects/units/:unitId      → Assign subject to class (with optional teacher)
DELETE /subjects/units/:unitId/:subjectId  → Remove assignment
```

---

### 8.6 Attendance Module

**Base path:** `/attendance`

**Data Model:**
- `AttendanceSession` — One session per class per date (optionally per subject)
- `AttendanceRecord` — One record per student per session
- Status: `present | absent | late | leave`

| Endpoint | Description |
|---|---|
| `GET /attendance/units/:unitId/students` | Class roster for taking attendance |
| `GET /attendance/units/:unitId/daily` | Daily sheet (date param: `?date=2026-04-08`) |
| `POST /attendance` | Save/update session (upsert pattern) |
| `GET /attendance/students/:studentId/monthly` | Monthly report with % |
| `GET /attendance/units/:unitId/defaulters` | Below-threshold list |
| `GET /attendance/notifications/parent` | Parent: today's absent children |

**Attendance save payload:**
```json
{
  "academicUnitId": "unit-id",
  "date": "2026-04-08",
  "subjectId": "optional-subject-id",
  "records": [
    { "studentId": "s1", "status": "present" },
    { "studentId": "s2", "status": "absent", "remarks": "sick" }
  ]
}
```

**Monthly defaulter threshold:** Configurable per query (default 75%)

---

### 8.7 Fees Module

**Base path:** `/fees`

Three-layer structure:

```
FeeHead          (category: Tuition, Exam, Library...)
  └── FeeStructure  (amount per class per year, with installments)
       └── FeePayment  (actual payment receipt)
```

| Endpoint | Description |
|---|---|
| `GET /fees/heads` | All fee head categories |
| `POST /fees/heads` | Create fee head |
| `DELETE /fees/heads/:id` | Delete fee head |
| `GET /fees/structures` | Fee structures (`?unitId=&yearId=`) |
| `POST /fees/structures` | Upsert fee structure (amount + installments) |
| `DELETE /fees/structures/:id` | Delete structure |
| `POST /fees/payments` | Record payment receipt |
| `GET /fees/payments/student/:id` | All payments for student |
| `GET /fees/payments/student/:id/balance` | Outstanding balance |
| `GET /fees/payments/daily` | Daily collection report |
| `GET /fees/defaulters` | Students with pending fees |

**Payment modes:** `cash | upi | cheque | dd | neft`

**Receipt generation:** Auto-incremented `receiptNo` per institution (unique per institution, not globally)

**Fee structure installments:**
```json
{
  "feeHeadId": "tuition-id",
  "academicUnitId": "class-5-id",
  "academicYearId": "2025-26-id",
  "amount": 5000,
  "installmentName": "Term 1",
  "dueDate": "2025-06-30"
}
```

---

### 8.8 Examinations Module

**Base path:** `/exams`

Three-level structure:

```
Exam (e.g., Unit Test 1, Annual Exam)
  └── ExamSubject (subject + unit + max marks + passing marks)
       └── ExamResult (per student, marks obtained)
```

**Exam Statuses:** `draft → active → completed`

| Endpoint | Description |
|---|---|
| `GET /exams` | All exams (`?yearId=`) |
| `POST /exams` | Create exam |
| `PATCH /exams/:id/status` | Advance exam status |
| `POST /exams/:id/subjects` | Add subject (maxMarks, passingMarks, examDate) |
| `POST /exams/results` | Save student marks (bulk upsert) |
| `GET /exams/:id/results` | Results for a unit |
| `GET /exams/:id/scorecard/:studentId` | Individual student scorecard with grades |
| `GET /exams/:id/summary` | Class-level summary with ranks |
| `GET /exams/:id/completeness` | % of marks entered vs expected |
| `GET /exams/my-assigned` | Teacher: only their assigned subject exams |

**Grade calculation:** Based on percentage (A+, A, B, C, D, F)

**Student scorecard includes:** marks per subject, total, percentage, rank in class, pass/fail

---

### 8.9 Announcements Module

**Base path:** `/announcements`

| Endpoint | Description |
|---|---|
| `GET /announcements` | Role-filtered announcements (`?role=teacher`) |
| `POST /announcements` | Create (title, body, targetRoles[], isPinned, expiresAt) |
| `PATCH /announcements/:id` | Update announcement |
| `DELETE /announcements/:id` | Delete announcement |

**Target roles:** `["all"]` or specific: `["teacher", "parent", "student"]`

**Filtering:** Backend returns only announcements where `targetRoles` contains the requesting user's role or `"all"`. Expired announcements (`expiresAt < now`) are excluded.

---

### 8.10 Timetable Module

**Base path:** `/timetable`

| Endpoint | Description |
|---|---|
| `GET /timetable/units/:unitId` | Full weekly timetable for a class |
| `PUT /timetable/units/:unitId/slot` | Update one slot (day + period) |
| `POST /timetable/units/:unitId/generate` | Auto-generate timetable |
| `GET /timetable/my-schedule` | Teacher: their teaching schedule |

**Slot structure:** `{ dayOfWeek (1=Mon–6=Sat), periodNo, subjectId, teacherUserId }`

**Auto-generation:** Distributes assigned subjects across the week with configurable `periodsPerDay` (default 7) and `workingDays` (default Mon–Fri).

---

### 8.11 Users & Roles Modules

**Users base path:** `/users`  
**Roles base path:** `/roles`

| Endpoint | Description |
|---|---|
| `GET /users` | All users (filters parent-only accounts in frontend) |
| `POST /users` | Create user |
| `DELETE /users/:id` | Soft delete user |
| `POST /users/:id/roles` | Assign role to user |
| `DELETE /users/:id/roles/:roleId` | Remove role |
| `POST /users/me/change-password` | Change own password (oldPassword + newPassword) |
| `GET /roles` | All institution roles |
| `POST /roles` | Create custom role |

**Default roles seeded per institution:**

| Role Code | Label | Key Permissions |
|---|---|---|
| `super_admin` | Director | Full access including institution settings |
| `admin` | Operator | Full operational access (no institution settings) |
| `principal` | Principal | Read-only across all modules |
| `teacher` | Teacher | Attendance write, exam write (own subjects) |
| `student` | Student | Portal read-only |
| `parent` | Parent | Child data read-only |
| `receptionist` | Desk / Reception | Inquiry management, student read |

---

## 9. Database Schema

### Core Tables

```
institutions
├── id (cuid, PK)
├── name (unique)
├── code (unique) ← login code
├── planCode
├── institutionType (school | college)
├── status (active | inactive | suspended)
├── features (JSON)
├── createdAt, updatedAt, deletedAt

users
├── id (cuid, PK)
├── institutionId → institutions (CASCADE)
├── email (nullable)
├── phone (nullable)
├── passwordHash
├── isActive
├── lastLoginAt
├── createdAt, deletedAt

students
├── id (cuid, PK)
├── institutionId → institutions (CASCADE)
├── admissionNo (unique per institution)
├── firstName, lastName, dateOfBirth, gender
├── phone, email, address
├── fatherName, motherName, parentPhone
├── bloodGroup, nationality, religion, casteCategory, aadharNumber
├── siblingGroupId
├── academicUnitId → academic_units
├── status, admissionDate
├── tcFromPrevious, tcReceivedDate, tcPreviousInstitution
├── userId → users (unique, student portal)
├── parentUserId → users (parent portal)
├── createdAt, updatedAt, deletedAt

academic_years
├── id, institutionId, name
├── startDate, endDate, isCurrent
└── @@unique([institutionId, name])

academic_units
├── id, institutionId, academicYearId
├── name, displayName, level, parentId (self-ref)
├── classTeacherUserId → users
└── deletedAt

roles
├── id, institutionId, code, label
├── permissions (JSON array of strings)
└── @@unique([institutionId, code])

user_roles (join table)
├── userId, roleId, institutionId
└── @@id([userId, roleId])
```

### Financial Tables

```
fee_heads
├── id, institutionId, name, isCustom
└── @@unique([institutionId, name])

fee_structures
├── id, institutionId, academicUnitId, academicYearId, feeHeadId
├── amount, installmentName, dueDate
└── @@unique([academicUnitId, academicYearId, feeHeadId, installmentName])

fee_payments
├── id, institutionId, studentId, feeHeadId, academicYearId
├── amount, paymentMode, receiptNo, paidOn, remarks
└── @@unique([institutionId, receiptNo])
```

### Examination Tables

```
exams
├── id, institutionId, academicYearId, name
├── startDate, endDate, status

exam_subjects
├── id, examId, academicUnitId, subjectId
├── maxMarks, passingMarks, examDate

exam_results
├── id, institutionId, examId, studentId, subjectId, academicUnitId
├── marksObtained, isAbsent, remarks
└── @@unique([examId, studentId, subjectId])
```

### Attendance Tables

```
attendance_sessions
├── id, institutionId, academicUnitId, subjectId
├── date (@db.Date), takenByUserId
└── @@unique([academicUnitId, date, subjectId])

attendance_records
├── id, institutionId, sessionId, studentId
├── status (present | absent | late | leave), remarks
└── @@unique([sessionId, studentId])
```

### Platform Tables

```
platform_admins
├── id (cuid, PK)
├── email (unique)
├── passwordHash
├── name
├── isActive
└── createdAt, updatedAt

subscriptions
├── id (cuid, PK)
├── institutionId (unique → institutions)
├── planName, maxStudents, pricePerUser, billingCycleYears
├── totalAmount (= maxStudents × pricePerUser)
├── startDate, endDate
├── status (active | expired | suspended | cancelled)
├── amountPaid, paidAt
└── notes
```

### Supporting Tables

```
password_reset_requests
├── id, institutionId, userId
├── status (pending | approved | rejected)
└── createdAt, updatedAt

refresh_tokens
├── id, userId, institutionId
├── tokenHash (SHA-256), isRevoked, expiresAt

audit_logs
├── id, institutionId, userId
├── action, entityType, entityId
├── oldValue (JSON), newValue (JSON)
├── ipAddress, createdAt

announcements
├── id, institutionId, authorUserId
├── title, body, targetRoles (JSON), isPinned, expiresAt

timetable_slots
├── id, institutionId, academicUnitId
├── dayOfWeek (1=Mon...6=Sat), periodNo, subjectId, teacherUserId
└── @@unique([academicUnitId, dayOfWeek, periodNo])
```

---

## 10. API Reference

### Base URL

```
Development: http://localhost:3000
```

### Common Headers

```
Content-Type: application/json
X-Institution-ID: {institutionId}          ← Required for institution routes
Authorization: Bearer {accessToken}        ← Required for protected routes
```

### HTTP Status Codes Used

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (invalid/expired token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate unique constraint) |
| 500 | Internal Server Error |

### Complete API Index

**Auth**
```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password
GET    /auth/password-resets
POST   /auth/password-resets/:id/approve
POST   /auth/password-resets/:id/reject
```

**Platform**
```
POST   /platform/auth/login
GET    /platform/stats
GET    /platform/clients
POST   /platform/clients
GET    /platform/clients/:id
PATCH  /platform/clients/:id/status
POST   /platform/clients/:id/subscription
DELETE /platform/clients/:id
```

**Students**
```
GET    /students
POST   /students
GET    /students/count
GET    /students/me
GET    /students/child
POST   /students/confirm-admission
POST   /students/promote
GET    /students/:id
PATCH  /students/:id
DELETE /students/:id
POST   /students/:id/link-user
DELETE /students/:id/link-user
```

**Academic**
```
GET    /academic/units
GET    /academic/units/leaf
POST   /academic/units
GET    /academic/units/:unitId
PATCH  /academic/units/:unitId
DELETE /academic/units/:unitId
GET    /academic/class-teachers
GET    /academic/my-class-units
PATCH  /academic/units/:unitId/class-teacher
DELETE /academic/units/:unitId/class-teacher
GET    /academic/years
GET    /academic/years/current
POST   /academic/years
PATCH  /academic/years/:id/set-current
```

**Users & Roles**
```
GET    /users
POST   /users
DELETE /users/:id
POST   /users/me/change-password
POST   /users/:id/roles
DELETE /users/:id/roles/:roleId
GET    /roles
POST   /roles
```

**Fees**
```
GET    /fees/heads
POST   /fees/heads
DELETE /fees/heads/:id
GET    /fees/structures
POST   /fees/structures
DELETE /fees/structures/:id
POST   /fees/payments
GET    /fees/payments/student/:studentId
GET    /fees/payments/student/:studentId/balance
GET    /fees/payments/daily
GET    /fees/defaulters
```

**Exams**
```
GET    /exams
POST   /exams
GET    /exams/my-assigned
PATCH  /exams/:id/status
DELETE /exams/:id
GET    /exams/:id/subjects
POST   /exams/:id/subjects
DELETE /exams/:id/subjects/:subjectEntryId
POST   /exams/results
GET    /exams/:id/results
GET    /exams/:id/completeness
GET    /exams/:id/summary
GET    /exams/:id/scorecard/:studentId
```

**Attendance**
```
GET    /attendance/notifications/parent
GET    /attendance/units/:unitId/students
GET    /attendance/units/:unitId/daily
POST   /attendance
GET    /attendance/students/:studentId/monthly
GET    /attendance/units/:unitId/defaulters
```

**Other**
```
GET    /inquiries
POST   /inquiries
GET    /inquiries/:id
PATCH  /inquiries/:id
DELETE /inquiries/:id

GET    /subjects
POST   /subjects
DELETE /subjects/:id
GET    /subjects/units/:unitId
POST   /subjects/units/:unitId
DELETE /subjects/units/:unitId/:subjectId

GET    /announcements
POST   /announcements
PATCH  /announcements/:id
DELETE /announcements/:id

GET    /timetable/units/:unitId
PUT    /timetable/units/:unitId/slot
POST   /timetable/units/:unitId/generate
GET    /timetable/my-schedule

POST   /institution/:id/seed-defaults
POST   /institution/:id/set-code
```

---

## 11. Authentication & Authorization

### Login Flow (Institution User)

```
POST /auth/login
{
  "institutionCode": "infovion",
  "email": "admin@infovion.in",   ← or phone: "9876543210"
  "password": "operator123"
}

Response:
{
  "accessToken": "eyJ...",
  "refreshToken": "abc123hex...",
  "user": {
    "id": "user-id",
    "email": "admin@infovion.in",
    "institutionId": "institution-id",
    "roles": ["admin"],
    "permissions": ["users.read", "students.read", ...]
  }
}
```

### Login Flow (Platform Admin)

```
POST /platform/auth/login
{
  "email": "dev@infovion.in",
  "password": "platform@dev123"
}

Response:
{
  "accessToken": "eyJ...",       ← Contains type: 'platform_admin' in payload
  "admin": {
    "id": "admin-id",
    "email": "dev@infovion.in",
    "name": "Infovion Dev"
  }
}
```

### Permission Strings

| Permission | Covers |
|---|---|
| `users.read` | View users/staff list |
| `users.write` | Create/edit/delete users |
| `users.assignRole` | Assign roles to users |
| `roles.read` | View roles |
| `roles.write` | Create/edit roles |
| `students.read` | View student data |
| `students.write` | Create/edit/delete students |
| `fees.read` | View fee data |
| `fees.write` | Record/modify fees |
| `attendance.read` | View attendance |
| `attendance.write` | Mark/edit attendance |
| `exams.read` | View exams and results |
| `exams.write` | Create exams, enter marks |
| `subjects.read` | View subjects |
| `subjects.write` | Create/assign subjects |
| `institution.read` | View institution settings |
| `institution.write` | Modify institution settings |
| `inquiry.read` | View inquiries |
| `inquiry.write` | Create/update inquiries |

---

## 12. Subscription & Billing Model

### Pricing Formula

```
Annual Amount = maxStudents × pricePerUser × 1 year
             = 500 × ₹50 × 1
             = ₹25,000/year
```

### Subscription Statuses

| Status | Meaning | System Effect |
|---|---|---|
| `active` | Valid, within billing period | Full access |
| `expired` | endDate passed | Access continues (grace period — operator decides cutoff) |
| `suspended` | Manually suspended by platform | Institution status also set to suspended |
| `cancelled` | Permanently ended | Data retained, access blocked |

### Subscription Fields

```
planName          — string label (basic, standard, premium)
maxStudents       — billing basis (NOT a hard enforcement limit in v1)
pricePerUser      — rupees per student seat
billingCycleYears — 1, 2, or 3 years
totalAmount       — maxStudents × pricePerUser (calculated, stored)
startDate         — subscription start
endDate           — startDate + billingCycleYears (auto-calculated)
amountPaid        — what the client has actually paid (manual entry)
paidAt            — date of payment receipt
notes             — payment terms, agreements
```

> **Note:** In v1, `maxStudents` is for billing reference only. There is no hard enforcement that prevents enrolling beyond the limit. This is a planned feature for v2.

### Expiry Monitoring

The platform dashboard shows:
- **Expiring Soon** = `endDate` within 30 days from today
- **Expired** = `endDate` has passed

No automated notifications are sent in v1. The Infovion team monitors the platform dashboard manually and contacts clients approaching expiry.

---

## 13. End-to-End Workflows

### Workflow 1: School Onboarding

```
Infovion Team receives school request
         │
         ▼
Platform admin logs into /platform/login
         │
         ▼
Navigate to Clients → Onboard Client
         │
         ▼
Fill in:
  • School Name: "Vedant Vidya Mandir"
  • Type: School
  • Plan: Standard
  • Max Students: 500
  • Price/Student: ₹50
  • Duration: 1 year
  • Admin email (optional)
  • Admin phone (optional)
         │
         ▼
Click "Create Institution + Generate Credentials"
         │
         ▼
System auto-creates everything in one transaction
         │
         ▼
Green success panel shows:
  ┌─────────────────────────────────────┐
  │ School Code:  vedantvidyam          │
  │ Email:        admin@vedantvidyam.in │
  │ Password:     XK7MN2PQRW           │
  │ Annual Amount: ₹25,000              │
  │ Valid Until:  8 Apr 2027            │
  └─────────────────────────────────────┘
         │
         ▼
Infovion team shares credentials with school operator
(via WhatsApp/email/in-person)
         │
         ▼
School operator logs into /  (login page)
Uses: vedantvidyam / admin@vedantvidyam.in / XK7MN2PQRW
         │
         ▼
Operator is live on their dashboard
```

---

### Workflow 2: Student Admission + Parent Access

```
Operator clicks "Admit Student" on dashboard
         │
         ▼
Admission form filled:
  • Student details (name, DOB, class, address)
  • Parent details (father/mother name, phone)
  • TC details (if transfer student)
  • Initial fee payment (optional)
         │
         ▼
POST /students/confirm-admission (atomic transaction)
  → Student record created
  → Parent User created (phone as login identifier)
  → Auto-generated password (8 chars)
  → Parent role assigned
  → Parent linked to student
  → Fee payment recorded (if provided)
         │
         ▼
Credentials shown in modal:
  ┌─────────────────────────────────────────┐
  │ School Code:  vedantvidyam              │
  │ Phone/Email:  9876543210               │
  │ Password:     MN7KPQRW                 │
  │ Parent can login at: / (main login)    │
  └─────────────────────────────────────────┘
         │
         ▼
Operator shares credentials with parent
         │
         ▼
Parent logs in → sees child's attendance, exams, fees
```

---

### Workflow 3: Daily Attendance

```
Teacher navigates to Attendance
         │
         ▼
Selects class + date (defaults to today)
         │
         ▼
GET /attendance/units/:unitId/students
  → Loads class roster
         │
         ▼
Teacher marks each student:
  Present / Absent / Late / Leave
  (with optional remarks for absent)
         │
         ▼
Click "Save Attendance"
POST /attendance
  → AttendanceSession upserted for (unitId + date + subjectId)
  → AttendanceRecord upserted per student
  → takenByUserId recorded
         │
         ▼
Parent logs into portal → sees child absent notification
(GET /attendance/notifications/parent)
```

---

### Workflow 4: Fee Collection

```
Student comes to pay fees
         │
         ▼
Operator → Fees → Record Payment
         │
         ▼
Select student → shows outstanding balance
GET /fees/payments/student/:id/balance
         │
         ▼
Fill: Amount, Fee Head, Payment Mode, Date
         │
         ▼
POST /fees/payments
  → Receipt number auto-generated
  → Payment recorded
         │
         ▼
Print/share receipt with student
         │
         ▼
End of day: View Daily Collection Report
GET /fees/payments/daily?date=2026-04-08
```

---

### Workflow 5: Exam Results + Scorecard

```
Operator creates exam: POST /exams
  { name: "Unit Test 1", academicYearId, startDate, endDate }
         │
         ▼
Add subjects: POST /exams/:id/subjects
  { subjectId, academicUnitId, maxMarks: 100, passingMarks: 35 }
         │
         ▼
Set status to active: PATCH /exams/:id/status
         │
         ▼
Teacher logs in → Examinations → sees assigned exam
GET /exams/my-assigned
         │
         ▼
Enter marks: POST /exams/results
  { examId, records: [{ studentId, subjectId, marksObtained }] }
         │
         ▼
Check completeness: GET /exams/:id/completeness
(confirms all students have marks entered)
         │
         ▼
View class summary with ranks: GET /exams/:id/summary
         │
         ▼
Student/Parent views scorecard:
GET /exams/:id/scorecard/:studentId
  → Returns marks, total, percentage, grade, rank
```

---

### Workflow 6: Password Reset (Forgot Password)

```
User can't log in → clicks "Forgot password?" on login page
         │
         ▼
Modal: Enter School Code + Phone/Email
POST /auth/forgot-password
  → PasswordResetRequest created (status: pending)
  → User sees: "Request submitted. Operator will set new password."
         │
         ▼
Operator logs in → Settings → Password Reset Requests
  → Red badge shows "2 pending"
  → List of requests with user phone/email + timestamp
         │
         ▼
Operator clicks "Set New Password"
POST /auth/password-resets/:id/approve
  → 10-char random password generated
  → User's passwordHash updated
  → Request status → approved
  → Green banner shows new password
         │
         ▼
Operator shares new password with user (WhatsApp/call)
         │
         ▼
User logs in with new password
(Advised to change password from profile)
```

---

## 14. Frontend Architecture

### Route Structure

```
app/
├── page.tsx                          ← Login (institution users)
├── dashboard/
│   ├── layout.tsx                    ← Operator sidebar + auth guard
│   ├── page.tsx                      ← Overview / stats
│   ├── inquiries/page.tsx            ← CRM
│   ├── students/page.tsx             ← Student management + admission
│   ├── classes/page.tsx              ← Academic units
│   ├── promote/page.tsx              ← Bulk promotion
│   ├── attendance/page.tsx           ← Attendance marking
│   ├── subjects/page.tsx             ← Subject management
│   ├── timetable/page.tsx            ← Timetable editor
│   ├── exams/page.tsx                ← Exam management
│   ├── fees/page.tsx                 ← Fee collection
│   ├── announcements/page.tsx        ← Notice board
│   ├── staff/page.tsx                ← Staff management
│   └── settings/page.tsx             ← Password, reset requests
└── platform/
    ├── layout.tsx                    ← Platform sidebar + auth guard
    ├── page.tsx                      ← Redirects to /platform/dashboard
    ├── login/page.tsx                ← Platform admin login
    ├── dashboard/page.tsx            ← Stats overview
    └── clients/
        ├── page.tsx                  ← All clients list
        ├── new/page.tsx              ← Onboard form
        └── [id]/page.tsx             ← Client detail + subscription
```

### State Management (Zustand)

| Store | Key | Contents |
|---|---|---|
| `auth.store.ts` | `auth` | `accessToken`, `refreshToken`, `user { email, institutionId, roles }` |
| `platform-auth.store.ts` | `platform-auth` | `platformToken`, `admin { id, email, name }` |

Both stores use `zustand/middleware/persist` → localStorage. Keys are distinct to prevent interference.

### API Helpers

| File | Purpose |
|---|---|
| `lib/api.ts` | Institution API: adds `X-Institution-ID` + `Authorization` headers, handles 401 refresh |
| `lib/platform-api.ts` | Platform API: adds only `Authorization` header (no institution header) |

### Auth Guard Pattern

Both `/dashboard` and `/platform` use the same pattern:
1. Check token presence on mount (client-side only, via `useEffect`)
2. If no token → redirect to login
3. For dashboard: also check that user has required role (`admin`)
4. Render `null` until hydration to prevent flash of unauthenticated content

---

## 15. Deployment & Environment

### Environment Variables (Backend)

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=your-secret-key-minimum-32-chars
PORT=3000
```

### Development Commands

```bash
# Root monorepo
pnpm install                    # Install all dependencies

# Backend
cd apps/backend
npm run start:dev               # NestJS with hot-reload (nodemon)
npx prisma migrate deploy       # Apply pending migrations
npx prisma generate             # Regenerate Prisma client (stop server first)
npm run db:seed                 # Seed institution data
npm run seed:platform           # Seed platform admin

# Frontend
cd apps/frontend
npm run dev                     # Next.js dev server (port 3001)
npm run build                   # Production build
npm run start                   # Production server
```

### Database Migrations

Migrations live at `apps/backend/prisma/migrations/`. Each migration folder contains:
- `migration.sql` — raw SQL applied to the database

**Applied migrations (chronological):**

| Timestamp | Migration |
|---|---|
| Previous | Initial schema (users, institutions, students, roles...) |
| 20260408030000 | `add_password_reset_requests` |
| 20260408050000 | `add_platform_admin_subscription` |

**To apply migrations:**
```bash
cd apps/backend
npx prisma migrate deploy
```

> **Note:** On Windows with Neon PostgreSQL, the DB connection may sleep. If `P1001` error appears, retry after 5 seconds.

### Neon PostgreSQL Notes

- Database is serverless and **auto-sleeps** after 5 minutes of inactivity
- First query after sleep takes ~1-2 seconds (cold start)
- In development, `prisma generate` can fail with `EPERM` if the NestJS server is running (DLL locked). Stop the server first, then generate.

---

## 16. Developer Log

> This section records all product decisions, features built, bugs fixed, and architectural changes in chronological order.

---

### Session 1 — Initial Foundation
**Date:** Early 2026  
**Commits:** `1164896`, `9bdda8a`, `5e133fe`

**Built:**
- Monorepo structure (`apps/backend`, `apps/frontend`)
- NestJS backend with Prisma + Neon PostgreSQL
- Institution model + initial schema
- Multi-tenant architecture foundation

---

### Session 2 — Core Platform Build
**Date:** April 2026

**Features Built:**
- Complete multi-tenant architecture with `TenantMiddleware` + `X-Institution-ID` header pattern
- JWT authentication (access + refresh token pair)
- All core modules: Students, Users, Roles, Academic, Inquiries, Subjects, Attendance, Fees, Exams, Announcements, Timetable
- Role-Based Access Control (7 default roles per institution)
- Audit log interceptor (global, tracks all mutations)
- Student admission flow (atomic: student + parent user + fee in one transaction)
- Student promotion/transfer/holdback (bulk)
- Fee management (heads → structures → payments → receipts)
- Exam management (create → add subjects → enter marks → scorecard → ranks)
- Attendance with monthly reports and defaulter lists
- Timetable with auto-generation
- Operator dashboard (Next.js App Router)
- Zustand auth store with localStorage persistence

---

### Session 3 — Bug Fixes + Parent Portal
**Date:** April 8, 2026

**Bugs Fixed:**

**1. Date picker selections resetting on admission form**  
*Root cause:* `DateSelect` component derived `d/m/y` from `value` prop inline. Selecting "day" without "month" called `onChange('')`, resetting parent state to `''`, re-rendering with empty selects.  
*Fix:* Added local `useState` for `d`, `m`, `y` inside `DateSelect`. Only calls `onChange()` when all three are filled. Partial selections are preserved in local state.

**2. Parent login rejected with "email must be an email"**  
*Root cause:* `LoginDto` had `@IsEmail()` on the `email` field. NestJS `ValidationPipe` with `whitelist: true` rejected phone numbers at the HTTP layer before reaching any controller code.  
*Fix:* Changed `@IsEmail()` to `@IsString() @IsNotEmpty()` in `LoginDto`. Added `findByEmailOrPhone()` to `UsersService` using Prisma `OR` clause.

**3. Parent accounts appearing in Staff Management**  
*Root cause:* `GET /users` returns all users including auto-created parent accounts. Staff page was showing everyone.  
*Fix:* Client-side filter in staff page — exclude users whose every role is `parent`.

**4. `changePassword()` throwing HTTP 500**  
*Root cause:* Used generic `throw new Error()` which NestJS maps to 500.  
*Fix:* Changed to `throw new BadRequestException()`.

**Features Built:**

**Forgot Password + Operator Reset Flow:**
- `POST /auth/forgot-password` — public endpoint, creates `PasswordResetRequest`
- `GET /auth/password-resets` — operator lists pending requests
- `POST /auth/password-resets/:id/approve` — generates 10-char temp password
- `POST /auth/password-resets/:id/reject` — rejects request
- Duplicate request prevention (throws 400 if pending request exists)
- Frontend: "Forgot password?" modal on login page (pre-fills school code)
- Frontend: Password Reset Requests panel in Operator Settings

**Operator Settings Page (`/dashboard/settings`):**
- Account info section (email, role badge)
- Password Reset Requests section (red count badge, approve/reject per request, generated password banner)
- Change Your Password section (old + new + confirm)

**Database Migration:** `20260408030000_add_password_reset_requests`  
Added `password_reset_requests` table with FK to `institutions` and `users`.

---

### Session 4 — Developer Platform Console
**Date:** April 8, 2026

**Features Built:**

**Platform Backend (`/platform/*`):**
- `PlatformAdmin` model (separate from institution users)
- `Subscription` model (linked to institutions)
- `PlatformModule` with `PlatformGuard` (validates `type: 'platform_admin'` in JWT)
- Complete onboarding API: one endpoint creates institution + roles + operator + subscription + defaults atomically
- Auto-institution code generation from school name (slugify, deduplicate with numeric suffix)
- Platform stats endpoint (total, active, expiring, expired, revenue)
- Client management: list, detail, status change, soft delete
- Subscription upsert: create or renew/upgrade

**Platform Frontend:**
- Dark-themed `/platform/login` page (separate from school login)
- `/platform/dashboard` — stats cards + recent clients table
- `/platform/clients` — full table with filter tabs (all/active/expired/no-sub)
- `/platform/clients/new` — onboarding form with live ₹ amount preview and success credentials panel
- `/platform/clients/[id]` — detail page with subscription editor and status controls
- `platform-auth.store.ts` — separate Zustand store (key: `platform-auth`)
- `platform-api.ts` — API helper without `X-Institution-ID` header

**Security:**
- Platform routes (`/platform/*`) excluded from `TenantMiddleware`
- Platform JWT cannot be used on institution endpoints (guard checks `type` field)
- Institution JWT cannot be used on platform endpoints

**Database Migration:** `20260408050000_add_platform_admin_subscription`  
Added `platform_admins` and `subscriptions` tables.

**Seed:**
- `npm run seed:platform` — creates first platform admin (`dev@infovion.in`)

---

### Session 5 — Stability Fixes
**Date:** April 8, 2026

**Bugs Fixed:**

**1. "Missing X-Institution-ID header" on platform login**  
*Root cause:* TenantMiddleware was using `req.path.startsWith('/platform')` but NestJS's middleware `req.path` may differ from `req.url` in certain configurations. The server also hadn't hot-reloaded due to `prisma generate` EPERM failure.  
*Fix (dual approach):*
- Updated `TenantMiddleware` to use `req.url || req.path` (more reliable)
- Updated `app.module.ts` `.exclude()` to use NestJS's path pattern matching at the framework level as the primary exclusion mechanism

**2. Operator auto-logout after 15 minutes**  
*Root cause:* JWT access token was set to `expiresIn: '15m'`. Any API failure during the refresh window (including server hot-reload) would cause `apiFetch` to call `logout()`.  
*Fix (two-part):*
- Extended JWT expiry to `24h` in `auth.module.ts`
- Fixed `tryRefreshToken()` in `api.ts`: only logout on definitive 401 from refresh endpoint itself. Network errors and 5xx during refresh return `null` silently (no logout). Prevents false logouts during server restarts in development.

**3. `seed:platform` failing with ESM error on Windows**  
*Root cause:* `npm run seed:platform` was using inline `{"module":"CommonJS"}` which Windows strips the curly braces from.  
*Fix:* Created `tsconfig.seed.json` extending base tsconfig with `"module": "CommonJS"`. Updated npm script to use `--project tsconfig.seed.json`.

---

## 17. Known Issues & Roadmap

### Known Issues

| Issue | Severity | Status |
|---|---|---|
| `maxStudents` subscription limit not enforced at API level | Medium | Planned v2 |
| No automated subscription expiry notifications | Low | Planned v2 |
| Platform console has no 2FA | Medium | Planned v2 |
| Audit log interceptor logs platform requests with null institutionId | Low | Pending |
| No email/SMS infrastructure — all communication is manual | Medium | Planned v2 |
| Student portal and teacher portals not yet implemented as separate routes | Medium | Planned |
| No file/document upload (TC documents, photos) | Low | Future |
| No report export (PDF marksheets, fee receipts) | Medium | Planned |

### Planned Features (Next Sessions)

**v1.1 — Configurable Class Structure**
- Tenant-configurable child-unit naming (Section/Division naming)
- Currently hardcoded as "Section A", "Section B" etc.

**v1.2 — Staff Onboarding Flow**
- Auto-credential generation for new staff at time of creation
- Access approval workflow
- Staff profile pages

**v1.3 — Announcements Verification**
- End-to-end testing across all portal types (operator, teacher, parent)
- Read receipts (viewed by count)

**v2.0 — Enforcement & Automation**
- Hard `maxStudents` limit enforcement
- Automated subscription expiry email/WhatsApp notifications
- PDF generation for marksheets and fee receipts
- Student and teacher dedicated portal routes
- Platform console 2FA (TOTP)
- API rate limiting

---

## Appendix A — Default Data Seeded Per Institution

### Fee Heads (10)
Tuition Fee, Exam Fee, Library Fee, Lab Fee, Sports Fee, Activity Fee, Development Fee, Admission Fee, Transport Fee, Hostel Fee

### School Subjects (22)
English, Hindi, Mathematics, Environmental Studies, General Knowledge, Science, Social Studies, Sanskrit, Marathi, Drawing & Craft, Physics, Chemistry, Biology, History, Geography, Political Science, Economics, Computer Science, Accountancy, Business Studies, Information Technology, Physical Education

### College Subjects (12)
English Communication, Mathematics, Physics, Chemistry, Biology, Computer Applications, Statistics, Economics, Commerce, Management, Environmental Studies, Soft Skills

### Roles (7)
super_admin (Director), admin (Operator), principal (Principal), teacher (Teacher), student (Student), parent (Parent), receptionist (Desk / Reception)

---

## Appendix B — Seed Accounts (Development)

| Account | Type | Institution Code | Email/Phone | Password |
|---|---|---|---|---|
| Platform Admin | Developer Console | N/A | dev@infovion.in | platform@dev123 |
| Director | Infovion Demo School | infovion | admin@infovion.in | admin123 |
| Operator | Infovion Demo School | infovion | operator@infovion.in | operator123 |

> **Security note:** All seed passwords must be changed before production go-live.

---

*End of Document*  
*Infovion Internal Documentation — Confidential*
