# Retro Mind Map

[![Build and Test](https://github.com/JayBazuzi/RetroMindMap/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/JayBazuzi/RetroMindMap/actions/workflows/build-and-test.yml)

A keyboard-first mind map for team retros. Everyone with the link edits live.

**Use it:** https://jay.bazuzi.com/RetroMindMap/

## Development

The scripts install dependencies as needed.

- `./run` to run locally
- `./build-and-test` to build and run tests
- `./tidy-code` to lint and format

## Live sharing (Firebase)

Without configuration the app runs in local mode: maps are saved in the browser and synced between tabs.

To share maps live:

1. Create a Firebase project and add a Realtime Database.
2. Copy `.env.example` to `.env.local` and fill in the values from the Firebase console.
3. Publish `database.rules.json` with `npx firebase-tools deploy --only database` (after `npx firebase-tools login`). Anyone with a map's link can edit it. To use your own project, change the project ID in `.firebaserc`.
4. For GitHub Pages, add the same three values as repository secrets, then re-run the **Deploy to GitHub Pages** workflow.

Each map lives at `maps/<room>` in the database. The room is the part of the URL after `#`.
