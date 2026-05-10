# MaintainerOSS  

Repo-native work router for the agent era.

MaintainerOSS is the open-source workspace for MaintainerOS.

MaintainerOS helps open-source maintainers turn issue backlogs into action: agents fix safe issues, maintainers review risky ones, and bounties become Clustly tasks with USDC payout artifacts released only after PR verification.

This repo is a single-root Next.js app. The application routes live in `app/`, reusable UI lives in `components/`, and MaintainerOS provider/domain code lives in `lib/maintaineros/`.

## Demo Principle

The live demo should start from real GitHub-hosted issue backlogs. Neon is the import/cache layer. Fixture/offline mode remains the fallback path.

## App Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) after `npm run dev`.

## Prep Commands

```bash
npm run fixtures:generate
npm run github:seed-demo
npm run neon:smoke-import
npm run ci
```

The checked-in prep path includes GitHub demo seeding, a Neon schema, env template, generated 400/200 issue fallback backlogs, and a lightweight CI check.
