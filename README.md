# Kizuna Rail (絆鉄道)

A brownfield web development training project designed to build real-world software engineering expertise through reverse engineering, refactoring, and debugging existing codebases.

## What is this?

Kizuna Rail is a fictional scenic railway booking website for tourists in Japan. While the company isn't real, the development challenges are. This project simulates a real brownfield codebase—existing code written by someone else that needs improvement, bug fixes, and new features.

## Purpose

This repository exists to develop essential software engineering skills that separate competent developers from true experts:

- **Reverse engineering** unfamiliar codebases to understand architecture and data flow
- **Refactoring** poorly structured code while maintaining functionality
- **Debugging** complex issues across multiple layers of the application
- **Code archaeology** through reading, tracing, and comprehending someone else's implementation decisions
- **Technical decision-making** about when to refactor vs. rewrite vs. extend existing patterns
- **Self-directed problem solving** without step-by-step tutorials

These skills define professional software engineering. Most developers spend 80% of their time working with existing code, not building greenfield projects.

## Who is this for?

- **Students**: This project was created for university-level software development courses, but anyone learning web development is welcome to use it
- **Self-learners**: Found this repo on your own? Great! Work through the refactors at your own pace
- **Educators**: Feel free to incorporate these exercises into your curriculum

## Why Brownfield Development?

Real-world software development means inheriting legacy systems with technical debt, inconsistent patterns, undocumented decisions, and code written by developers with varying skill levels. Learning to effectively reverse engineer these systems, refactor problematic areas, and extend functionality without introducing regressions is what distinguishes senior developers from junior ones.

Greenfield tutorials teach you syntax. Brownfield projects teach you engineering.

## Important Notes

**This codebase contains intentional technical debt.** You'll find suboptimal architecture, missing error handling, inconsistent patterns, and code that needs refactoring—all by design. These are learning opportunities, not mistakes.

**Do not submit PRs to fix code issues.** The technical debt, bugs, and architectural issues are intentional teaching moments for developers working through the exercises.

**However**, if you find:
- Actual errors that break the learning experience
- Typos in documentation
- Ideas for new challenges

Please open an issue or submit a PR! Contributions to improve the educational value are welcome.

## Getting Started

### For Students and Self-Learners

This repository is set up as a **GitHub template**. Use the template feature to create your own independent copy where you can complete the challenges.

1. Click the **Use this template** button at the top of this repository
2. Select **Create a new repository**
3. Give your repository a name (`kizuna-rail`) and create it under your GitHub account
4. Clone your new repository to your local machine:
   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   cd YOUR-REPO-NAME
   ```
5. Install dependencies: `npm install`
6. Copy `.env.example` to `.env` and set `MONGODB_URI` (and optionally `MONGODB_DB_NAME`) for your MongoDB instance.
7. Import the starter data with `npm run db:import`. This replaces the starter collections and clears any confirmations in that database.
8. Run the automated tests with `npm test`. Tests use a temporary local database and do not change the database in your `.env` file.
9. Start the development server: `npm run dev`

The first test run may take longer because MongoDB Memory Server needs to download a MongoDB program. Later test runs reuse that download. Use `npm run test:watch` if you want Vitest to rerun related tests while you work.

### Automated Test Setup

The application and automated tests share the database initialization function in `src/db/initialize.js`. The normal `db:import` command runs it against the database configured in `.env`. Automated tests run it against a temporary MongoDB database instead.

Vitest starts the temporary database once for the complete test run. Before each individual test, the setup clears that temporary database and restores the starter data. This means each test begins with the same data, and test changes cannot reach the database configured in `.env`.

See `tests/trains.test.js` for example endpoint tests that use Supertest to send requests to the real `/api/trains` route.

This project simulates realistic work situations requiring reverse engineering, refactoring, debugging, or feature extension.

### For Contributors

If you want to contribute improvements to the documentation or educational content itself:

1. **Fork** this repository (not "Use this template")
2. Create a feature branch for your changes
3. Submit a pull request with your improvements

Forking maintains the connection to the original repository and allows you to contribute back. Using the template creates an independent copy for your own work.

## Technology Stack

- **Backend**: Node.js with Express framework
- **Templating**: EJS
- **Styling**: Modern nested CSS with custom properties
- **Database**: MongoDB, using the official MongoDB Node.js driver
- **Testing**: Vitest, Supertest, and MongoDB Memory Server

## Skills You'll Develop

- Code comprehension and reverse engineering
- Refactoring techniques and code smell identification
- Debugging across the full stack
- Working with unfamiliar frameworks and patterns
- Making architectural decisions in existing systems
- Reading and understanding someone else's code
- Git workflow in team environments

## License

This is an educational project—feel free to use it for learning and teaching. The project is released under the MIT License; see `LICENSE.txt` for the full text.
