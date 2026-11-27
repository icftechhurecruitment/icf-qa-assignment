# Creator Shop: QA Automation Homework
Thanks for taking the time. **Please stop after about 2 hours.** If you run out of time, tell us what you would have done next in `NOTES.md`. An honest, partial submission is fine.

## Context
You are the QA engineer on a small subscription product. We want to see how you design tests, structure automation and handle dynamic UI. We are **not** looking for an expert.
We want solid fundamentals and code you can explain.

You may use AI tools. Please list how you used them in `AI_USAGE.md`. In the follow-up conversation we will ask you to explain your code, so make sure you understand everything you submit.

## Setup (Node 18+)
```bash
npm install
npx playwright install chromium
npm test
```
Playwright starts the app itself (`http://localhost:4173`). **Do not start the app manually.** Please don't edit anything inside `app/`.

The mock app is ~170 lines of plain Node.js (app/server.js) using only built-in modules (http, fs, path) with zero external backend dependencies or network calls.

## The app
A simplified creator-subscription page:
- An age-verification dialog and a promotional pop-up
- A grid of creators with plans per creator (Monthly / 3 Months / Annual)
- Account sign-up, a balance, "Add funds", success and error toasts, and a "My subscriptions" list

### Business rules
1. 3 Months = monthly price × 3, minus 10%. Annual = monthly price × 12, minus 20%. Prices are rounded to the nearest cent
2. A new account gets a starting balance
3. Add funds: minimum $10.00, maximum $500.00. The balance increases by exactly the amount added
4. Subscribing charges the plan price. If the balance is too low, nothing is charged and an error is shown
5. Only one active subscription per creator
6. An email address can be registered only once. A password needs at least 8 characters
7. You must be signed up to subscribe or add funds

## Tasks

**A1. Test design (`TEST_CASES.md`, ~25 min)**
Write 8–10 test cases for the subscribe flow. Cover the business rules, negative paths and pop-up behaviour. For each case, say whether you would automate it or keep it manual, and why.

**A2. Automation (`tests/`, ~70 min)**
Automate 3–4 of the cases from A1 with Playwright and TypeScript. At least one of them should verify the pricing rule (rule 1).

**A3. Notes (`NOTES.md`, ~15 min)**
Run instructions, your assumptions, the main decisions and trade-offs you made, and what you would do with more time. Also fill in `AI_USAGE.md`.

## Submission
1. On GitHub, click **Use this template → Create a new repository** and set it to **Private**
2. Push your work
3. In the repo, go to **Settings → Collaborators → Add people** and add **`icftechhurecruitment`**
4. Send the repository link to HR. Please do this within **7 days** of receiving the assignment