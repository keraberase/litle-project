

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(express.urlencoded({ extended: true })); // needed to extract form data sent (posted) by the client
app.use(express.json());         // need this to parse JSON bodies sent by the client
app.use(express.static(__dirname));

// connect DB
const db = new sqlite3.Database('./games.db');

// create table
db.run(`
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    platform TEXT,
    status TEXT,
    rating INTEGER,
    added_at TEXT,
    completed_at TEXT
)
`);

// GET all games
app.get('/games', (req, res) => {
    db.all("SELECT * FROM games", [], (err, rows) => {
        res.json(rows);
    });
});
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// POST add game   
    app.post('/games', (req, res) => {
    const { title, platform, status, rating } = req.body;
    const added_at = new Date().toLocaleDateString('en-GB');

    db.run(
        "INSERT INTO games (title, platform, status, rating, added_at) VALUES (?, ?, ?, ?, ?)",
        [title, platform, status, rating, added_at],
        function(err) {
            res.json({ id: this.lastID });
        }
    );
});



// PUT update status
app.put('/games/:id', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const completed_at = status === 'completed' ? new Date().toLocaleDateString('en-GB') : null;

    db.run(
        "UPDATE games SET status = ?, completed_at = ? WHERE id = ?",
        [status, completed_at, id],
        () => res.send("Updated")
    );
});

// DELETE game
app.delete('/games/:id', (req, res) => {
    const id = req.params.id;

    db.run(
        "DELETE FROM games WHERE id = ?",
        [id],
        () => res.send("Deleted")
    );
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});