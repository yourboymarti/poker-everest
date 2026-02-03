# 🏔️ Poker Everest

A modern, real-time Planning Poker application built with Next.js, Socket.IO, and Tailwind CSS.
Designed for agile teams to estimate tasks with style.

![Poker Everest](/public/opengraph-image.png)

## ✨ Features

*   **Real-time Interaction**: Instant voting and revealing using WebSockets.
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
*   **Backend**: Custom Node.js server (server.ts) with Socket.IO.
*   **State Management**: Redis (optional, with in-memory fallback).
*   **Icons**: Lucide React.
*   **Styling**: Glassmorphism, mobile-responsive design.

## 🚀 Getting Started

### Prerequisites

*   Node.js 18+
*   npm or yarn

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

Since this application uses a custom Node.js server for WebSockets, it **cannot** be hosted on static platforms like Vercel (standard) or GitHub Pages.

**Recommended Hosting:**
*   **Railway** (Zero config, detects server.ts)
*   **Render** (Web Service)
*   **VPS** (DigitalOcean, Hetzner) with Docker/PM2.

## 🤝 Contributing

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
