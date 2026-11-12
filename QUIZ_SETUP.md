# CABAL Quiz • 15,000-question Worker + D1 setup

This branch adds Quiz without replacing the existing Ranking Hub data or assets.

## URLs

- `/` → Ranking Hub. The first tab is **Quiz** and shows Quiz leaderboards only.
- `/quiz/` → dedicated Quiz gameplay page.
- Quiz API → separate Cloudflare Worker `cabal-quiz-api`.

Existing Guild Ranking, Mission Festival, Legend Arena, Achievement Rank, Guild Information and Nation War logic remain in the same Ranking Hub.

## Quiz tiers

- **High** = 15 questions
- **Highest** = 30 questions
- **Ultimate** = 50 questions

Each tier has separate Overall / Daily / Weekly / Monthly / Yearly rankings using GMT+7.

## Player flow

1. Choose High / Highest / Ultimate.
2. Worker selects random questions from the 15,000-question bank.
3. A/B/C/D positions are shuffled separately for every attempt.
4. After each answer, the Worker returns Correct / Incorrect and the correct answer.
5. An answered question is locked and cannot be changed.
6. After the final question, the player sees congratulations, score, accuracy, completion time and provisional ranking.
7. The player enters only Name / IGN to save the record.
8. The result page can expand **Review Correct Answers**, with Incorrect-only or All-question views.

## Worker API

- POST `/api/quiz/start` — body `{"count":15|30|50}`
- POST `/api/quiz/answer`
- POST `/api/quiz/finish`
- POST `/api/quiz/record`
- GET `/api/quiz/leaderboard?size=15|30|50&period=all|day|week|month|year`
- GET `/api/quiz/health`

The browser never receives the canonical answer key in `/start`. Only after a player commits an answer does `/answer` return the correct answer for that single question.

## Cloudflare D1

Recommended database name:

`cabal-ranking-quiz-v5`

Worker D1 binding name must be exactly:

`QUIZ_DB`

After seeding, `/api/quiz/health` must report:

`questionCount: 15000`

## Frontend API configuration

The website loads `quiz-config.js`.

After the Worker is deployed, set:

```js
window.CABAL_QUIZ_API_BASE='https://<worker-url>';
```

This lets the existing `cabal-ranking.pages.dev` frontend use a Worker hosted in the new Cloudflare account.

## Safe deployment

Production `main` is not modified while this branch is being prepared.

Backup branch:

`backup-before-quiz-2026-11-12`

Merge only after Worker + D1 health, 15/30/50 quiz flow, instant feedback, record saving, review and ranking all pass.
