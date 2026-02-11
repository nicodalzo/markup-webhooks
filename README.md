# Markup Comments

A minimal web annotation tool inspired by [Markup.io](https://www.markup.io/) — comment on any webpage, manage tasks, and integrate with ClickUp via webhooks.

![Markup Comments](https://img.shields.io/badge/version-1.0.0-6C5CE7) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🌐 **Load any webpage** — Paste a URL and view it directly in the app
- 💬 **Comment mode** — Click anywhere on the page to place visual comment pins
- 📋 **Auto-generated tasks** — Every comment becomes a trackable task
- 👥 **Team management** — Add team members and assign comments/tasks
- 🔗 **ClickUp webhooks** — Send comment data to ClickUp automatically
- 💾 **Persistent storage** — All data saved in localStorage
- ✨ **Minimal design** — Clean, professional UI inspired by Markup.io

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## How to Use

1. **Paste a URL** in the top bar and click "Carica"
2. Switch to **Comment** mode using the toggle
3. **Click anywhere** on the loaded page to add a comment
4. Fill in comment details, assign to a team member, set priority
5. Optionally enable **webhook** to send data to ClickUp
6. View all comments and tasks in the **left sidebar**

## Webhook Integration (ClickUp)

When creating a comment, toggle "Webhook ClickUp" and paste your webhook URL. Every new comment will send a POST request with this payload:

```json
{
  "event": "new_comment",
  "timestamp": "2026-02-11T12:00:00.000Z",
  "data": {
    "comment_id": "abc123",
    "comment_text": "Fix this button alignment",
    "page_url": "https://example.com",
    "position": { "x_percent": 45.2, "y_percent": 30.8 },
    "assignee": "John Doe",
    "priority": "high",
    "comment_number": 1
  }
}
```

## Tech Stack

- **Frontend**: Vanilla JS + Vite
- **Backend**: Express.js (proxy server + webhook forwarder)
- **Styling**: CSS custom properties, Inter font
- **Storage**: localStorage

## Production Build

```bash
npm run build
npm start
```

## License

MIT
