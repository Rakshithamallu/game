import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './Dice.css';

const Dice = ({ value, isMyTurn, onRoll, gameState }) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (value > 0) {
      const rotations = {
        1: { x: 0, y: 0 },
        2: { x: -90, y: 0 },
        3: { x: 0, y: -90 },
        4: { x: 0, y: 90 },
        5: { x: 90, y: 0 },
        6: { x: 180, y: 0 }
      };
      const rot = rotations[value];
      setRotation({ 
        x: rot.x + (Math.random() * 360 * 2), // Add spins
        y: rot.y + (Math.random() * 360 * 2),
        z: Math.random() * 360
      });
      
      // Real landing after animation
      setTimeout(() => {
        setRotation({ x: rot.x, y: rot.y, z: 0 });
      }, 600);
    }
  }, [value]);

  const canRoll = isMyTurn && gameState === 'WAITING_FOR_ROLL';

  const faces = [
    { name: 'front', dots: 1 },
    { name: 'back', dots: 6 },
    { name: 'right', dots: 3 },
    { name: 'left', dots: 4 },
    { name: 'top', dots: 5 },
    { name: 'bottom', dots: 2 },
  ];

  return (
    <div 
      className={`dice-container ${canRoll ? 'can-roll' : ''}`}
      onClick={() => canRoll && onRoll()}
    >
      <div className="perspective-wrapper">
        <motion.div 
          className="dice-3d"
          animate={{ rotateX: rotation.x, rotateY: rotation.y, rotateZ: rotation.z }}
          transition={{ type: "spring", stiffness: 100, damping: 10 }}
        >
          {faces.map((face, index) => (
            <div key={index} className={`face ${face.name}`}>
              {Array.from({ length: face.dots }).map((_, i) => (
                <div key={i} className="dot"></div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
      <button 
        className={`btn-premium roll-btn ${canRoll ? '' : 'disabled'}`}
        disabled={!canRoll}
      >
        {canRoll ? 'ROLL DICE' : (isMyTurn ? 'MOVE TOKEN' : 'WAITING...')}
      </button>
    </div>
  );
};

export default Dice;
