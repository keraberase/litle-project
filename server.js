'use strict'
require('dotenv').config();
const axios = require('axios');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { setupSwagger } = require('./swagger');
const nodemailer = require('nodemailer');
const crypto = require('crypto');


const app = express();

setupSwagger(app);
// IGDB Token management
let igdbToken = null;
let tokenExpires = 0;

async function getIGDBToken() {
    const now = Date.now();

    if (igdbToken && now < tokenExpires) {
        return igdbToken;
    }

    try {
        const response = await axios.post(
            'https://id.twitch.tv/oauth2/token',
            null,
            {
                params: {
                    client_id: process.env.TWITCH_CLIENT_ID,
                    client_secret: process.env.TWITCH_CLIENT_SECRET,
                    grant_type: 'client_credentials'
                }
            }
        );

        igdbToken = response.data.access_token;
        tokenExpires = now + response.data.expires_in * 1000;
        console.log('IGDB Token obtained successfully');
        return igdbToken;
    } catch (error) {
        console.error('Failed to get IGDB token:', error.response?.data || error.message);
        throw error;
    }
}

const JWT_SECRET = process.env.JWT_SECRET;

// Multer configuration for cover uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only image files are allowed!'));
    }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect DB
const db = new sqlite3.Database('./games.db');

// Enable WAL mode for better concurrent access
db.run('PRAGMA journal_mode=WAL');

// Create tables
db.serialize(() => {
    // Users table
 db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        reset_token TEXT,
        reset_expires INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    )
`);
    // Games table with user_id and new fields
    db.run(`
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            platform TEXT,
            status TEXT DEFAULT 'planned',
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            hours REAL DEFAULT 0,
            tags TEXT,
            cover_url TEXT,
            added_at TEXT,
            completed_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    
    db.run('CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_games_title ON games(title)');
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access denied' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Auth routes
app.post('/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
        }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Username or email already exists' });
                    }
                    return res.status(500).json({ error: 'Registration failed' });
                }
                
                const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '24h' });
                res.json({ token, user: { id: this.lastID, username } });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            try {
                const match = await bcrypt.compare(password, user.password);
                if (!match) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
                
                const token = jwt.sign(
                    { id: user.id, username: user.username },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                res.json({ token, user: { id: user.id, username: user.username } });
            } catch (error) {
                res.status(500).json({ error: 'Server error' });
            }
        }
    );
});
app.post('/auth/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!user) {
            return res.json({ message: 'If email exists, reset link sent' });
        }

        try {
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = Date.now() + 1000 * 60 * 15;

            db.run(
                `UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`,
                [resetToken, resetExpires, user.id]
            );

            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT),
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                }
            });

            const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;

            await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: '🎮 Game Backlog — Password Reset',
    html: `
        <div style="background:#0a0a0f; padding:40px; font-family:'Courier New',monospace; color:#eee; max-width:480px; margin:0 auto; border-radius:8px;">
            
            <h1 style="color:#ff00ff; letter-spacing:4px; margin-bottom:4px;">GAME BACKLOG</h1>
            <p style="color:#555; font-size:12px; margin-top:0;">// PASSWORD RESET REQUEST</p>
            
            <hr style="border:none; border-top:1px solid #222; margin:24px 0;">
            
            <p style="color:#aaa;">We received a request to reset your password.</p>
            <p style="color:#aaa;">Click the button below to set a new password:</p>
            
            <div style="text-align:center; margin:32px 0;">
                <a href="${resetLink}" 
                   style="background:#ff00ff; color:#000; padding:14px 32px; text-decoration:none; 
                          font-weight:bold; letter-spacing:2px; border-radius:4px; display:inline-block;">
                    ▶ RESET PASSWORD
                </a>
            </div>
            
            <p style="color:#555; font-size:11px;">⏱ This link expires in <strong style="color:#ffaa00;">15 minutes</strong>.</p>
            <p style="color:#555; font-size:11px;">If you didn't request this, simply ignore this email.</p>
            
            <hr style="border:none; border-top:1px solid #222; margin:24px 0;">
            <p style="color:#333; font-size:10px; text-align:center;">Game Backlog — Track your gaming journey</p>
        </div>
    `
});

            res.json({ message: 'Reset email sent' });

        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Email sending failed' });
        }
    });
});


// RESET PASSWORD CONFIRM
app.post('/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Missing data' });
    }

    db.get(
        `SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?`,
        [token, Date.now()],
        async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

            const hashed = await bcrypt.hash(newPassword, 10);

            db.run(
                `UPDATE users 
                 SET password = ?, reset_token = NULL, reset_expires = NULL 
                 WHERE id = ?`,
                [hashed, user.id]
            );

            res.json({ message: 'Password updated successfully' });
        }
    );
});
// Games routes with filtering, sorting, search, and pagination
app.get('/games', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { 
        status, 
        sort_by = 'added_at', 
        sort_order = 'desc',
        search = '',
        tags = '',
        page = 1, 
        limit = 10 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const validSortColumns = ['title', 'platform', 'rating', 'hours', 'added_at', 'completed_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'added_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    let query = 'SELECT * FROM games WHERE user_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM games WHERE user_id = ?';
    const params = [userId];
    const countParams = [userId];
    
    // Filter by status
    if (status && ['planned', 'completed', 'playing', 'dropped'].includes(status)) {
        query += ' AND status = ?';
        countQuery += ' AND status = ?';
        params.push(status);
        countParams.push(status);
    }
    
    // Search by title
    if (search) {
        query += ' AND title LIKE ?';
        countQuery += ' AND title LIKE ?';
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
    }
    
    // Filter by tags
    if (tags) {
        const tagList = tags.split(',').map(t => t.trim());
        tagList.forEach(tag => {
            query += ' AND tags LIKE ?';
            countQuery += ' AND tags LIKE ?';
            params.push(`%${tag}%`);
            countParams.push(`%${tag}%`);
        });
    }
    
    // Add sorting
    query += ` ORDER BY ${sortColumn} ${sortDirection}`;
    
    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    // Get total count for pagination
    db.get(countQuery, countParams, (err, countResult) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        db.all(query, params, (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Get statistics
            db.get(
                'SELECT COUNT(*) as total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as planned, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed, SUM(hours) as total_hours FROM games WHERE user_id = ?',
                ['planned', 'completed', userId],
                (err, stats) => {
                    res.json({
                        games: rows,
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            total: countResult.total,
                            pages: Math.ceil(countResult.total / limit)
                        },
                        stats: stats || { total: 0, planned: 0, completed: 0, total_hours: 0 }
                    });
                }
            );
        });
    });
});

// Get single game
app.get('/games/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.get(
        'SELECT * FROM games WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Game not found' });
            res.json(row);
        }
    );
});

// Add game with optional cover upload
app.post('/games', authenticateToken, upload.single('cover'), (req, res) => {
    const { title, platform, status = 'planned', rating, hours = 0, tags, cover_url } = req.body;
    const userId = req.user.id;
    const added_at = new Date().toLocaleDateString('en-GB');
    
    // Use uploaded file or provided cover_url from IGDB
    let finalCoverUrl = req.file ? `/uploads/${req.file.filename}` : (cover_url || null);
    
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }
    
    db.run(
        `INSERT INTO games (user_id, title, platform, status, rating, hours, tags, cover_url, added_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, platform, status, rating || null, hours, tags || null, finalCoverUrl, added_at],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            db.get('SELECT * FROM games WHERE id = ?', [this.lastID], (err, game) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json(game);
            });
        }
    );
});

// Update game
app.put('/games/:id', authenticateToken, upload.single('cover'), (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, platform, status, rating, hours, tags, cover_url } = req.body;
    const updated_at = new Date().toLocaleDateString('en-GB');
    
    // First, get the current game to check ownership
    db.get('SELECT * FROM games WHERE id = ? AND user_id = ?', [id, userId], (err, game) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!game) return res.status(404).json({ error: 'Game not found or unauthorized' });
        
        const completed_at = status === 'completed' && game.status !== 'completed' 
            ? new Date().toLocaleDateString('en-GB') 
            : game.completed_at;
        
        // Use uploaded file, provided cover_url, or keep existing
        let finalCoverUrl = game.cover_url;
        if (req.file) {
            finalCoverUrl = `/uploads/${req.file.filename}`;
            // Delete old cover file if exists
            if (game.cover_url && !game.cover_url.startsWith('http')) {
                const oldCover = path.join(__dirname, game.cover_url);
                if (fs.existsSync(oldCover)) fs.unlinkSync(oldCover);
            }
        } else if (cover_url !== undefined) {
            finalCoverUrl = cover_url || null;
        }
        
        db.run(
            `UPDATE games 
             SET title = ?, platform = ?, status = ?, rating = ?, hours = ?, 
                 tags = ?, cover_url = ?, completed_at = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`,
            [
                title || game.title,
                platform || game.platform,
                status || game.status,
                rating || game.rating,
                hours || game.hours,
                tags || game.tags,
                finalCoverUrl,
                completed_at,
                updated_at,
                id,
                userId
            ],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Game not found' });
                
                db.get('SELECT * FROM games WHERE id = ?', [id], (err, updatedGame) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(updatedGame);
                });
            }
        );
    });
});
app.get('/games/stats/detailed', authenticateToken, (req, res) => {
    const userId = req.user.id;
 
    const queries = {
        // Distribution by status
        byStatus: `
            SELECT status, COUNT(*) as count
            FROM games WHERE user_id = ?
            GROUP BY status
        `,
        // Top 8 games by hours
        topByHours: `
            SELECT title, hours, status
            FROM games WHERE user_id = ? AND hours > 0
            ORDER BY hours DESC LIMIT 8
        `,
        // Games by month of addition (last 12 months)
        byMonth: `
            SELECT 
                substr(added_at, 4, 2) || '/' || substr(added_at, 7, 4) as month,
                COUNT(*) as count
            FROM games 
            WHERE user_id = ? AND added_at IS NOT NULL
            GROUP BY month
            ORDER BY substr(added_at, 7, 4), substr(added_at, 4, 2)
            LIMIT 12
        `,
        // Distribution by rating
        byRating: `
            SELECT rating, COUNT(*) as count
            FROM games WHERE user_id = ? AND rating IS NOT NULL
            GROUP BY rating ORDER BY rating
        `,
        // General summary
        summary: `
            SELECT 
                COUNT(*) as total,
                ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END), 1) as avg_rating,
                ROUND(SUM(hours), 1) as total_hours,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'planned'   THEN 1 END) as planned,
                COUNT(CASE WHEN status = 'playing'   THEN 1 END) as playing,
                COUNT(CASE WHEN status = 'dropped'   THEN 1 END) as dropped
            FROM games WHERE user_id = ?
        `,
    };
 
    const run = (sql, params) =>
        new Promise((resolve, reject) =>
            db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
        );
 
    Promise.all([
        run(queries.byStatus,   [userId]),
        run(queries.topByHours, [userId]),
        run(queries.byMonth,    [userId]),
        run(queries.byRating,   [userId]),
        run(queries.summary,    [userId]),
    ])
        .then(([byStatus, topByHours, byMonth, byRating, summary]) => {
            res.json({ byStatus, topByHours, byMonth, byRating, summary: summary[0] });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});
// Delete game
app.delete('/games/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Get game to delete cover file if local
    db.get('SELECT cover_url FROM games WHERE id = ? AND user_id = ?', [id, userId], (err, game) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!game) return res.status(404).json({ error: 'Game not found' });
        
        db.run('DELETE FROM games WHERE id = ? AND user_id = ?', [id, userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Delete local cover file only 
            if (game.cover_url && !game.cover_url.startsWith('http')) {
                const coverPath = path.join(__dirname, game.cover_url);
                if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
            }
            
            res.json({ message: 'Game deleted successfully' });
        });
    });
});

// IGDB API search endpoint
app.get('/api/search-games', async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Query required' });
    }

    try {
        const token = await getIGDBToken();

        const response = await axios.post(
           'https://api.igdb.com/v4/games',
            `fields name, rating, first_release_date, cover.image_id, platforms.name, summary;
            where name ~ *"${query}"*;
            limit 10;
            sort rating desc;`,
            {
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        const games = response.data.map(g => ({
            id: g.id,
            name: g.name,
            rating: g.rating,
            summary: g.summary,
            platforms: g.platforms,
            cover: g.cover
                ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
                : null
        }));

        res.json(games);

    } catch (err) {
        console.error('IGDB ERROR FULL:', err.response?.data || err.message);
        res.status(500).json({
            error: 'Search failed',
            details: err.response?.data || err.message
        });
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` http://localhost:${PORT}`);
});