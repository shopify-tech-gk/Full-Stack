# YouMart

YouMart is an ecommerce platform built as a pnpm-workspaces monorepo.

## Tech stack

- Node.js 20, TypeScript (strict mode)
- pnpm workspaces for monorepo management
- Express + TypeScript for backend services (added in later prompts)
- Prisma as the ORM (added in later prompts)
- Zod for validation (added in later prompts)

## Repository structure

```
apps/       backend services and, later, frontends
packages/   shared packages used across apps
docker/     docker-compose and infrastructure config
docs/       architecture documentation
```

## Install

```bash
pnpm install
```

## Common scripts

```bash
pnpm lint        # lint the whole repo
pnpm format      # format the whole repo with Prettier
pnpm typecheck   # typecheck all workspaces
```

## Running infrastructure

Docker-based infrastructure (databases, etc.) will be added in `docker/` in a later prompt.
