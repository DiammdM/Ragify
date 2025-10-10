# Repository Guidelines

## Project Structure & Module Organization
- Next.js App Router lives in `src/app`; each feature sits in `src/app/<feature>` with colocated `layout.tsx` and `page.tsx` when needed.
- Shared design scaffolding is in `src/app/layout.tsx` and global styles land in `src/app/globals.css` alongside Tailwind layer definitions.
- Keep domain utilities and server helpers under `src/lib` or `src/server`; store static assets in `public/`, database schema in `prisma/`, and planning notes in `doc/`.

## Build, Test, and Development Commands
- `npm run dev` boots the Turbopack dev server at `http://localhost:3000` with hot reload; ideal for everyday work.
- `npm run build` produces the optimized production bundle; always run before shipping.
- `npm run start` serves the built output locally to validate production behavior.
- `npm run lint` runs ESLint; append `-- --fix` to autofix formatting issues caught by the config.

## Coding Style & Naming Conventions
- Author new code in TypeScript ES modules; prefer server components and keep client components minimal and purpose-built.
- Name React components in PascalCase (e.g., `SearchPanel`), hooks in camelCase (e.g., `useEmbeddings`), utilities in kebab-case, and tests as `*.test.tsx` or `*.spec.ts` next to the code.
- Let Prettier via ESLint handle formatting; follow Tailwind utility grouping patterns established in `globals.css` instead of custom CSS.

## Testing Guidelines
- Use React Testing Library with Vitest or Jest; create colocated tests that cover core flows, edge cases, and integration with server components.
- Until a runner is scripted, document manual verification steps in PRs and ensure `npm run lint` passes before requesting review.

## Commit & Pull Request Guidelines
- Write imperative commit subjects under 72 characters (e.g., `Add search panel state store`); squash noisy WIP history before review.
- Pull requests should state the problem, outline the solution, list verification steps (commands, screenshots, screencasts), and link related issues.
- Call out schema or config edits so reviewers can anticipate deployment or migration impact.

## Security & Configuration Tips
- Keep secrets in `.env.local` and access them through `process.env`; never commit sensitive values.
- Update `next.config.ts` when changing runtime features or image domains, and note the change in the PR description.
- Exclude generated artifacts, large binaries, and temp datasets from version control to keep the repository lean.
