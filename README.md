🎮 Game Backlog
Author: Reuta Sergey
Date: May 2026
A full-stack web application for tracking your personal video game library — log games, track hours, rate titles, and analyse your gaming habits.

Purpose
Gamers often lose track of what they own, what they've played, and what's still waiting. Game Backlog solves this with a centralised, user-authenticated dashboard where you can add games via IGDB search (with automatic cover art), assign a play status, log hours, and view stats and charts of your collection.
Target Audience
Video game enthusiasts who own games across multiple platforms and want a structured way to manage their backlog — whether they're completionists tracking 100% runs, players with large unplayed libraries, or anyone who likes logging ratings and time spent.
Design Approach
The UI follows a retro-cyberpunk aesthetic — dark backgrounds, cyan/magenta accents, a scanline overlay, and pixel fonts (Press Start 2P + Orbitron) — chosen to resonate with the gaming audience it serves. A full light mode is available via toggle. Layout uses CSS Grid for a responsive card-based library that adapts from 3 columns on desktop to a single column on mobile.

Technologies
Backend

Node.js + Express — server and REST API
SQLite3 — embedded database (WAL mode)
bcrypt — password hashing
jsonwebtoken — JWT authentication
Multer — cover image uploads
Nodemailer — password reset emails
Axios — IGDB / Twitch OAuth requests
swagger-jsdoc + swagger-ui-express — API docs at /api-docs

Frontend

HTML5 / CSS3 / Vanilla JavaScript
Chart.js 4.4 — stats charts (doughnut, bar)
Google Fonts CDN — Press Start 2P, Orbitron

External Services

IGDB API v4 — game search, cover art, platform data
Twitch OAuth2 — IGDB bearer token
SMTP (configurable) — password reset email delivery


Potential Improvements

Refresh tokens — replace 24h JWT with short-lived access + refresh token pair
PostgreSQL — migrate from SQLite for multi-user scalability
Rate limiting — add express-rate-limit on auth routes
Drag-and-drop queue — let users manually order their Planned list
Wishlist status — a fifth status for games not yet owned
Platform breakdown chart — visualise library split by platform
PWA support — manifest + service worker for mobile install and offline access
Yearly wrap-up — annual stats summary (Spotify Wrapped–style)
Automated tests — Jest unit tests for auth and CRUD routes