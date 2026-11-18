"use client";

import { useState, useEffect, useCallback } from "react";

type Player = "X" | "O";
type CellValue = Player | null;
type GameMode = "pvp" | "pve";
type AIDifficulty = "easy" | "hard";

const WINNING_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board: CellValue[]): { winner: Player; line: number[] } | null {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line: combo };
    }
  }
  return null;
}

function isBoardFull(board: CellValue[]): boolean {
  return board.every((cell) => cell !== null);
}

// Minimax algorithm for unbeatable AI
function minimax(
  currentBoard: CellValue[],
  depth: number,
  isMaximizing: boolean
): { score: number; bestMove?: number } {
  const result = checkWinner(currentBoard);
  if (result) {
    return { score: result.winner === "O" ? 10 - depth : depth - 10 };
  }
  if (isBoardFull(currentBoard)) {
    return { score: 0 };
  }

  const emptyIndices = currentBoard
    .map((val, idx) => (val === null ? idx : null))
    .filter((val): val is number => val !== null);

  if (isMaximizing) {
    let maxEval = -Infinity;
    let bestMove = emptyIndices[0];

    for (const idx of emptyIndices) {
      currentBoard[idx] = "O";
      const evaluation = minimax(currentBoard, depth + 1, false).score;
      currentBoard[idx] = null;
      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = idx;
      }
    }
    return { score: maxEval, bestMove };
  } else {
    let minEval = Infinity;
    let bestMove = emptyIndices[0];

    for (const idx of emptyIndices) {
      currentBoard[idx] = "X";
      const evaluation = minimax(currentBoard, depth + 1, true).score;
      currentBoard[idx] = null;
      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = idx;
      }
    }
    return { score: minEval, bestMove };
  }
}

export default function Home() {
  const [board, setBoard] = useState<CellValue[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<GameMode>("pvp");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("hard");
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [scores, setScores] = useState({ x: 0, o: 0, ties: 0 });
  const [moveHistory, setMoveHistory] = useState<CellValue[][]>([]);

  const winInfo = checkWinner(board);
  const isTie = !winInfo && isBoardFull(board);
  const isGameOver = Boolean(winInfo || isTie);

  // Update scores when game concludes
  const handleGameEnd = useCallback((winner: Player | "tie") => {
    setScores((prev) => {
      if (winner === "X") return { ...prev, x: prev.x + 1 };
      if (winner === "O") return { ...prev, o: prev.o + 1 };
      return { ...prev, ties: prev.ties + 1 };
    });
  }, []);

  // Make move helper
  const handleCellClick = useCallback(
    (index: number) => {
      if (board[index] || isGameOver || isAiThinking) return;
      if (gameMode === "pve" && !xIsNext) return;

      const nextBoard = [...board];
      nextBoard[index] = xIsNext ? "X" : "O";

      setMoveHistory((prev) => [...prev, board]);
      setBoard(nextBoard);

      const check = checkWinner(nextBoard);
      if (check) {
        handleGameEnd(check.winner);
      } else if (isBoardFull(nextBoard)) {
        handleGameEnd("tie");
      } else {
        setXIsNext(!xIsNext);
      }
    },
    [board, isGameOver, isAiThinking, gameMode, xIsNext, handleGameEnd]
  );

  // AI response move
  useEffect(() => {
    if (gameMode !== "pve" || xIsNext || isGameOver) return;

    setIsAiThinking(true);
    const timer = setTimeout(() => {
      const emptyIndices = board
        .map((val, idx) => (val === null ? idx : null))
        .filter((val): val is number => val !== null);

      if (emptyIndices.length === 0) {
        setIsAiThinking(false);
        return;
      }

      let chosenIndex: number;

      if (difficulty === "easy") {
        // Random move with 60% chance, or block/win
        const shouldPickRandom = Math.random() < 0.6;
        if (shouldPickRandom) {
          chosenIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        } else {
          const { bestMove } = minimax([...board], 0, true);
          chosenIndex = bestMove ?? emptyIndices[0];
        }
      } else {
        // Hard: unbeatable minimax
        const { bestMove } = minimax([...board], 0, true);
        chosenIndex = bestMove ?? emptyIndices[0];
      }

      const nextBoard = [...board];
      nextBoard[chosenIndex] = "O";

      setMoveHistory((prev) => [...prev, board]);
      setBoard(nextBoard);

      const check = checkWinner(nextBoard);
      if (check) {
        handleGameEnd(check.winner);
      } else if (isBoardFull(nextBoard)) {
        handleGameEnd("tie");
      } else {
        setXIsNext(true);
      }
      setIsAiThinking(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [gameMode, xIsNext, isGameOver, board, difficulty, handleGameEnd]);

  // Restart round
  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setIsAiThinking(false);
    setMoveHistory([]);
  };

  // Switch mode
  const switchMode = (mode: GameMode) => {
    setGameMode(mode);
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setIsAiThinking(false);
    setMoveHistory([]);
  };

  // Undo move
  const handleUndo = () => {
    if (moveHistory.length === 0 || isAiThinking || isGameOver) return;

    if (gameMode === "pve") {
      // In PvE, revert two moves if it was player's turn, or one if game just started
      if (moveHistory.length >= 2) {
        const previousState = moveHistory[moveHistory.length - 2];
        setBoard(previousState);
        setMoveHistory((prev) => prev.slice(0, prev.length - 2));
        setXIsNext(true);
      } else {
        resetGame();
      }
    } else {
      const previousState = moveHistory[moveHistory.length - 1];
      setBoard(previousState);
      setMoveHistory((prev) => prev.slice(0, prev.length - 1));
      setXIsNext(!xIsNext);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
            Cờ Caro 3x3
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Trò chơi Tic-Tac-Toe giải trí cổ điển
          </p>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/50">
          <button
            onClick={() => switchMode("pvp")}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
              gameMode === "pvp"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            👥 2 Người chơi
          </button>
          <button
            onClick={() => switchMode("pve")}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
              gameMode === "pve"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            🤖 Đấu với Máy
          </button>
        </div>

        {/* AI Difficulty Selector (PvE only) */}
        {gameMode === "pve" && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-slate-900/50 rounded-xl border border-slate-800 text-xs text-slate-400">
            <span>Độ khó AI:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setDifficulty("easy")}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  difficulty === "easy"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "hover:bg-slate-800 text-slate-400"
                }`}
              >
                Dễ
              </button>
              <button
                onClick={() => setDifficulty("hard")}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  difficulty === "hard"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "hover:bg-slate-800 text-slate-400"
                }`}
              >
                Khó (Bất bại)
              </button>
            </div>
          </div>
        )}

        {/* Score Board */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-900/60 rounded-2xl p-2.5 border border-cyan-500/20">
            <div className="text-[11px] font-semibold tracking-wider text-cyan-400 uppercase">
              X {gameMode === "pve" ? "(Bạn)" : ""}
            </div>
            <div className="text-xl font-bold text-slate-100 mt-0.5">{scores.x}</div>
          </div>
          <div className="bg-slate-900/60 rounded-2xl p-2.5 border border-slate-700/50">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Hòa</div>
            <div className="text-xl font-bold text-slate-100 mt-0.5">{scores.ties}</div>
          </div>
          <div className="bg-slate-900/60 rounded-2xl p-2.5 border border-pink-500/20">
            <div className="text-[11px] font-semibold tracking-wider text-pink-400 uppercase">
              O {gameMode === "pve" ? "(Máy)" : ""}
            </div>
            <div className="text-xl font-bold text-slate-100 mt-0.5">{scores.o}</div>
          </div>
        </div>

        {/* Status Banner */}
        <div className="text-center py-2 px-3 rounded-xl bg-slate-900/40 border border-slate-700/40 flex items-center justify-center min-h-[42px]">
          {winInfo ? (
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 animate-bounce">
              🎉 Người chơi <span className={winInfo.winner === "X" ? "text-cyan-400" : "text-pink-400"}>{winInfo.winner}</span> chiến thắng!
            </span>
          ) : isTie ? (
            <span className="font-bold text-amber-400">🤝 Ván đấu hòa cờ!</span>
          ) : isAiThinking ? (
            <span className="font-medium text-slate-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-pink-400 animate-ping" />
              Máy đang suy nghĩ nước đi...
            </span>
          ) : (
            <span className="font-medium text-slate-300 flex items-center gap-2 text-sm">
              Lượt đánh:{" "}
              <span
                className={`font-black text-base px-2 py-0.5 rounded-md ${
                  xIsNext
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "bg-pink-500/10 text-pink-400 border border-pink-500/30"
                }`}
              >
                {xIsNext ? "X" : "O"}
              </span>
            </span>
          )}
        </div>

        {/* 3x3 Board */}
        <div className="grid grid-cols-3 gap-2.5 aspect-square p-2 bg-slate-950/60 rounded-3xl border border-slate-800 shadow-inner">
          {board.map((cell, index) => {
            const isWinningCell = winInfo?.line.includes(index);
            return (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                disabled={Boolean(cell || isGameOver || isAiThinking)}
                className={`flex items-center justify-center rounded-2xl text-4xl sm:text-5xl font-black transition-all duration-200 select-none cursor-pointer ${
                  isWinningCell
                    ? "bg-emerald-500/25 border-2 border-emerald-400 text-emerald-300 scale-102 shadow-lg shadow-emerald-500/20"
                    : cell
                    ? "bg-slate-800/90 border border-slate-700"
                    : "bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 hover:border-slate-500/50 active:scale-95"
                } ${
                  cell === "X" && !isWinningCell ? "text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]" : ""
                } ${
                  cell === "O" && !isWinningCell ? "text-pink-400 drop-shadow-[0_0_12px_rgba(244,114,182,0.4)]" : ""
                }`}
              >
                {cell}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={resetGame}
            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            Ván mới 🔄
          </button>
          <button
            onClick={handleUndo}
            disabled={moveHistory.length === 0 || isGameOver || isAiThinking}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 active:scale-98 disabled:opacity-40 disabled:pointer-events-none text-slate-300 rounded-xl font-medium text-xs transition border border-slate-700 cursor-pointer"
            title="Đi lại nước trước"
          >
            Hoàn tác ↩
          </button>
          <button
            onClick={() => {
              resetGame();
              setScores({ x: 0, o: 0, ties: 0 });
            }}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-400 hover:text-rose-300 rounded-xl font-medium text-xs transition border border-slate-700 cursor-pointer"
            title="Đặt lại toàn bộ điểm số"
          >
            Xóa điểm
          </button>
        </div>

      </div>
    </div>
  );
}
