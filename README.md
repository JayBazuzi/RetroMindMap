# Retro Mind Map

[![Build and Test](https://github.com/JayBazuzi/RetroMindMap/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/JayBazuzi/RetroMindMap/actions/workflows/build-and-test.yml)

A keyboard-first mind map for team retros. Everyone with the link edits live.

**Use it:** https://jaybazuzi.github.io/RetroMindMap/

## Development

- `npm install`
- `run.cmd` to run locally
- `build-and-test.cmd` to build and run tests
- `tidy-code.cmd` to lint and format

## Live sharing (Firebase)

Without configuration the app runs in local mode: maps are saved in the browser and synced between tabs.

To share maps live:

1. Create a Firebase project and add a Realtime Database.
2. Copy `.env.example` to `.env.local` and fill in the values from the Firebase console.
3. Paste `database.rules.json` into the database's **Rules** tab. Anyone with a map's link can edit it.
4. For GitHub Pages, add the same three values as repository secrets, then re-run the **Deploy to GitHub Pages** workflow.

Each map lives at `maps/<room>` in the database. The room is the part of the URL after `#`.
