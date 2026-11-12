# CABAL Quiz • 15,000-question tiered setup

This branch adds Quiz without replacing the existing Ranking Hub data or assets.

## URLs

- `/` → Ranking Hub. The first tab is **Quiz** and shows Quiz leaderboards only.
- `/quiz/` → dedicated Quiz gameplay page.

Existing Guild Ranking, Mission Festival, Legend Arena, Achievement Rank, Guild Information and Nation War logic remain in the same Ranking Hub.

## Quiz tiers

- **High** = 20 questions
- **Highest** = 50 questions
- **Ultimate** = 100 questions

Each tier has separate Overall / Daily / Weekly / Monthly / Yearly rankings using GMT+7.

## Player flow

1. Choose High / Highest / Ultimate.
2. Server selects random questions from the 15,000-question bank.
3. A/B/C/D positions are shuffled separately for every attempt.
4. After each answer, the server immediately returns Correct / Incorrect and the correct answer.
5. An answered question is locked and cannot be changed.
6. After the final question, the player sees congratulations, score, accuracy, completion time and provisional ranking.
7. The player enters only Name / IGN to save the record.
8. The result page can expand **Review Correct Answers**, with Incorrect-only or All-question views.

## API

- POST `/api/quiz/start` — body `{"count":20|50|100}`
- POST `/api/quiz/answer` — instant feedback and answer lock
- POST `/api/quiz/finish` — finalize score/time without Name
- POST `/api/quiz/record` — save completed result with Name / IGN
- GET `/api/quiz/leaderboard?size=20|50|100&period=all|day|week|month|year`
- GET `/api/quiz/health`

The browser never receives the canonical answer key in `/start`. Only after a player commits an answer does `/answer` return the correct answer for that single question.

## Cloudflare D1

Pages D1 binding name:

`QUIZ_DB`

Use the private **15,000-question tiered D1 package** supplied separately. It contains the answer key and must not be committed to this public repository.

After seeding, verify:

`https://cabal-ranking.pages.dev/api/quiz/health`

Expected:

`questionCount: 15000`

## Safe deployment

The production `main` branch is not modified while this branch is being prepared.

Backup branch created before Quiz integration:

`backup-before-quiz-2026-11-12`

Merge the Quiz PR only after D1 is configured, seeded and the preview/deployment has been checked.
