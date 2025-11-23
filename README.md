# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app

# hirehub

Monorepo for the HireHub microservices and shared packages. This repository uses npm workspaces and Turborepo for task orchestration.

**Quick overview**

- Root scripts: `build`, `dev`, `lint`, `format`, `check-types` (run with `npm run <script>` from repo root).
- Workspace layout (important folders):
  - `apps/` — microservices and application servers (e.g. `api-gateway`, `auth-service`)
  - `packages/` — shared packages and config (eslint, tsconfig, etc.)
  - `shared/` — shared TypeScript code (dtos, entities, utils, database, redis)

Repository structure (relevant paths)

```
package.json
apps/
	api-gateway/
	auth-service/
packages/
	eslint-config/
	typescript-config/
shared/
	src/
		constants/
		database/
		dtos/
		entities/
		redis/
		util/
```

Prerequisites

- Node.js >= 18 (project `engines` requires Node >=18)
- npm (this repo uses npm workspaces; `packageManager` in root is `npm@11.6.2`).

Getting started (install)

From the repository root:

```bash
npm install
```

This installs dependencies for the root and workspace packages.

Creating a new app (step-by-step)

There are a few ways to scaffold a new app. Below are two common options.

1. Scaffold a new NestJS app with the Nest CLI (recommended for Nest services)

```bash
# from repo root
npx @nestjs/cli new apps/<app-name> --package-manager npm

# the CLI will create `apps/<app-name>` and a package.json inside it
```

Notes:

- Because the root `package.json` uses the `apps/*` workspace glob, new apps inside `apps/` are automatically included in the workspace — you do not need to update the root config.
- After the CLI finishes, run `npm install` at the root again to install workspace deps.

2. Create a minimal app manually

```bash
# create directory and package.json
mkdir -p apps/<app-name>
cat > apps/<app-name>/package.json <<'JSON'
{
	"name": "<app-name>",
	"version": "0.0.1",
	"private": true,
	"scripts": {
		"dev": "nest start --watch",
		"start": "nest start",
		"build": "nest build"
	}
}
JSON

# add source files (copy a small starter from another app or scaffold manually)
```

Running a single service

Option A — change directory and run the app's dev script:

```bash
cd apps/api-gateway
npm run dev
```

Option B — run via npm workspace from the repo root (no `cd`):

```bash
# runs the `dev` script defined in apps/api-gateway/package.json
npm --workspace=api-gateway run dev
```

Note: the value for `--workspace=` is the `name` field in the service's `package.json` (e.g. `api-gateway` or `auth-service`).

Running all services (concurrently)

Preferred (Turborepo): use the root `dev` script which delegates to workspace `dev` scripts via `turbo`:

```bash
# from repo root
npm run dev
```

This runs `turbo run dev` which will execute the `dev` script in each workspace that defines it.

Alternative (without turbo): use `concurrently` and npm workspaces to run specific services:

```bash
# install concurrently if you want a quick local runner
npx concurrently \
	"npm --workspace=api-gateway run dev" \
	"npm --workspace=auth-service run dev"
```

Build and run production

Build everything:

```bash
npm run build
```

Build and run a single service in production:

```bash
# build first
npm --workspace=api-gateway run build

# then run the compiled output
npm --workspace=api-gateway run start:prod
```

Tips and troubleshooting

- If a newly created app doesn't appear in workspace commands, run `npm install` from the root to refresh node_modules and workspace links.
- To run tests for a workspace package: `npm --workspace=auth-service run test`.
- To run lint for all workspaces: `npm run lint` (uses `turbo run lint`).

If you want, I can also:

- Add a small generator script to scaffold apps with a consistent template.
- Add a root `start:all` script that uses `concurrently` for environments where you prefer not to use `turbo dev`.

---

If you'd like adjustments (for example: Yarn/PNPM examples, or a custom app template), tell me which option you prefer and I'll add it.
