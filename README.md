# Dota2 Match Analyzer

Web app in Next.js to fetch a Dota 2 match from OpenDota by `match_id` and return a direct match analysis.

## Requirements

- Node.js 22+
- pnpm

## Setup

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`, enter a `match_id`, choose your hero (optional), then click **Analizar partida**.

If you need to find your `match_id`, use OpenDota: https://www.opendota.com/

## Usage limits

- The API enforces a rate limit of 5 analysis requests per hour per IP.

## Tests

```bash
pnpm test
```

## Environment

- `.env` exists in this project.
- Free tier mode is active now, so no `OPENDOTA_API_KEY` is required.
- For analysis generation, set `OPENAI_API_KEY` in `.env`.
- Optional: `OPENAI_MODEL` (default is `gpt-4.1`).
