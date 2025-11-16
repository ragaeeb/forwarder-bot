# Repository Guidance

Welcome! This project is a Bun + TypeScript Telegram bot. Please follow these rules when contributing:

## Project layout
- `src/` – runtime bot code, services, handlers, and utilities.
- `api/` – serverless adapters (e.g., Vercel routes).
- `scripts/` – operational tooling and migration helpers executed with `bun <script>.ts`.
- `test/` – Vitest setup helpers.
- `dist/` – build artifacts (ignored); do not edit by hand.

## Development workflow
1. Install dependencies with `bun install`.
2. Keep dependencies up-to-date with `bun update --latest` when requested.
3. Run unit tests via `bun test` and ensure `bun run build` succeeds before opening a PR.
4. Use `bunx biome check .` to lint/format – Biome is the source of truth for code style. No ESLint/Prettier files should be added.

## Coding conventions
- Prefer TypeScript modules with explicit exports; avoid default exports unless already established.
- Maintain multi-bot awareness – most functions must receive or derive `botUsername` when interacting with storage.
- Database services should implement `DataService` (`src/services/types.ts`). When adding new persistence logic, keep per-bot namespacing consistent with `MongoDataService`.
- For scripts, accept configuration through environment variables (document them in the README when user-facing).
- Log meaningful context using `src/utils/logger.ts` helpers instead of `console` in runtime code. Operational scripts may use `console`.

## Documentation & PRs
- Update README sections and any relevant docs when adding new features, scripts, or required env vars.
- Keep changelog-style PR descriptions concise but comprehensive.
- Cite files and test output in responses per system instructions.
