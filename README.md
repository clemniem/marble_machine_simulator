# Marble Machine Simulator

Web-based simulation where you build marble runs with a visual node editor.

## Prerequisites

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Run locally

Start the Vite dev server:

```bash
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173). You should see "Marble Machine Simulator" in the browser.

## Run tests

One-off run:

```bash
npm test
```

Watch mode (re-run on file changes):

```bash
npm run test:watch
```

All tests live under `src/**/__tests__/*.test.ts` and use Vitest.

## Troubleshooting

**`npm warn Unknown env config "devdir"`** — This comes from your environment (e.g. Cursor or another tool setting `NPM_CONFIG_DEVDIR`). It’s harmless. To hide it when running npm in your own terminal, run:

```bash
unset NPM_CONFIG_DEVDIR
```

before `npm install` / `npm run dev`, or add that line to your shell profile if you want it unset everywhere.
