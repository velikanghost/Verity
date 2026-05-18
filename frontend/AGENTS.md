<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend AI Agent Development Rules

All agents working in this repository must follow these frontend engineering standards.

The frontend architecture must remain:
- modular
- scalable
- reusable
- maintainable
- predictable

Avoid overengineering.

---

# Component Architecture

## Minimal Components

Components must:
- remain small and focused
- handle a single responsibility
- avoid excessive logic
- avoid deeply nested JSX

If a component becomes too large:
- extract subcomponents
- extract hooks
- extract utilities

Prefer composition over monolithic components.

---

# Generic UI Components

Reusable UI components belong in:

```txt
components/ui
```

Examples:
- Button
- Input
- Modal
- Select
- Card
- Table
- Badge
- EmptyState
- Loader
- Skeleton

Rules:
- avoid duplicated UI patterns
- extend existing generic components first
- keep UI components reusable and configurable
- keep styling consistent across the application

---

# Icons

All icons must exist in dedicated files.

Preferred structure:

```txt
components/icons
```

Rules:
- never inline large SVGs inside feature components
- icons must be reusable
- icons should accept props
- keep icon logic isolated

---

# State Management

Use Zustand for:
- global state
- shared state
- persisted state
- UI state

Avoid:
- unnecessary React Context
- excessive prop drilling

Preferred structure:

```txt
stores/
  auth.store.ts
  modal.store.ts
  theme.store.ts
```

Rules:
- stores should remain small
- stores should be domain-focused
- avoid massive global stores

---

# Server State & API Requests

Use TanStack Query for:
- API requests
- caching
- mutations
- optimistic updates
- invalidation
- background refetching

Rules:
- do not fetch directly inside components
- keep query logic separated
- use custom hooks for queries and mutations
- keep query keys organized and consistent

Preferred structure:

```txt
hooks/query
services
```

Preferred naming:

```ts
useUsersQuery()
useCreateProjectMutation()
```

---

# API Layer

API logic belongs in services.

Preferred structure:

```txt
services/
  auth/
  users/
  dashboard/
```

Components should never contain:
- raw fetch logic
- axios logic
- heavy transformation logic
- request configuration logic

---

# Folder Structure

Prefer modular and feature-based organization.

Example:

```txt
src/
  components/
    ui/
    icons/

  features/
    auth/
    dashboard/
    settings/

  hooks/
  services/
  stores/
  types/
  utils/
```

Each feature may contain:
- components
- hooks
- services
- types
- utils

---

# React Standards

- use functional components only
- keep components presentation-focused where possible
- move heavy logic into hooks/utils
- avoid unnecessary state
- prefer derived state
- avoid unnecessary useEffect usage

Prefer:
- custom hooks
- reusable abstractions
- composition

---

# TypeScript Standards

- use strict typing
- avoid `any`
- prefer reusable shared types
- use explicit return types for exported functions
- keep DTOs/types organized

---

# Styling Standards

- keep styling reusable
- avoid duplicated classNames
- extract repeated patterns
- maintain consistent spacing and layout patterns
- follow existing design system conventions

---

# Clean Code Standards

Agents must:
- avoid duplicated logic
- avoid giant files
- avoid giant components
- use clear naming
- use early returns
- reduce nesting

Prefer:
- composition
- reusable utilities
- extracted hooks
- readable code over clever code

---

# Performance Standards

Avoid:
- unnecessary re-renders
- unnecessary global state
- unnecessary effects

Prefer:
- derived state
- query caching
- lazy loading where appropriate
- memoization only when necessary

---

# Change Discipline

Agents should:
- modify only relevant files
- preserve existing architecture
- follow existing patterns
- keep diffs minimal and focused

Do not:
- introduce unnecessary abstractions
- rewrite stable systems unnecessarily
- add new libraries casually

---

# Completion Checklist

Before completing any task:
- ensure types pass
- ensure imports are clean
- ensure reusable patterns are followed
- ensure architecture consistency
- ensure components remain minimal
- ensure code is production-ready
