const isCloudflarePages = /(^|\.)pages\.dev$/.test(location.hostname);
window.CABAL_QUIZ_API_BASE = isCloudflarePages ? '' : 'https://cabal-quiz-api-staging.seavein.workers.dev';
window.CABAL_QUIZ_PLAY_BASE='/quiz/';
