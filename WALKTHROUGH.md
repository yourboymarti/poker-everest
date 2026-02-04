# Poker Everest MVP - Walkthrough

**Status:** ✅ MVP Complete
**Version:** v0.1.0 (Draft)

## 🏗 Infrastructure
- **Persistence:** Redis integration active. Rooms and game state survive server restarts.
- **Fail-safe:** In-Memory fallback with automatic cleanup (delete rooms older than 24h) if Redis is unavailable.
- **CI/CD:** Automatic Release Notes generation via `release-drafter` on merge to `main`.

## 🃏 Key Features
- **Room Management:** Create/Join rooms, custom game names.
- **Voting Logic:**
    - Real-time voting with socket.io.
    - Reveal/Reset rounds.
    - "Pick your card" prompt.
    - Timer in header.
- **Task System:**
    - Add/Delete tasks.
    - Undo delete (5s timer).
    - Detailed results (Average score + individual votes).
- **User Experience:**
    - Sidebar with task list (cancel/save form).
    - Emoji reactions (🎯 🚀 💩 ❤️).
    - "Game's URL" copy button.
    - Host recovery logic.

## 🚀 Deployment Workflow
1. Develop in `dev` branch.
2. Push to `dev`.
3. Create Pull Request `dev` -> `main` with labels (`feat`, `fix`, `chore`).
4. Merge to `main`.
5. Railway auto-deploys.
6. GitHub drafts release notes.

## 📸 Screenshots
*(No screenshots added yet, but UI is functional)*
