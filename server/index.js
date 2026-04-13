const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const sql = require('mssql');
const { LudoGame } = require('./gameLogic');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// DB Config
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

// Rooms storage
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomId, playerName }) => {
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new LudoGame(roomId, io));
        }
        
        const game = rooms.get(roomId);
        const player = game.addPlayer(socket.id, playerName);
        
        if (player) {
            io.to(roomId).emit('game_state', game.getState());
            console.log(`${playerName} joined room ${roomId}`);
        } else {
            socket.emit('error', { message: 'Room full or game started' });
        }
    });

    socket.on('roll_dice', ({ roomId }) => {
        const game = rooms.get(roomId);
        if (game && game.canRoll(socket.id)) {
            game.rollDice(socket.id);
        }
    });

    socket.on('move_token', ({ roomId, tokenIndex }) => {
        const game = rooms.get(roomId);
        if (game && game.canMove(socket.id)) {
            game.moveToken(socket.id, tokenIndex);
        }
    });

    socket.on('add_bot', ({ roomId }) => {
        const game = rooms.get(roomId);
        if (game) {
            game.addBot();
            io.to(roomId).emit('game_state', game.getState());
        }
    });

    socket.on('send_chat', ({ roomId, message, playerName }) => {
        io.to(roomId).emit('receive_chat', { message, playerName, time: new Date() });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        rooms.forEach((game, roomId) => {
            if (game.players[socket.id]) {
                game.removePlayer(socket.id);
                if (Object.keys(game.players).length === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

// Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query('SELECT TOP 10 * FROM Leaderboard ORDER BY Wins DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
