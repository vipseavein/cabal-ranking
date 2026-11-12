# CABAL Quiz integration setup

This branch adds a **Quiz** tab to the existing CABAL Ranking Hub without replacing the ranking data, Mission Festival, Guild Information, Nation War, or site assets.

## What is public in this repository

- Quiz UI: `quiz.js`, `quiz.css`
- Cloudflare Pages Functions:
  - `/api/quiz/start`
  - `/api/quiz/finish`
  - `/api/quiz/leaderboard`
  - `/api/quiz/health`
- D1 schema: `migrations/0001_quiz_schema.sql`

The **9,999-question seed is intentionally NOT committed to this public repository** because it contains the answer key.

## Quiz rules

- 100 unique random questions per attempt
- English / Vietnamese
- 1 point per correct answer, maximum 100
- Ranking: score DESC, then completion time ASC
- Overall / Daily / Weekly / Monthly / Yearly
- Period boundaries use GMT+7
- Only the player's Name / IGN is collected
- No AID, UID, email, admin page, or private player identifier
- Leaderboard keeps the best result per normalized Name for each period

## Cloudflare D1 setup

1. Create a D1 database, for example `cabal-ranking-quiz`.
2. In the Cloudflare Pages project for `cabal-ranking.pages.dev`, add a D1 binding:
   - Variable name: `QUIZ_DB`
   - Database: the D1 database created above.
3. Apply the schema:

```bash
npx wrangler d1 execute cabal-ranking-quiz --remote --file=migrations/0001_quiz_schema.sql --yes
```

4. Load the private 9,999-question seed package supplied separately. Do not commit those SQL seed files to the public repository.
5. Redeploy the Pages project after adding the D1 binding.
6. Verify:

```text
https://cabal-ranking.pages.dev/api/quiz/health
```

Expected after seeding:

```json
{"ok":true,"questionCount":9999,"expectedQuestions":9999}
```

## Security model

The browser never receives the `correct` column. `/api/quiz/start` returns only question text and four options. `/api/quiz/finish` retrieves the answer key from D1 and scores the attempt server-side.

Because the requested flow uses Name only, player identity is trust-based. Two people can intentionally submit the same Name; the leaderboard treats those submissions as the same public identity and displays the best result for that Name in the selected period.
