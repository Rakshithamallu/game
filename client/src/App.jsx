import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import LudoBoard from './components/LudoBoard';
import Dice from './components/Dice';
import { Trophy, Users, MessageSquare, Send, X, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  
  const chatEndRef = useRef(null);

  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    socket.on('game_state', (state) => {
      setGameState(state);
      setWinner(state.gameState === 'FINISHED' ? { name: state.players[state.activePlayerId]?.name, color: state.turn } : null);
    });

    socket.on('game_status', (data) => {
      setStatusMsg(data.message);
      setTimeout(() => setStatusMsg(''), 3000);
    });

    socket.on('receive_chat', (data) => {
      setChat((prev) => [...prev, data]);
    });

    socket.on('timer_sync', (data) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('player_won', (data) => {
      setWinner(data);
    });

    socket.on('game_status', (data) => {
      // Could add toast notifications here
      console.log('STATUS:', data.message);
    });

    return () => {
      socket.off('game_state');
      socket.off('receive_chat');
      socket.off('timer_sync');
      socket.off('player_won');
      socket.off('game_status');
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const joinRoom = () => {
    if (roomId && playerName) {
      socket.emit('join_room', { roomId, playerName });
      setJoined(true);
    }
  };

  const rollDice = () => {
    socket.emit('roll_dice', { roomId });
  };

  const moveToken = (tokenIndex) => {
    socket.emit('move_token', { roomId, tokenIndex });
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (msg.trim()) {
      socket.emit('send_chat', { roomId, message: msg, playerName });
      setMsg('');
    }
  };

  if (!joined) {
    return (
      <div className="lobby-container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lobby-card glass-card"
        >
          <div className="logo-wrapper">
            <h1 className="gradient-text">LUDO <span className="neo">NEO</span></h1>
            <div className="logo-glow"></div>
          </div>
          <p className="subtitle">Real-time Premium Multiplayer Battle</p>
          
          <div className="input-field">
            <label>DISPLAY NAME</label>
            <input 
              type="text" 
              placeholder="Enter your name" 
              value={playerName} 
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={15}
            />
          </div>

          <div className="input-field">
            <label>ROOM CODE</label>
            <input 
              type="text" 
              placeholder="e.g. BATTLE-X" 
              value={roomId} 
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>

          <button className="btn-premium join-btn" onClick={joinRoom} disabled={!playerName || !roomId}>
            PLAY NOW
          </button>

          <div className="lobby-stats">
            <div className="stat-item"><Users size={16} /> 1.2k Online</div>
            <div className="stat-item"><Trophy size={16} /> Leaderboard</div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <AnimatePresence>
        {winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="victory-overlay"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="victory-card glass-card"
            >
              <Crown size={80} className={`crown ${winner.color}`} />
              <h2>VICTORY!</h2>
              <p className="winner-name">{winner.player} is the Champion!</p>
              <button className="btn-premium" onClick={() => window.location.reload()}>PLAY AGAIN</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sidebar left-sidebar">
        <div className="room-info glass-card">
          <span className="room-id">ROOM: {roomId}</span>
          <div className="status-indicator online">LIVE</div>
        </div>

        <div className="players-list">
          {gameState && Object.values(gameState.players).map((p, idx) => (
            <motion.div 
              key={idx} 
              layout
              className={`player-panel ${p.color} ${gameState.turn === p.color ? 'active' : ''}`}
            >
              <div className="avatar-wrapper">
                <div className="avatar">{p.name[0].toUpperCase()}</div>
                <div className="color-ring"></div>
              </div>
              <div className="info">
                <span className="name">{p.name}</span>
                <div className="timer-bar-bg">
                  {gameState.turn === p.color && (
                    <motion.div 
                      className="timer-bar-fill"
                      initial={{ width: '100%' }}
                      animate={{ width: `${(timeLeft / 30) * 100}%` }}
                      transition={{ duration: 1, ease: "linear" }}
                    />
                  )}
                </div>
              </div>
              {gameState.turn === p.color && <div className="indicator-pulse"></div>}
            </motion.div>
          ))}
          {gameState && Object.keys(gameState.players).length < 4 && (
            <button 
              className="btn-premium add-bot-btn" 
              onClick={() => socket.emit('add_bot', { roomId })}
              style={{ padding: '8px', fontSize: '0.7rem', opacity: 0.6 }}
            >
              + ADD AI PLAYER
            </button>
          )}
        </div>
      </div>

      <main className="board-wrapper">
        <AnimatePresence>
          {statusMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="status-toast"
            >
              {statusMsg}
            </motion.div>
          )}
        </AnimatePresence>
        <LudoBoard 
          gameState={gameState} 
          onTokenClick={moveToken}
          myColor={gameState?.players[socket.id]?.color}
        />
        
        <div className="game-controls">
          <Dice 
            value={gameState?.diceValue || 0} 
            isMyTurn={gameState?.activePlayerId === socket.id}
            onRoll={rollDice}
            gameState={gameState?.gameState}
          />
        </div>
      </main>

      <div className="sidebar right-sidebar">
        <div className="chat-container glass-card">
          <div className="chat-header">
            <h3><MessageSquare size={18} /> LIVE CHAT</h3>
          </div>
          <div className="messages">
            {chat.map((c, i) => (
              <div key={i} className={`msg ${c.playerName === playerName ? 'own' : ''}`}>
                <span className="sender">{c.playerName}</span>
                <p>{c.message}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input" onSubmit={sendChat}>
            <input 
              type="text" 
              placeholder="Say something..." 
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <button type="submit" disabled={!msg.trim()}><Send size={18} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
