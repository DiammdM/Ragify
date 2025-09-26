# Repository Guidelines

## Project Structure & Module Organization
Ragify uses the Next.js App Router. Primary routes live in `src/app`, where `layout.tsx` shares chrome and `page.tsx` renders the default view. Global styles and Tailwind layers sit in `src/app/globals.css`. Place static assets in `public/` and keep planning notes in `doc/`. Group new feature modules under `src/app/<feature>` so routes and server components stay discoverable.

## Build, Test, and Development Commands
- `npm run dev` launches the Turbopack dev server at `http://localhost:3000` with hot reload.
- `npm run build` compiles an optimized production bundle; run before deploying.
- `npm run start` serves the built output locally to confirm production behavior.
- `npm run lint` runs ESLint with the Next.js shareable config; add `-- --fix` for auto-fixes.

## Coding Style & Naming Conventions
Write new code in TypeScript with ES modules. Name React components in PascalCase (e.g., `SearchPanel`), hooks in camelCase (e.g., `useEmbeddings`), and utility files in kebab-case. Favor functional and server components, keeping client components limited to interactive needs. Use Tailwind utility groupings consistent with `globals.css`, minimizing ad-hoc CSS. Let the linter or your editor handle formatting and import order before committing.

## Testing Guidelines
No automated test runner ships yet, so introduce tests alongside new functionality. Prefer colocated `*.test.tsx` or `*.spec.ts` files using React Testing Library and Vitest/Jest once configured. Validate core behaviors, edge states, and integration with Next.js server components. Until a runner is wired in, document manual verification in the PR and ensure `npm run lint` passes as a baseline gate.

## Commit & Pull Request Guidelines
Write commit subjects in the imperative mood with at most 72 characters, mirroring the existing history (e.g., `Add search panel state store`). Squash noisy WIP commits before opening a review. Pull requests should describe the problem, summarize the solution, list verification steps (commands, screenshots, or screencasts), and link related issues. Call out migrations or config edits so reviewers can assess deployment impact.

## Environment & Configuration Tips
Store secrets only in `.env.local`, reference them via `process.env`, and document required keys in the README. Update `next.config.ts` when changing runtime or image settings and note the change in your PR. Keep large binaries and generated artifacts out of version control to preserve repository size.
