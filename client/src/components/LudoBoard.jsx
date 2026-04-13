import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';
import './LudoBoard.css';

const LudoBoard = ({ gameState, onTokenClick, myColor }) => {
  if (!gameState) return null;

  const safeCellsIndices = [1, 9, 14, 22, 27, 35, 40, 48];

  const renderCells = () => {
    const cells = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const isPath = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
        const isCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
        if (isCenter) continue; // Handled by center-area div

        if (isPath) {
          let cellClass = 'cell path-cell ';
          let content = null;

          // Home tracks
          if (r === 7 && c > 0 && c < 7) cellClass += 'bg-red-track';
          if (c === 7 && r > 0 && r < 7) cellClass += 'bg-green-track';
          if (r === 7 && c > 7 && c < 14) cellClass += 'bg-yellow-track';
          if (c === 7 && r > 7 && r < 14) cellClass += 'bg-blue-track';
          
          // Starting cells
          if (r === 6 && c === 1) cellClass += 'start-red';
          if (r === 1 && c === 8) cellClass += 'start-green';
          if (r === 8 && c === 13) cellClass += 'start-yellow';
          if (r === 13 && c === 6) cellClass += 'start-blue';

          // Safe icons
          const trackIdx = getTrackIdx(r, c);
          if (trackIdx !== -1 && safeCellsIndices.includes(trackIdx)) {
            content = <Shield size={12} className="safe-icon" style={{ opacity: 0.3, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />;
          }

          cells.push(
            <div key={`${r}-${c}`} className={cellClass} style={{ gridRow: r + 1, gridColumn: c + 1 }}>
              {content}
            </div>
          );
        }
      }
    }
    return cells;
  };

  const getTrackIdx = (r, c) => {
    const track = [
        [6,1],[6,2],[6,3],[6,4],[6,5],
        [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
        [0,7],
        [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
        [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
        [7,14],
        [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
        [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
        [14,7],
        [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
        [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
        [7,0],
        [6,0]
    ];
    return track.findIndex(p => p[0] === r && p[1] === c);
  };

  const getPosInGrid = (color, pos, tokenIdx) => {
    if (pos === -1) {
      // 1-based grid coordinates for 15x15 board
      // Red: cells 1-6, 1-6. Center is roughly 3,3
      const housePositions = {
        red: [[2,2], [2,5], [5,2], [5,5]],
        green: [[2,11], [2,14], [5,11], [5,14]],
        yellow: [[11,11], [11,14], [14,11], [14,14]],
        blue: [[11,2], [11,5], [14,2], [14,5]]
      };
      // Return 0-indexed for the component logic to add +1
      return [housePositions[color][tokenIdx][0] - 1, housePositions[color][tokenIdx][1] - 1];
    }

    if (pos >= 52) {
      const step = pos - 52;
      if (color === 'red') return [7, 1 + step];
      if (color === 'green') return [1 + step, 7];
      if (color === 'yellow') return [7, 13 - step];
      if (color === 'blue') return [13 - step, 7];
    }

    const track = [
        [6,1],[6,2],[6,3],[6,4],[6,5],
        [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
        [0,7],
        [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
        [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
        [7,14],
        [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
        [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
        [14,7],
        [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
        [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
        [7,0],
        [6,0]
    ];
    
    const colors = ['red', 'green', 'yellow', 'blue'];
    const colorOffsets = { red: 0, green: 13, yellow: 26, blue: 39 };
    const globalIdx = (colorOffsets[color] + pos) % 52;
    return track[globalIdx];
  };

  return (
    <div className="ludo-board-container shadow-glow">
      <div className="ludo-board-inner">
        <div className="house house-red"><div className="inner-house"></div></div>
        <div className="house house-green"><div className="inner-house"></div></div>
        <div className="house house-yellow"><div className="inner-house"></div></div>
        <div className="house house-blue"><div className="inner-house"></div></div>
        
        {renderCells()}

        <AnimatePresence>
          {Object.values(gameState.players).map(player => 
            player.tokens.map((pos, idx) => {
              if (pos === 58) return null;
              const gridPos = getPosInGrid(player.color, pos, idx);
              const isTurn = gameState.turn === player.color;
              const isMovable = isTurn && 
                               (pos === -1 ? gameState.diceValue === 6 : (pos + gameState.diceValue <= 57)) &&
                               gameState.gameState === 'WAITING_FOR_MOVE' && 
                               myColor === player.color;

              return (
                <motion.div
                  key={`${player.color}-${idx}`}
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  animate={{ 
                    gridRow: Math.floor(gridPos[0] + 1),
                    gridColumn: Math.floor(gridPos[1] + 1),
                    scale: 1,
                    zIndex: pos === -1 ? 10 : 20 + idx
                  }}
                  className={`token ${player.color} ${isMovable ? 'clickable' : ''}`}
                  onClick={() => isMovable && onTokenClick(idx)}
                />
              );
            })
          )}
        </AnimatePresence>
        
        <div className="board-center shadow-glow">
          <div className="center-pattern"></div>
          <div className="center-logo">NEO</div>
        </div>
      </div>
    </div>
  );
};

export default LudoBoard;
