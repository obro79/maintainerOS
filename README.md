# MaintainerOSS

**Repo-native work routing for open-source maintainers: agent fixes, contributor bounties and PR verification, all tied to reviewable proof.**

[![CI](https://github.com/obro79/maintainerOS/actions/workflows/ci.yml/badge.svg)](https://github.com/obro79/maintainerOS/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Postgres](https://img.shields.io/badge/Neon%20Postgres-00E599?logo=postgresql&logoColor=001E2B)

**1st Overall and 1st Clustly prize, Cursor AI Hackathon**

<!-- DEMO GIF: record a 20-30s walkthrough (connect repo -> routed backlog -> PR verification) and save it as public/screenshots/demo.gif -->

MaintainerOSS is the open-source workspace for MaintainerOS. It imports GitHub issue backlogs, classifies work into operating lanes, prepares context for safe automation, keeps risky work in maintainer review, and gates bounty payouts on fresh PR verification.

## What It Does

- Imports up to 5,000 open issues, plus open PRs and Greptile review comments, from any public GitHub repo.
- Routes each issue into one of four lanes: AI agent work order, maintainer review, funded bounty, or needs clarification.
- Runs agent fix attempts in Daytona sandboxes with Nia context packs, and turns them into PRs.
- Verifies every PR with Greptile before a maintainer accepts it, and only releases Clustly bounty payouts after that verification.

## Architecture

```mermaid
flowchart LR
    GH[GitHub issues and PRs] -->|import + daily cron| IMP[github-import]
    IMP --> DB[(Neon Postgres)]
    DB --> RT[routing: CLōD lane decision]
    RT -->|AI| AG[agent execution in Daytona + Nia context]
    RT -->|DEV / CLARIFY| MR[maintainer review queue]
    RT -->|CLUSTLY| BT[bounty lifecycle]
    AG --> PR[pull request]
    BT --> PR
    PR --> VF[Greptile verification + PR gates]
    VF --> AC{maintainer acceptance}
    AC --> MG[merge or payout]
```

The Next.js app (`app/`) serves the dashboard and API routes. Domain logic lives in `lib/maintaineros/`: `routing.ts` picks the lane, `agent-execution.ts` and `daytona.ts` run fix attempts, `verification.ts` and `pr-gates.ts` hold the trust boundary, and `payout.ts` and `bounty-lifecycle.ts` gate money movement on verified PRs. Fixture mode swaps the Neon repository for local JSON backlogs so the whole flow runs offline.

## Sponsor & Provider Stack

[![GitHub](https://img.shields.io/badge/GitHub-issue%20import%20%26%20PRs-181717?logo=github&logoColor=white)](https://github.com)
[![Neon](https://img.shields.io/badge/Neon-live%20Postgres-00E599?logo=neon&logoColor=001E2B)](https://neon.com)
[![CLōD](https://img.shields.io/badge/CL%C5%8DD-routing%20model-3F72AF)](#)
[![Nia](https://img.shields.io/badge/Nia-context%20packs-DBE2EF)](#)
[![Daytona](https://img.shields.io/badge/Daytona-sandbox%20attempts-0A0A0A)](https://www.daytona.io)
[![Greptile](https://img.shields.io/badge/Greptile-PR%20verification-112D4E)](https://www.greptile.com)
[![Clustly](https://img.shields.io/badge/Clustly-bounty%20rail-22C55E)](#)
[![Stripe](https://img.shields.io/badge/Stripe-checkout%20billing-635BFF?logo=stripe&logoColor=white)](https://stripe.com)

![MaintainerOS product landing page](public/screenshots/home.png)

## Product Surfaces

### Product Landing

The landing page explains the end-to-end issue workflow: GitHub import, context gathering, CLōD route decisions, PR and Greptile gates, and merge or payout proof.

### Connect Repo

Maintainers can connect a public GitHub repository, import open issues, and route the backlog into MaintainerOS without requiring private-repo scopes.

![MaintainerOS connect repo flow](public/screenshots/connect.png)

### Docs

The docs page describes the operating model for GitHub import, routing lanes, Greptile verification, and Clustly bounty packaging.

![MaintainerOS docs page](public/screenshots/docs.png)

## Routing Model

MaintainerOS turns issue backlogs into four clear operating lanes:

- **AI**: scoped issues that can become agent work orders.
- **DEV**: risky or architectural issues that need maintainer judgment.
- **CLUSTLY**: bounty-ready issues with funding and payout proof requirements.
- **CLARIFY**: incomplete issues that need a reply, repro request, or close recommendation.

## Trust Boundary

MaintainerOS treats automation as a proposal, not a result. Agent work, contributor submissions, and bounty releases all stay behind explicit verification gates:

```text
issue -> route -> context -> attempt or task -> PR -> verification -> maintainer acceptance -> merge or payout
```

Recent `main` work tightened that boundary by adding async Greptile verification evidence, applying agent text edits directly, hardening patch execution, recounting generated patches, and including repository file context in agent patch requests.

## Project Layout

```text
app/                    Next.js routes and API handlers
components/blocks/      Product, docs, changelog, and repository surfaces
components/maintaineros/ MaintainerOS workflow panels and controls
data/mock-repos/        Fixture issue backlogs for local demo mode
infra/neon/             Neon schema and import support
lib/maintaineros/       Routing, provider adapters, verification, payout logic
public/screenshots/     README screenshots captured from the local app
scripts/                Smoke tests, fixture generation, provider prep
```

## Local Setup

Use Node.js `>=20.9.0`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If that port is busy, Next.js will print the alternate local URL.

## Data Modes

Fixture mode is the default path for local work and demos:

```bash
MAINTAINEROS_OFFLINE_MODE=true
MAINTAINEROS_DATA_MODE=fixture
```

Live imports use Neon/Postgres plus GitHub settings from `.env.example`:

```bash
MAINTAINEROS_OFFLINE_MODE=false
MAINTAINEROS_DATA_MODE=live
NEON_DATABASE_URL=...
GITHUB_TOKEN=...
```

GitHub imports default to the first 5,000 open issues so large public repositories can populate the live dashboard without manual limit changes. The import path also captures open pull requests and Greptile comments so verification queues can show live review evidence.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run ci
```

Provider and demo prep:

```bash
npm run fixtures:generate
npm run github:seed-demo
npm run neon:smoke-import
npm run prep:check
npm run backend:check
```

## Tests

The core workflow is covered by TypeScript smoke suites in `scripts/`, which run as part of `npm run ci`:

```bash
npm run test:routing-policy          # lane routing decisions
npm run test:issue-workflow          # issue -> work order projection
npm run test:agent-execution         # agent patch generation and execution
npm run test:ai-execution-artifacts  # attempt evidence and artifacts
npm run test:greptile-v2             # Greptile verification parsing
npm run test:verification-payout     # payouts only after verification
npm run test:connect-oauth           # GitHub OAuth connect flow
```

## Deployment Check

Before deploying or landing changes, run the narrowest useful checks for the touched surface. For README-only changes, verify Markdown assets exist and run:

```bash
npm run lint
npm run build
```

For application or provider changes, use:

```bash
npm run ci
```

## Team

Built by [Owen Fisher](https://github.com/obro79) with Andy L, Jessica Zhou and Carson Kyba.
