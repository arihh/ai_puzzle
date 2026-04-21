import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PuzzleGame.css';

// Game constants
const BOARD_WIDTH = 6;
const BOARD_HEIGHT = 5;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const TURN_TIME_LIMIT = 5000; // 5 seconds

type BlockColor = number; // 0-5 representing different colors
type Board = BlockColor[][];
type Position = { row: number; col: number };

// Initialize a random board
const initializeBoard = (): Board => {
  const board: Board = [];
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_WIDTH; col++) {
      board[row][col] = Math.floor(Math.random() * COLORS.length);
    }
  }
  return board;
};

// Check for matches (3+ consecutive blocks of same color)
const findMatches = (board: Board): Position[] => {
  const matches: Position[] = [];
  
  // Check horizontal matches
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    let count = 1;
    let currentColor = board[row][0];
    
    for (let col = 1; col < BOARD_WIDTH; col++) {
      if (board[row][col] === currentColor && board[row][col] !== -1) {
        count++;
      } else {
        if (count >= 3) {
          for (let i = col - count; i < col; i++) {
            matches.push({ row, col: i });
          }
        }
        count = 1;
        currentColor = board[row][col];
      }
    }
    if (count >= 3) {
      for (let i = BOARD_WIDTH - count; i < BOARD_WIDTH; i++) {
        matches.push({ row, col: i });
      }
    }
  }
  
  // Check vertical matches
  for (let col = 0; col < BOARD_WIDTH; col++) {
    let count = 1;
    let currentColor = board[0][col];
    
    for (let row = 1; row < BOARD_HEIGHT; row++) {
      if (board[row][col] === currentColor && board[row][col] !== -1) {
        count++;
      } else {
        if (count >= 3) {
          for (let i = row - count; i < row; i++) {
            matches.push({ row: i, col });
          }
        }
        count = 1;
        currentColor = board[row][col];
      }
    }
    if (count >= 3) {
      for (let i = BOARD_HEIGHT - count; i < BOARD_HEIGHT; i++) {
        matches.push({ row: i, col });
      }
    }
  }
  
  return matches;
};

const removeDuplicateMatches = (matches: Position[]): Position[] => {
  const unique = new Map<string, Position>();
  matches.forEach(pos => {
    const key = `${pos.row}-${pos.col}`;
    unique.set(key, pos);
  });
  return Array.from(unique.values());
};

const PuzzleGame: React.FC = () => {
  const [board, setBoard] = useState<Board>(initializeBoard);
  const [draggedBlock, setDraggedBlock] = useState<Position | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [clearingPositions, setClearingPositions] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_LIMIT);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);

  const timerRef = useRef<number | null>(null);

  // Apply gravity and fill board
  const applyGravity = useCallback((currentBoard: Board): Board => {
    const newBoard = currentBoard.map(row => [...row]);
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const column = [];
      for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        if (newBoard[row][col] !== -1) {
          column.push(newBoard[row][col]);
        }
      }
      for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        if (column.length > 0) {
          newBoard[row][col] = column.shift()!;
        } else {
          newBoard[row][col] = Math.floor(Math.random() * COLORS.length);
        }
      }
    }
    return newBoard;
  }, []);

  // Process matches sequentially
  const processMatches = useCallback(async (currentBoard: Board) => {
    setIsProcessing(true);
    let newBoard = currentBoard;
    let turnCombo = 0;
    let hasMatches = true;

    while (hasMatches) {
      const matches = removeDuplicateMatches(findMatches(newBoard));
      if (matches.length === 0) {
        hasMatches = false;
      } else {
        // Find individual combo groups (this is simplified, Pad counts each group)
        // For simplicity here, we'll just count how many times we find matches in a loop
        // in a real Pad clone, you'd identify separate clusters.
        turnCombo++;
        setComboCount(turnCombo);

        // Phase 1: Show clearing animation
        const matchedPositions = new Set<string>();
        matches.forEach(pos => {
          matchedPositions.add(`${pos.row}-${pos.col}`);
        });
        setClearingPositions(matchedPositions);

        // Wait for animation duration (matching CSS)
        await new Promise(resolve => setTimeout(resolve, 300));

        // Phase 2: Clear animation state and update board (gravity + refill)
        setClearingPositions(new Set());

        const boardWithRemoval = newBoard.map(row => [...row]);
        matches.forEach(({ row, col }) => {
          boardWithRemoval[row][col] = -1;
        });

        newBoard = applyGravity(boardWithRemoval);
        setBoard(newBoard);

        // Small delay to allow user to see the result of gravity
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    setIsProcessing(false);
    return newBoard;
  }, [applyGravity]);

  const handleMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (isProcessing) return;
    e.preventDefault();
    setDraggedBlock({ row, col });
    setCursorPos({ x: e.clientX, y: e.clientY });
    setComboCount(0);
    setTimeLeft(TURN_TIME_LIMIT);
    setHasMoved(false);
  };

  const handleTouchStart = (e: React.TouchEvent, row: number, col: number) => {
    if (isProcessing) return;
    const touch = e.touches[0];
    setDraggedBlock({ row, col });
    setCursorPos({ x: touch.clientX, y: touch.clientY });
    setComboCount(0);
    setTimeLeft(TURN_TIME_LIMIT);
    setHasMoved(false);
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!draggedBlock || isProcessing) return;
    if (isTimerActive && timeLeft <= 0) return;

    const gameBoard = document.querySelector('.puzzle-board');
    if (!gameBoard) return;

    const rect = gameBoard.getBoundingClientRect();
    const cellWidth = rect.width / BOARD_WIDTH;
    const cellHeight = rect.height / BOARD_HEIGHT;
    
    const targetCol = Math.floor((clientX - rect.left) / cellWidth);
    const targetRow = Math.floor((clientY - rect.top) / cellHeight);
    
    if (
      targetRow >= 0 && targetRow < BOARD_HEIGHT &&
      targetCol >= 0 && targetCol < BOARD_WIDTH &&
      (targetRow !== draggedBlock.row || targetCol !== draggedBlock.col)
    ) {
      // Interpolate path for fast dragging
      const path: Position[] = [];
      let r = draggedBlock.row;
      let c = draggedBlock.col;

      const dr = Math.sign(targetRow - r);
      const dc = Math.sign(targetCol - c);

      while (r !== targetRow || c !== targetCol) {
          if (r !== targetRow) r += dr;
          if (c !== targetCol && (Math.abs(targetRow - r) <= Math.abs(targetCol - c) || r === targetRow)) {
              c += dc;
          }
          path.push({row: r, col: c});
      }

      if (path.length > 0) {
        if (!hasMoved) {
          setHasMoved(true);
          setIsTimerActive(true);
        }

        setBoard(prevBoard => {
          const newBoard = prevBoard.map(row => [...row]);
          let currentRow = draggedBlock.row;
          let currentCol = draggedBlock.col;

          for (const step of path) {
              const temp = newBoard[currentRow][currentCol];
              newBoard[currentRow][currentCol] = newBoard[step.row][step.col];
              newBoard[step.row][step.col] = temp;
              currentRow = step.row;
              currentCol = step.col;
          }
          return newBoard;
        });
        setDraggedBlock({ row: targetRow, col: targetCol });
      }
    }
  }, [draggedBlock, isProcessing, isTimerActive, timeLeft, hasMoved]);

  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 100) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 100;
        });
      }, 100);
    } else if (timeLeft <= 0 || !isTimerActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerActive, timeLeft]);

  const handleEnd = useCallback(async () => {
    if (!draggedBlock) return;
    setIsTimerActive(false);
    setDraggedBlock(null);
    setCursorPos(null);

    if (hasMoved) {
      await processMatches(board);
    }
  }, [draggedBlock, hasMoved, processMatches, board]);

  useEffect(() => {
    if (timeLeft <= 0 && draggedBlock) {
      handleEnd();
    }
  }, [timeLeft, draggedBlock, handleEnd]);

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      handleMove(e.clientX, e.clientY);
    };
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        setCursorPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleGlobalEnd = () => handleEnd();

    if (draggedBlock) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalEnd);
      window.addEventListener('touchmove', handleGlobalTouchMove);
      window.addEventListener('touchend', handleGlobalEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [draggedBlock, handleMove, handleEnd]);

  return (
    <div className="puzzle-game">
      <div className="game-header">
        <h2>Puzzle & Dragons Clone</h2>
        <div className={`combo-display ${comboCount > 0 ? 'combo-pop' : ''}`}>
          {comboCount > 0 ? `${comboCount} COMBO!` : ''}
        </div>
      </div>

      <div className="timer-container">
        <div
          className="timer-bar"
          style={{ width: `${(timeLeft / TURN_TIME_LIMIT) * 100}%` }}
        />
      </div>

      <div className="puzzle-board">
        {board.map((row, rowIndex) =>
          row.map((color, colIndex) => {
            const isDragging = draggedBlock?.row === rowIndex && draggedBlock?.col === colIndex;
            const isClearing = clearingPositions.has(`${rowIndex}-${colIndex}`);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`puzzle-block color-${color} ${isDragging ? 'dragging' : ''} ${isClearing ? 'block-removing' : ''}`}
                onMouseDown={(e) => handleMouseDown(e, rowIndex, colIndex)}
                onTouchStart={(e) => handleTouchStart(e, rowIndex, colIndex)}
                style={{
                  gridRow: rowIndex + 1,
                  gridColumn: colIndex + 1,
                }}
              >
              </div>
            );
          })
        )}
      </div>

      <div className="instructions-container">
        <h3 className="instructions-title">操作方法</h3>
        <ul className="instructions-list">
          <li>好きなドロップを掴んで自由に動かそう</li>
          <li>同じ色のドロップを3つ以上並べて消そう</li>
          <li>ドロップが消えると新しいドロップが降り、連鎖が発生！</li>
        </ul>
      </div>

      {/* Floating orb overlay */}
      {draggedBlock && cursorPos && (
        <div
          className={`floating-orb color-${board[draggedBlock.row][draggedBlock.col]}`}
          style={{
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
          }}
        />
      )}
    </div>
  );
};

export default PuzzleGame;
