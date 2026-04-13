/**
 * Ludo Neo - Core Game Logic
 */

const CONFIG = {
    CELL_SIZE: 40,
    PLAYERS: ['red', 'green', 'yellow', 'blue'],
    PLAYER_COLORS: {
        red: '#ff4757',
        green: '#2ed573',
        yellow: '#ffa502',
        blue: '#1e90ff'
    },
    START_CELLS: {
        red: 19,
        green: 6,
        yellow: 45,
        blue: 32
    },
    SAFE_CELLS: [19, 6, 45, 32, 1, 14, 27, 40] // Simplified indices for 52-cell track
};

class Game {
    constructor() {
        this.turn = 0; // index of CONFIG.PLAYERS
        this.diceRoll = 0;
        this.isRolling = false;
        this.gameState = 'WAITING_FOR_ROLL'; // WAITING_FOR_ROLL, WAITING_FOR_MOVE, ANIMATING
        
        this.players = {
            red: { tokens: [ -1, -1, -1, -1 ], path: this.generatePath('red'), home: 0 },
            green: { tokens: [ -1, -1, -1, -1 ], path: this.generatePath('green'), home: 0 },
            yellow: { tokens: [ -1, -1, -1, -1 ], path: this.generatePath('yellow'), home: 0 },
            blue: { tokens: [ -1, -1, -1, -1 ], path: this.generatePath('blue'), home: 0 }
        };

        this.init();
    }

    init() {
        this.renderBoard();
        this.renderTokens();
        this.setupEventListeners();
        this.updateUI();
        this.fetchLeaderboard();
    }

    async fetchLeaderboard() {
        try {
            const res = await fetch('http://localhost:5000/api/leaderboard');
            const data = await res.json();
            const list = document.getElementById('leaderboard-list');
            list.innerHTML = '';
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'leader-item';
                div.innerHTML = `<span>${item.PlayerName}</span><span class="score">${item.Wins} Wins</span>`;
                list.appendChild(div);
            });
        } catch (e) {
            console.log('Server not reachable');
        }
    }

    // Generate path logic for each player
    // Track 0-51 are common path cells. 52-57 are home stretch. 58 is home.
    generatePath(color) {
        let baseStart = 0;
        if (color === 'red') baseStart = 0;
        if (color === 'green') baseStart = 13;
        if (color === 'yellow') baseStart = 26;
        if (color === 'blue') baseStart = 39;

        let path = [];
        // Common track (51 steps before home stretch)
        for (let i = 0; i < 51; i++) {
            path.push((baseStart + i) % 52);
        }
        // Home stretch
        for (let i = 1; i <= 6; i++) {
            path.push(`${color}-home-${i}`);
        }
        return path;
    }

    renderBoard() {
        const container = document.getElementById('cells-container');
        // Map 52 common path cells to grid coordinates
        this.commonTrackCoords = [
            // Row 6 (left to right)
            [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
            // Top col 8 (top to bottom)
            [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
            [0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
            // Right row 6 (left to right)
            [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
            [7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
            // Bottom col 6 (bottom to top)
            [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
            [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
            // Left row 8 (right to left)
            [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
        ];

        // This coordinate mapping is tricky. Let's redefine common track index to grid position
        // I will use a more direct approach: loop through grid and identify path cells
        const board = document.getElementById('ludo-board');
        
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if ((r >= 6 && r <= 8) || (c >= 6 && c <= 8)) {
                    // Check if it's not the center square or houses
                    if ( (r < 6 || r > 8) || (c < 6 || c > 8) || (r === 7 || c === 7)) {
                        if (!(r >= 0 && r < 6 && c >= 0 && c < 6) &&
                            !(r >= 0 && r < 6 && c >= 9 && c < 15) &&
                            !(r >= 9 && r < 15 && c >= 0 && c < 6) &&
                            !(r >= 9 && r < 15 && c >= 9 && c < 15)) {
                            
                            const cell = document.createElement('div');
                            cell.className = 'cell';
                            cell.style.gridRow = r + 1;
                            cell.style.gridColumn = c + 1;
                            cell.dataset.row = r;
                            cell.dataset.col = c;
                            
                            // Color home stretches
                            if (r === 7 && c > 0 && c < 7) cell.classList.add('path-red');
                            if (c === 7 && r > 0 && r < 7) cell.classList.add('path-green');
                            if (r === 7 && c > 7 && c < 14) cell.classList.add('path-yellow');
                            if (c === 7 && r > 7 && r < 14) cell.classList.add('path-blue');
                            
                            // Starting points
                            if (r === 6 && c === 1) cell.classList.add('start-red');
                            if (r === 1 && c === 8) cell.classList.add('start-green');
                            if (r === 8 && c === 13) cell.classList.add('start-yellow');
                            if (r === 13 && c === 6) cell.classList.add('start-blue');

                            board.appendChild(cell);
                        }
                    }
                }
            }
        }
    }

    renderTokens() {
        const board = document.getElementById('ludo-board');
        CONFIG.PLAYERS.forEach(color => {
            for (let i = 0; i < 4; i++) {
                const token = document.createElement('div');
                token.className = `token ${color}`;
                token.id = `token-${color}-${i}`;
                token.dataset.player = color;
                token.dataset.index = i;
                board.appendChild(token);
                this.positionToken(color, i);
            }
        });
    }

    positionToken(color, index) {
        const token = document.getElementById(`token-${color}-${index}`);
        const pos = this.players[color].tokens[index];
        let targetEl;

        if (pos === -1) {
            // In House
            targetEl = document.querySelector(`.token-slot[data-player="${color}"][data-index="${index}"]`);
        } else {
            // On Path
            const cellId = this.players[color].path[pos];
            if (typeof cellId === 'string') {
                const parts = cellId.split('-');
                const step = parseInt(parts[2]);
                if (color === 'red') targetEl = this.getCellAt(7, step);
                if (color === 'green') targetEl = this.getCellAt(step, 7);
                if (color === 'yellow') targetEl = this.getCellAt(7, 14 - step);
                if (color === 'blue') targetEl = this.getCellAt(14 - step, 7);
            } else {
                const coords = this.getCommonTrackCoords(cellId);
                targetEl = this.getCellAt(coords[0], coords[1]);
            }
        }

        if (targetEl) {
            const board = document.getElementById('ludo-board');
            let top = 0, left = 0;
            let el = targetEl;
            
            // Calculate absolute position relative to board
            while (el && el !== board) {
                top += el.offsetTop;
                left += el.offsetLeft;
                el = el.offsetParent;
            }
            
            token.style.left = `${left + (targetEl.offsetWidth / 2) - 16}px`;
            token.style.top = `${top + (targetEl.offsetHeight / 2) - 16}px`;
        }
    }

    getCellAt(r, c) {
        return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    }

    getCommonTrackCoords(index) {
        const track = [
            [6,1],[6,2],[6,3],[6,4],[6,5], // Red start stretch
            [5,6],[4,6],[3,6],[2,6],[1,6],[0,6], // Up to top-left
            [0,7], // Across top
            [0,8],[1,8],[2,8],[3,8],[4,8],[5,8], // Down green stretch
            [6,9],[6,10],[6,11],[6,12],[6,13],[6,14], // Right stretch
            [7,14], // Across right
            [8,14],[8,13],[8,12],[8,11],[8,10],[8,9], // Down yellow stretch
            [9,8],[10,8],[11,8],[12,8],[13,8],[14,8], // Down blue entry
            [14,7], // Across bottom
            [14,6],[13,6],[12,6],[11,6],[10,6],[9,6], // Up blue stretch
            [8,5],[8,4],[8,3],[8,2],[8,1],[8,0], // Left stretch
            [7,0], // Across left
            [6,0] // Back to red start
        ];
        return track[index];
    }

    setupEventListeners() {
        document.getElementById('roll-btn').addEventListener('click', () => this.rollDice());
        document.getElementById('dice-container').addEventListener('click', () => {
            if (this.gameState === 'WAITING_FOR_ROLL') {
                this.rollDice();
            } else if (this.gameState === 'WAITING_FOR_MOVE') {
                // Move the first clickable token automatically when dice is clicked
                const player = CONFIG.PLAYERS[this.turn];
                const availableTokenIndices = [];
                this.players[player].tokens.forEach((pos, idx) => {
                    if (this.canMove(player, idx)) availableTokenIndices.push(idx);
                });
                if (availableTokenIndices.length > 0) {
                    this.moveToken(player, availableTokenIndices[0]);
                }
            }
        });
        
        document.querySelectorAll('.token').forEach(el => {
            el.addEventListener('click', (e) => {
                if (this.gameState === 'WAITING_FOR_MOVE') {
                    const player = e.target.dataset.player;
                    const index = parseInt(e.target.dataset.index);
                    if (player === CONFIG.PLAYERS[this.turn]) {
                        this.moveToken(player, index);
                    }
                }
            });
        });

        window.addEventListener('resize', () => {
            CONFIG.PLAYERS.forEach(color => {
                for(let i=0; i<4; i++) this.positionToken(color, i);
            });
        });
    }

    rollDice() {
        if (this.gameState !== 'WAITING_FOR_ROLL' || this.isRolling) return;

        this.isRolling = true;
        const diceMain = document.getElementById('dice');
        const rollBtn = document.getElementById('roll-btn');
        rollBtn.disabled = true;

        // Animate Dice
        let counter = 0;
        const interval = setInterval(() => {
            this.diceRoll = Math.floor(Math.random() * 6) + 1;
            this.updateDiceUI(this.diceRoll, true);
            counter++;
            if (counter > 10) {
                clearInterval(interval);
                this.isRolling = false;
                this.updateDiceUI(this.diceRoll, false);
                this.handleRollResult();
            }
        }, 100);
    }

    updateDiceUI(val, animating) {
        const dice = document.getElementById('dice');
        const rotations = {
            1: 'rotateX(0deg) rotateY(0deg)',
            2: 'rotateX(-90deg) rotateY(0deg)',
            3: 'rotateX(0deg) rotateY(-90deg)',
            4: 'rotateX(0deg) rotateY(90deg)',
            5: 'rotateX(90deg) rotateY(0deg)',
            6: 'rotateX(180deg) rotateY(0deg)'
        };
        dice.style.transform = rotations[val] + (animating ? ` rotateZ(${Math.random() * 360}deg)` : '');
    }

    handleRollResult() {
        const player = CONFIG.PLAYERS[this.turn];
        const tokens = this.players[player].tokens;

        const moveableIndices = [];
        tokens.forEach((pos, idx) => {
            if (this.canMove(player, idx)) moveableIndices.push(idx);
        });

        if (moveableIndices.length === 0) {
            this.setStatus(`${player.toUpperCase()} cannot move. Next turn!`);
            setTimeout(() => this.nextTurn(), 1000);
        } else {
            // Strategic Auto-move
            let targetIndex = moveableIndices[0];
            
            // Priority 1: Bring token out on 6
            if (this.diceRoll === 6) {
                const inHouse = moveableIndices.find(idx => tokens[idx] === -1);
                if (inHouse !== undefined) targetIndex = inHouse;
            } else {
                // Priority 2: Move token closest to home
                let maxPos = -2;
                moveableIndices.forEach(idx => {
                    if (tokens[idx] > maxPos) {
                        maxPos = tokens[idx];
                        targetIndex = idx;
                    }
                });
            }

            this.setStatus(`${player.toUpperCase()} rolled a ${this.diceRoll}. Moving automatically...`);
            setTimeout(() => this.moveToken(player, targetIndex), 600);
        }
    }

    canMove(player, index) {
        const currentPos = this.players[player].tokens[index];
        
        // Locked in house
        if (currentPos === -1 && this.diceRoll !== 6) return false;
        
        // Exceeds home?
        if (currentPos + this.diceRoll > 57) return false;
        
        return true;
    }

    highlightMoveableTokens(player) {
        document.querySelectorAll('.token').forEach(t => t.classList.remove('clickable'));
        this.players[player].tokens.forEach((pos, idx) => {
            if (this.canMove(player, idx)) {
                document.getElementById(`token-${player}-${idx}`).classList.add('clickable');
            }
        });
    }

    async moveToken(player, index) {
        if (!this.canMove(player, index)) return;
        
        document.querySelectorAll('.token').forEach(t => t.classList.remove('clickable'));
        this.gameState = 'ANIMATING';
        
        let currentPos = this.players[player].tokens[index];
        const targetPos = currentPos === -1 ? 0 : currentPos + this.diceRoll;

        // Animate step by step
        for (let i = (currentPos === -1 ? -1 : currentPos); i < targetPos; i++) {
            if (i === -1) {
                this.players[player].tokens[index] = 0;
            } else {
                this.players[player].tokens[index]++;
            }
            this.positionToken(player, index);
            await this.sleep(100);
        }

        this.checkCaptures(player, index);
        this.checkWin(player);

        if (this.diceRoll === 6) {
            this.setStatus(`${player.toUpperCase()} rolled a 6! Roll again.`);
            this.gameState = 'WAITING_FOR_ROLL';
            document.getElementById('roll-btn').disabled = false;
        } else {
            this.nextTurn();
        }
    }

    checkCaptures(player, index) {
        const currentPos = this.players[player].tokens[index];
        const currentPathCellId = this.players[player].path[currentPos];
        
        if (typeof currentPathCellId === 'string') return; // Home stretch is safe
        if (CONFIG.SAFE_CELLS.includes(currentPathCellId)) return; // Safe cells

        CONFIG.PLAYERS.forEach(otherPlayer => {
            if (otherPlayer === player) return;
            
            this.players[otherPlayer].tokens.forEach((otherPos, otherIdx) => {
                if (otherPos === -1 || otherPos > 51) return;
                
                const otherPathCellId = this.players[otherPlayer].path[otherPos];
                if (currentPathCellId === otherPathCellId) {
                    // Capture!
                    this.players[otherPlayer].tokens[otherIdx] = -1;
                    this.positionToken(otherPlayer, otherIdx);
                    this.setStatus(`BOOM! ${player} captured ${otherPlayer}!`);
                }
            });
        });
    }

    checkWin(player) {
        const homeCount = this.players[player].tokens.filter(pos => pos === 57).length;
        if (homeCount === 4) {
            document.getElementById('winner-text').innerText = `${player.toUpperCase()} Wins!`;
            document.getElementById('winner-modal').classList.remove('hidden');
            this.reportWin(player);
        }
    }

    async reportWin(player) {
        try {
            await fetch('http://localhost:5000/api/win', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player: player.toUpperCase() })
            });
            this.fetchLeaderboard();
        } catch (e) {
            console.log('Could not report win to server');
        }
    }

    nextTurn() {
        this.turn = (this.turn + 1) % CONFIG.PLAYERS.length;
        this.gameState = 'WAITING_FOR_ROLL';
        this.updateUI();
        document.getElementById('roll-btn').disabled = false;
        this.setStatus(`Player ${this.turn + 1}'s turn`);
    }

    updateUI() {
        document.querySelectorAll('.player-card').forEach(c => c.classList.remove('active'));
        document.getElementById(`player-${this.turn + 1}`).classList.add('active');
    }

    setStatus(msg) {
        document.getElementById('game-status').innerText = msg;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Start Game
window.onload = () => {
    window.game = new Game();
    
    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });
};
