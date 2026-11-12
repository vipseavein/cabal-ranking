# CABAL Quiz Worker + D1

This Worker is the server-side Quiz API for the public CABAL Ranking site.

## Free architecture

- Existing site: https://cabal-ranking.pages.dev/
- Quiz play page: /quiz/
- API: Cloudflare Worker in the new Cloudflare account
- Database: Cloudflare D1
- Question bank: 15,000 gameplay-only questions
- No Firebase / Blaze required

## D1 binding

Binding name must be exactly:

QUIZ_DB

Recommended database name:

cabal-ranking-quiz-v5

## Endpoints

POST /api/quiz/start
POST /api/quiz/answer
POST /api/quiz/finish
POST /api/quiz/record
GET  /api/quiz/leaderboard
GET  /api/quiz/health

The Worker enables public CORS because the frontend may remain on the existing pages.dev deployment while the API runs in the new Cloudflare account.

Do NOT commit the private seed SQL files containing answer keys.
