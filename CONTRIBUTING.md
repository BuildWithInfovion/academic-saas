# Contributing — Branching & Release Strategy

## Branch Model

```
main          ← production  (protected, no direct push)
develop       ← integration / testing  (merge PRs here)
feature/*     ← new features  (branch from develop)
fix/*         ← non-urgent bug fixes  (branch from develop)
hotfix/*      ← urgent production fixes  (branch from main)
```

## Rules

| Branch | Who can push directly | How it gets updated |
|--------|-----------------------|---------------------|
| `main` | Nobody | PR from `develop` (or `hotfix/*`) only |
| `develop` | Nobody | PR from `feature/*` or `fix/*` |
| `feature/*` | Author | Direct push |
| `fix/*` | Author | Direct push |
| `hotfix/*` | Author | Direct push |

## Workflow: New Feature

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Work, commit often
git add <files>
git commit -m "feat: describe what you did"

# 4. Push and open PR → target: develop
git push origin feature/your-feature-name
# Open PR on GitHub: feature/your-feature-name → develop
```

## Workflow: Bug Fix (non-urgent)

```bash
git checkout develop && git pull origin develop
git checkout -b fix/describe-bug
# fix, commit
git push origin fix/describe-bug
# Open PR → develop
```

## Workflow: Hotfix (production issue)

```bash
# Branch from main — NOT develop
git checkout main && git pull origin main
git checkout -b hotfix/describe-issue
# fix, commit
git push origin hotfix/describe-issue
# Open TWO PRs:
#   1. hotfix/* → main   (deploy fix)
#   2. hotfix/* → develop (keep develop in sync)
```

## Workflow: Release to Production

```bash
# When develop is stable and tested:
# Open PR: develop → main
# Merge with "Merge commit" (not squash) so history is preserved
# Tag the release after merge:
git checkout main && git pull origin main
git tag v1.x.x -m "Release v1.x.x"
git push origin v1.x.x
```

## Commit Message Format

```
<type>: <short description>

Types: feat | fix | refactor | docs | chore | test | hotfix
```

Examples:
```
feat: add receptionist portal inquiry management
fix: student GET /students returns 500 when page param missing
hotfix: JWT secret rotated after accidental exposure
refactor: extract role routing to auth-utils helper
```

## Environment Setup

1. Copy `.env.example` → `.env` in `apps/backend/`
2. Copy `.env.local.example` → `.env.local` in `apps/frontend/`
3. Fill in real values — **never commit `.env` or `.env.local`**
4. Run: `cd apps/backend && npm run start:dev`
5. Run: `cd apps/frontend && npm run dev`
6. Seed the database: `cd apps/backend && npx ts-node -r tsconfig-paths/register prisma/seed.ts`

## Protected Branches (set up on GitHub)

Go to **Settings → Branches** and add rules for `main` and `develop`:

- [x] Require pull request reviews before merging (1 approval)
- [x] Dismiss stale reviews when new commits are pushed
- [x] Require status checks to pass before merging (if CI is set up)
- [x] Do not allow bypassing the above settings
