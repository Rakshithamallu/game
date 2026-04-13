class LudoGame {
    constructor(roomId, io) {
        this.roomId = roomId;
        this.io = io;
        this.playersOrder = ['red', 'green', 'yellow', 'blue'];
        this.players = {}; // { socketId: { name, color, tokens: [], ... } }
        this.turnIndex = 0;
        this.diceValue = 0;
        this.gameState = 'WAITING_FOR_PLAYERS'; 
        this.timer = null;
        this.turnTimeout = 30; // 30 seconds
        this.timeLeft = 30;
        this.lastUpdateTime = Date.now();
        
        this.safeCells = [1, 9, 14, 22, 27, 35, 40, 48];
    }

    addPlayer(socketId, name) {
        const currentCount = Object.keys(this.players).length;
        if (currentCount >= 4) return null;

        // Find next available color
        const usedColors = Object.values(this.players).map(p => p.color);
        const color = this.playersOrder.find(c => !usedColors.includes(c));

        const player = {
            id: socketId,
            name: name,
            color: color,
            tokens: [-1, -1, -1, -1],
            isReady: true,
            wins: 0
        };

        this.players[socketId] = player;
        
        if (Object.keys(this.players).length >= 2 && this.gameState === 'WAITING_FOR_PLAYERS') {
            this.startGame();
        }

        return player;
    }

    addBot() {
        const botId = 'bot-' + Math.random().toString(36).substr(2, 9);
        const botNames = ['LudoMaster', 'AlphaBot', 'NeoAI', 'PixelBot'];
        const name = botNames[Math.floor(Math.random() * botNames.length)];
        const player = this.addPlayer(botId, name);
        if (player) {
            player.isBot = true;
        }
        return player;
    }

    removePlayer(socketId) {
        if (this.players[socketId]) {
            const player = this.players[socketId];
            delete this.players[socketId];
            
            if (Object.keys(this.players).length < 2) {
                this.gameState = 'WAITING_FOR_PLAYERS';
                this.stopTimer();
            } else if (this.getActivePlayerId() === socketId) {
                this.nextTurn();
            }
            this.sync();
        }
    }

    startGame() {
        this.gameState = 'WAITING_FOR_ROLL';
        this.turnIndex = 0;
        this.startTimer();
        this.sync();
    }

    startTimer() {
        this.stopTimer();
        this.timeLeft = this.turnTimeout;
        this.timer = setInterval(() => {
            this.timeLeft--;
            if (this.timeLeft <= 0) {
                this.handleTimeout();
            }
            this.io.to(this.roomId).emit('timer_sync', { timeLeft: this.timeLeft });
        }, 1000);

        // BOT TURN CHECK
        const activeId = this.getActivePlayerId();
        if (activeId && this.players[activeId].isBot) {
            this.handleBotTurn(activeId);
        }
    }

    handleBotTurn(botId) {
        setTimeout(() => {
            if (this.gameState === 'WAITING_FOR_ROLL') {
                this.rollDice(botId);
            } else if (this.gameState === 'WAITING_FOR_MOVE') {
                const moves = this.getMovableTokens(botId);
                if (moves.length > 0) {
                    const randomMove = moves[Math.floor(Math.random() * moves.length)];
                    this.moveToken(botId, randomMove);
                }
            }
        }, 1500); // 1.5s delay for realistic feel
    }

    stopTimer() {
        if (this.timer) clearInterval(this.timer);
    }

    handleTimeout() {
        this.io.to(this.roomId).emit('game_status', { message: `Time out for ${this.playersOrder[this.turnIndex]}` });
        this.nextTurn();
    }

    getState() {
        return {
            players: this.players,
            turn: this.playersOrder[this.turnIndex],
            activePlayerId: this.getActivePlayerId(),
            diceValue: this.diceValue,
            gameState: this.gameState,
            roomId: this.roomId,
            timeLeft: this.timeLeft
        };
    }

    getActivePlayerId() {
        const activeColor = this.playersOrder[this.turnIndex];
        return Object.keys(this.players).find(id => this.players[id].color === activeColor);
    }

    canRoll(socketId) {
        return socketId === this.getActivePlayerId() && this.gameState === 'WAITING_FOR_ROLL';
    }

    rollDice(socketId) {
        this.diceValue = Math.floor(Math.random() * 6) + 1;
        this.gameState = 'WAITING_FOR_MOVE';
        
        this.io.to(this.roomId).emit('dice_rolled', { 
            value: this.diceValue, 
            player: this.players[socketId].color 
        });

        const movableTokens = this.getMovableTokens(socketId);
        if (movableTokens.length === 0) {
            setTimeout(() => {
                this.io.to(this.roomId).emit('game_status', { message: 'No valid moves!' });
                this.nextTurn();
            }, 1000);
        } else if (movableTokens.length === 1 && this.players[socketId].tokens[movableTokens[0]] !== -1) {
            // Auto-move single choice if not from home
            setTimeout(() => this.moveToken(socketId, movableTokens[0]), 600);
        } else if (this.players[socketId].isBot) {
            // Trigger move for bot
            this.handleBotTurn(socketId);
        }
        
        this.sync();
    }

    getMovableTokens(socketId) {
        const player = this.players[socketId];
        const movable = [];
        player.tokens.forEach((pos, idx) => {
            if (this.isValidMove(player, idx)) {
                movable.push(idx);
            }
        });
        return movable;
    }

    isValidMove(player, tokenIndex) {
        const pos = player.tokens[tokenIndex];
        if (pos === 58) return false;
        if (pos === -1 && this.diceValue !== 6) return false;
        if (pos !== -1 && pos + this.diceValue > 57) return false;
        return true;
    }

    canMove(socketId) {
        return socketId === this.getActivePlayerId() && this.gameState === 'WAITING_FOR_MOVE';
    }

    moveToken(socketId, tokenIndex) {
        const player = this.players[socketId];
        if (!this.isValidMove(player, tokenIndex)) return;

        let currentPos = player.tokens[tokenIndex];
        const targetPos = (currentPos === -1) ? 0 : currentPos + this.diceValue;

        // Update position
        player.tokens[tokenIndex] = targetPos;

        // Check if token finished
        if (player.tokens[tokenIndex] === 57) {
            player.tokens[tokenIndex] = 58;
            this.io.to(this.roomId).emit('token_finished', { player: player.color });
        }

        // Check capture
        const captured = this.checkCapture(socketId, tokenIndex);

        // Check win
        if (this.checkPlayerWin(socketId)) {
            this.gameState = 'FINISHED';
            this.stopTimer();
            this.io.to(this.roomId).emit('player_won', { 
                player: player.name, 
                color: player.color 
            });
            // Here you would call a saveToDatabase function
            this.sync();
            return;
        }

        // 6 gives extra turn, or capture gives extra turn
        if (this.diceValue === 6 || captured) {
            this.gameState = 'WAITING_FOR_ROLL';
            this.startTimer();
        } else {
            this.nextTurn();
        }

        this.sync();
    }

    checkCapture(socketId, tokenIndex) {
        const player = this.players[socketId];
        const pos = player.tokens[tokenIndex];
        let captured = false;
        
        if (pos < 0 || pos > 51) return false;
        
        const pathIndex = this.getGlobalPathIndex(player.color, pos);
        if (this.safeCells.includes(pathIndex)) return false;

        Object.keys(this.players).forEach(pId => {
            if (pId === socketId) return;
            const otherPlayer = this.players[pId];
            otherPlayer.tokens.forEach((oPos, oIdx) => {
                if (oPos >= 0 && oPos <= 51) {
                    const otherPathIdx = this.getGlobalPathIndex(otherPlayer.color, oPos);
                    if (otherPathIdx === pathIndex) {
                        otherPlayer.tokens[oIdx] = -1;
                        captured = true;
                        this.io.to(this.roomId).emit('capture', { 
                            capturer: player.color, 
                            captured: otherPlayer.color 
                        });
                    }
                }
            });
        });
        return captured;
    }

    getGlobalPathIndex(color, pos) {
        const offsets = { red: 0, green: 13, yellow: 26, blue: 39 };
        return (offsets[color] + pos) % 52;
    }

    checkPlayerWin(socketId) {
        return this.players[socketId].tokens.every(pos => pos === 58);
    }

    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % Object.keys(this.players).length;
        this.gameState = 'WAITING_FOR_ROLL';
        this.diceValue = 0;
        this.startTimer();
        this.sync();
    }

    sync() {
        this.io.to(this.roomId).emit('game_state', this.getState());
    }
}

module.exports = { LudoGame };
