# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Implementation plan:

- Presentation tier decision: Keep React pages focused on rendering API data and interaction. Use the shared API client with relative `/api` paths, and show accessible loading, empty, and error states.
- Logic tier decision: Keep request validation and capability behavior in Express services behind the existing routes. Return deliberate 4xx responses for invalid input or missing records; do not expose Mongoose cast errors as 500s.
- Data tier decision: Define required fields, references, and defaults in the Mongoose models. Seed representative users, teams, activities, and workouts idempotently without deleting or modifying unrelated records.
- Activity tracking approach: Validate `userId` and `teamId` formats and existence before creating an activity. Store the resolved references, submitted type and minutes, points computed from minutes, and the occurrence time; list persisted activities through the API.
- Team management approach: Reject requests without a name with `400`, create teams with the submitted name and mascot and valid members, and return persisted teams with their members.
- Leaderboard approach: Aggregate activity points by team, order totals from highest to lowest, and include each team's name, total points, and 1-based rank.
- Workout suggestions approach: Find the user by email, return a 4xx when no user matches, and recommend workouts aligned with the user's recent activity or fitness goal. Include a reason that explains the match.

## Test plan

Commands run and current results:

- Data tier: `npm run test:data --prefix octofit-tracker/backend` — **failed (4 failed, 1 passed)**. The model tests show required-field validation is missing for users, teams, activities, and workouts. The seed test passed, including idempotence and preserving unrelated records.
- API: `npm run test:api --prefix octofit-tracker/backend` — **failed (4 failed)**. Activity/team creation returns `501` instead of implementing validation and creation; the leaderboard is empty; workout suggestions omit the explanatory reason and do not yet meet the suggestion contract.
- Frontend: `npm test --prefix octofit-tracker/frontend` — **failed (15 failed)**. The pages do not yet render API-backed content, request user-specific workout suggestions, or expose the required accessible loading, empty, and error states.
- Backend build: `npm run build --prefix octofit-tracker/backend` — **passed**. A failure here indicates a TypeScript compile/type-check problem in the backend.
- Frontend build: `npm run build --prefix octofit-tracker/frontend` — **passed**. A failure here indicates a TypeScript or Vite production-build problem.

Contract-test failures indicate missing or incorrect behavior in that tier; rerun the corresponding command after implementing its contract, then rerun both builds to catch integration and type errors.
