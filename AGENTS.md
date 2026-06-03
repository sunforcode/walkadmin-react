# Walk Admin React AI Instructions

This file guides AI assistants working in `walkadmin-react/`.

## Role

`walkadmin-react` is the operations/admin console. It manages users, routes, trips, guides, equipment, and Agent service visibility through `walkbg` APIs.

## Read Before Editing

1. `../AGENTS.md`
2. `../DEVELOPMENT_PARADIGM.md`
3. `../AI_DEVELOPMENT.md`
4. `README.md`
5. `src/services/api.js`
6. Relevant page under `src/pages/`

If the change modifies API behavior, DTO shape, enum meaning, pagination, errors, or Agent task state, read or create the relevant root OpenSpec change first.

## Architecture

```text
src/
├── App.jsx
├── main.jsx
├── components/
├── context/
├── pages/
└── services/api.js
```

Standard flow:

```text
Page -> API service -> axios client -> walkbg API
```

## Rules

- Keep API endpoints, auth handling, response extraction, and enum mappings centralized in `src/services/api.js` or focused service modules.
- Do not scatter raw endpoint strings across page components.
- Do not create admin-only enum meanings that differ from Flutter or backend.
- Form fields and table columns that represent business data must come from API contracts.
- Keep page components focused on layout, table state, filters, forms, modals, and feedback.
- High-risk actions such as delete, publish, offline, approve, or batch mutation need clear confirmation and failure feedback.
- Compatibility parsing is allowed only as a migration bridge and should have a cleanup task.

## Verification

Use:

```bash
npm run lint
npm run build
```

For UI-impacting changes, also run the local dev server and inspect the affected page when practical.

