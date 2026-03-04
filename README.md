# 🏔️ Poker Everest

A modern Planning Poker application built with Next.js, Redis, and Tailwind CSS.
Designed for agile teams to estimate tasks with style.

![Poker Everest](/public/opengraph-image.png)

## ✨ Features

*   **Live Room Sync**: Fast room updates via server actions and short polling, compatible with Vercel.
*   **Interactive Reactions**:
    *   Throw emojis (🎯 🍻 💩 ❤️) at other players with fun physics! 🚀
    *   Shake your beer glass by clicking on it 🍺.
    *   Fly-in animations with gravity and bouncing effects.
*   **Voting Tools**:
    *   **Voting Timer** ⏱️: Keep your standups efficient.
    *   **Consensus Mode**: Confetti explosions when everyone agrees 🎉.
    *   **Results**: Auto-calculated averages saved per task.
*   **Room Management**:
    *   **Smart Link Sharing**: One-click copy with visual feedback.
    *   **Task Sidebar**: Create, track, and manage voting tasks easily.
    *   **Persistent Host**: Admin rights are saved even on refresh.
*   **Immersive UI**:
    *   3D-style poker table.
    *   Glassmorphism design with responsive visuals.

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Framer Motion.
*   **Backend**: Next.js Route Handlers running on the Node.js runtime.
*   **State Management**: Redis for shared room state on Vercel. Local development can fall back to in-memory storage.
*   **Icons**: Lucide React.
*   **Styling**: Glassmorphism, mobile-responsive design.

## 🚀 Getting Started

### Prerequisites

*   Node.js 22.x
*   npm or yarn
*   Redis for production/Vercel deployments

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/poker-everest.git
    cd poker-everest
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open in browser:**
    Navigate to `http://localhost:3000`.

## 📦 Deployment

This project is now aligned with the standard Next.js deployment model and can be deployed directly to Vercel.

**Vercel requirements**
*   Set `REDIS_URL` in the project environment variables. On Vercel this is required because in-memory room state is not reliable across serverless invocations.
*   Optional: set `SENTRY_DSN` for runtime error tracking.
*   Optional: set `SENTRY_TRACES_SAMPLE_RATE` (for example `0.1`) if you want tracing enabled.
*   Build command: `npm run build`
*   Install command: `npm install`
*   Node.js version: `22.x`

**Runtime model**
*   Room actions run through Next.js Route Handlers.
*   Clients poll for room updates, which avoids long-lived WebSocket servers and fits Vercel serverless execution.

**Minimal Vercel checklist**
1.  Import the GitHub repository into Vercel.
2.  If you want production deploys from the current branch, set the Production Branch to `dev` in the Vercel project settings. Otherwise merge `dev` into your production branch first.
3.  Add `REDIS_URL` to `Production`. Add it to `Preview` too if you want room logic to work on preview deployments.
4.  Add `SENTRY_DSN` and `SENTRY_TRACES_SAMPLE_RATE` only if you use Sentry.
5.  Trigger a deploy and verify:
    *   `/healthz` returns `200`
    *   `/readyz` returns `200`
    *   room creation/join/reaction flow works across two browser tabs

## 📈 Observability

The app exposes operational endpoints:

*   `GET /healthz` — liveness.
*   `GET /readyz` — readiness + storage mode state.
*   Sentry (optional): set `SENTRY_DSN` (+ optional `SENTRY_TRACES_SAMPLE_RATE`) for runtime error tracking.

For SLO targets, alerts and runbook, see `OPERATIONS.md`.
Alert templates and dashboard starter files are in:
*   `observability/alerts/prometheus-rules.yml`
*   `observability/dashboards/poker-everest-overview.json`

## 🤝 Contributing

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
