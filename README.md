# 🏔️ Poker Everest

A modern, real-time Planning Poker application built with Next.js, Socket.IO, and Tailwind CSS.
Designed for agile teams to estimate tasks with style.

![Poker Everest](/public/opengraph-image.png)

## ✨ Features

*   **Real-time Interaction**: Instant voting and revealing using WebSockets.
*   **Persistent Host**: Host status is saved even if you refresh the page.
*   **Voting Results**: Average scores are automatically calculated and saved to the sidebar next to each task.
*   **Immersive UI**:
    *   3D-style poker table.
    *   Interactive avatars with beer glass animations 🍺.
    *   Confetti explosions on consensus 🎉.
*   **Task Management**:
    *   Add/Delete tasks dynamically.
    *   Sidebar overview of all tasks and their scores.
    *   "Starting" status for empty rooms.
*   **Bot-Free**: Host privileges don't jump to inactive users/bots on disconnect.

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
