import React, { useState, useEffect, useCallback } from 'react';
import './PuzzleGame.css';

// Game constants
const BOARD_WIDTH = 6;
const BOARD_HEIGHT = 5;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

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
      if (board[row][col] === currentColor) {
        count++;
      } else {
        if (count >= 3) {
          // Add positions to matches
          for (let i = col - count; i < col; i++) {
            matches.push({ row, col: i });
          }
        }
        count = 1;
        currentColor = board[row][col];
      }
    }
    
    // Check the last sequence
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
      if (board[row][col] === currentColor) {
        count++;
      } else {
        if (count >= 3) {
          // Add positions to matches
          for (let i = row - count; i < row; i++) {
            matches.push({ row: i, col });
          }
        }
        count = 1;
        currentColor = board[row][col];
      }
    }
    
    // Check the last sequence
    if (count >= 3) {
      for (let i = BOARD_HEIGHT - count; i < BOARD_HEIGHT; i++) {
        matches.push({ row: i, col });
      }
    }
  }
  
  return matches;
};

// Remove duplicate matches
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
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  // Remove matches from the board
  const removeMatches = useCallback((currentBoard: Board): Board => {
    const matches = removeDuplicateMatches(findMatches(currentBoard));
    
    if (matches.length === 0) {
      return currentBoard;
    }
    
    const newBoard = currentBoard.map(row => [...row]);
    
    // Mark matched blocks for removal (set to -1)
    matches.forEach(({ row, col }) => {
      newBoard[row][col] = -1;
    });
    
    // Apply gravity - drop blocks down
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const column = [];
      for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        if (newBoard[row][col] !== -1) {
          column.push(newBoard[row][col]);
        }
      }
      
      // Fill from bottom
      for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        if (column.length > 0) {
          newBoard[row][col] = column.shift()!;
        } else {
          // Generate new random blocks at the top
          newBoard[row][col] = Math.floor(Math.random() * COLORS.length);
        }
      }
    }
    
    return newBoard;
  }, []);

  // Process matches continuously until no more matches
  const processMatches = useCallback(async (currentBoard: Board): Promise<Board> => {
    let newBoard = currentBoard;
    let hasMatches = true;
    
    while (hasMatches) {
      const matches = findMatches(newBoard);
      if (matches.length === 0) {
        hasMatches = false;
      } else {
        newBoard = removeMatches(newBoard);
        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return newBoard;
  }, [removeMatches]);

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDraggedBlock({ row, col });
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent, row: number, col: number) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const touch = e.touches[0];
    setDraggedBlock({ row, col });
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
  };

  // Handle mouse/touch move
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!draggedBlock || !dragOffset) return;

    // Find the target cell based on cursor position
    const gameBoard = document.querySelector('.puzzle-board');
    if (!gameBoard) return;

    const rect = gameBoard.getBoundingClientRect();
    const cellWidth = rect.width / BOARD_WIDTH;
    const cellHeight = rect.height / BOARD_HEIGHT;
    
    const targetCol = Math.floor((clientX - rect.left) / cellWidth);
    const targetRow = Math.floor((clientY - rect.top) / cellHeight);
    
    // Check if target is valid and adjacent to dragged block
    if (
      targetRow >= 0 && targetRow < BOARD_HEIGHT &&
      targetCol >= 0 && targetCol < BOARD_WIDTH &&
      (targetRow !== draggedBlock.row || targetCol !== draggedBlock.col)
    ) {
      const rowDiff = Math.abs(targetRow - draggedBlock.row);
      const colDiff = Math.abs(targetCol - draggedBlock.col);
      
      // Only allow adjacent moves (including diagonal)
      if (rowDiff <= 1 && colDiff <= 1) {
        // Swap blocks
        setBoard(prevBoard => {
          const newBoard = prevBoard.map(row => [...row]);
          const temp = newBoard[draggedBlock.row][draggedBlock.col];
          newBoard[draggedBlock.row][draggedBlock.col] = newBoard[targetRow][targetCol];
          newBoard[targetRow][targetCol] = temp;
          return newBoard;
        });
        
        setDraggedBlock({ row: targetRow, col: targetCol });
      }
    }
  }, [draggedBlock, dragOffset]);

  // These mouse/touch move handlers are handled globally in useEffect

  // Handle mouse/touch end functionality is now integrated into the useEffect

  // Add global event listeners for mouse/touch events
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggedBlock) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (draggedBlock) {
        e.preventDefault();
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const handleGlobalEnd = async () => {
      if (draggedBlock) {
        // Process any matches after the move
        const newBoard = await processMatches(board);
        setBoard(newBoard);
        setDraggedBlock(null);
        setDragOffset(null);
      }
    };

    if (draggedBlock) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalEnd);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [draggedBlock, handleMove, board, processMatches]);

  // Process initial matches on board load
  useEffect(() => {
    const processInitialMatches = async () => {
      const currentBoard = board;
      const newBoard = await processMatches(currentBoard);
      if (newBoard !== currentBoard) {
        setBoard(newBoard);
      }
    };
    
    // Only process on initial mount to avoid infinite loops
    const hasInitialMatches = findMatches(board).length > 0;
    if (hasInitialMatches) {
      processInitialMatches();
    }
  }, [board, processMatches]);

  return (
    <div className="puzzle-game">
      <h2>Puzzle & Dragons Style Game</h2>
      <div className="puzzle-board">
        {board.map((row, rowIndex) =>
          row.map((color, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`puzzle-block color-${color} ${
                draggedBlock?.row === rowIndex && draggedBlock?.col === colIndex
                  ? 'dragging'
                  : ''
              }`}
              onMouseDown={(e) => handleMouseDown(e, rowIndex, colIndex)}
              onTouchStart={(e) => handleTouchStart(e, rowIndex, colIndex)}
              style={{
                backgroundColor: COLORS[color],
                gridRow: rowIndex + 1,
                gridColumn: colIndex + 1,
              }}
            />
          ))
        )}
      </div>
      <p>Drag blocks to move them. Match 3 or more of the same color to clear them!</p>
    </div>
  );
};

export default PuzzleGame;