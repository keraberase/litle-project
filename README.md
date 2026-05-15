# 🎮 Game Backlog
 
**Author:** Reuta Serhii  
**Date:** May 2026
 
---
 
## Purpose
 
A personal web app to track your video game collection. Add games via IGDB search (auto cover art), set a play status, log hours played, give a star rating, and view stats and charts of your library.
 
---
 
## Target Audience
 
Gamers who own games across multiple platforms and want one place to manage their backlog — whether tracking completions, logging playtime, or just keeping a list of what to play next.
 
---
 
## Design
 
Retro-cyberpunk style — dark background, cyan/magenta accents, scanline overlay, pixel fonts (Press Start 2P + Orbitron). Includes a light mode toggle. Responsive CSS Grid layout that works on desktop and mobile.
 
---
 
## Technologies
 
| Layer | Tech |
|---|---|
| Server | Node.js, Express |
| Database | SQLite3 |
| Auth | JWT, bcrypt |
| Email | Nodemailer (Brevo SMTP) |
| File uploads | Multer |
| Game data | IGDB API v4 + Twitch OAuth2 |
| HTTP client | Axios |
| API docs | Swagger (swagger-jsdoc + swagger-ui-express) |
| Fonts | Google Fonts (CDN) |
 
---
 
## Features
 
- Register / Login / Logout with JWT authentication
- Password reset via email (token expires in 15 min)
- Search games on IGDB with auto-fill cover art and platforms
- Add, edit, delete games
- Statuses: Planned, Playing, Completed, Dropped
- Log hours played and 1–5 star rating
- Filter by status, search by title, sort by date/rating/hours
- Pagination (9 games per page)
- Stats modal — status chart, rating chart, top games by hours
- Dark / Light theme toggle
- API documentation at `/api-docs`
---
 
## Potential Improvements
 
- Refresh tokens instead of 24h JWT
- CSV and PDF export
- Migrate to PostgreSQL for scalability
- Rate limiting on auth routes
- Drag-and-drop ordering for the Planned queue
- Wishlist status for games not yet owned
- Platform breakdown chart
- PWA support (offline + mobile install)
- Yearly wrap-up stats page
- Unit tests with Jest
---
 
## Setup
 
```bash
npm install
```
 
Create a `.env` file:
 
```
PORT=3000
JWT_SECRET=your_secret
TWITCH_CLIENT_ID=your_id
TWITCH_CLIENT_SECRET=your_secret
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=your_email@gmail.com
```
 
```bash
node index.js
```
 
Open `http://localhost:3000`