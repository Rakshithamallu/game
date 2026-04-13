const express = require('express');
const sql = require('mssql');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        enableArithAbort: true,
        trustServerCertificate: true
    }
};

async function connectDB() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server');
        
        // Initialize tables if they don't exist
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Leaderboard' AND xtype='U')
            CREATE TABLE Leaderboard (
                Id INT PRIMARY KEY IDENTITY(1,1),
                PlayerName NVARCHAR(100),
                Wins INT DEFAULT 0,
                LastWin DATETIME DEFAULT GETDATE()
            )
        `);
    } catch (err) {
        console.error('Database connection failed:', err);
    }
}

// API Endpoints
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await sql.query('SELECT TOP 10 * FROM Leaderboard ORDER BY Wins DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/win', async (req, res) => {
    const { player } = req.body;
    try {
        await sql.query`
            IF EXISTS (SELECT 1 FROM Leaderboard WHERE PlayerName = ${player})
                UPDATE Leaderboard SET Wins = Wins + 1, LastWin = GETDATE() WHERE PlayerName = ${player}
            ELSE
                INSERT INTO Leaderboard (PlayerName, Wins) VALUES (${player}, 1)
        `;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    connectDB();
});
