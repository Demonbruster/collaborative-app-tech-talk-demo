import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import PouchDB from 'pouchdb';
import { useAuth } from '../contexts/AuthContext';
import { Board } from '../types/board';
import db from '../services/db';

interface BaseDoc {
  _id: string;
  _rev?: string;
  type: 'board' | 'shape' | 'cursor';
  boardId: string;
}

interface BoardDoc extends BaseDoc {
  type: 'board';
  name: string;
  createdBy: string;
  createdAt: number;
  collaborators: string[];
  isPublic: boolean;
}

const generateSafeId = (type: string) => {
  const id = nanoid();
  return `${type}:${id.startsWith('_') ? 'n' + id : id}`;
};

export const BoardList = () => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newBoardName, setNewBoardName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const result = await db.find({
        selector: {
          type: 'board'
        }
      });
      
      const boardList = (result.docs as unknown as BoardDoc[])
        .map(doc => ({
          id: doc._id.split(':')[1],
          name: doc.name,
          createdBy: doc.createdBy,
          createdAt: doc.createdAt,
          collaborators: doc.collaborators,
          isPublic: doc.isPublic,
        }))
        .filter(board => 
          board.createdBy === user?.uid || 
          board.collaborators.includes(user?.uid || '') ||
          board.isPublic
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      
      setBoards(boardList);
    } catch (error) {
      console.error('Error loading boards:', error);
      setError('Failed to load boards');
    } finally {
      setIsLoading(false);
    }
  };

  const createBoard = async () => {
    if (!newBoardName.trim() || !user) return;

    const boardId = generateSafeId('board');
    const newBoard: BoardDoc = {
      _id: boardId,
      type: 'board',
      boardId: boardId.split(':')[1],
      name: newBoardName.trim(),
      createdBy: user.uid,
      createdAt: Date.now(),
      collaborators: [],
      isPublic: false,
    };

    try {
      await db.put(newBoard);
      setBoards(prev => [{
        id: boardId.split(':')[1],
        name: newBoard.name,
        createdBy: newBoard.createdBy,
        createdAt: newBoard.createdAt,
        collaborators: newBoard.collaborators,
        isPublic: newBoard.isPublic,
      }, ...prev]);
      setNewBoardName('');
      navigate(`/board/${boardId.split(':')[1]}`);
    } catch (error) {
      console.error('Error creating board:', error);
      setError('Failed to create board');
    }
  };

  const shareBoard = async (board: Board) => {
    try {
      const doc = await db.get(`board:${board.id}`) as BoardDoc;
      const updatedBoard = {
        ...doc,
        isPublic: !board.isPublic,
      };
      await db.put(updatedBoard);
      
      setBoards(prev => 
        prev.map(b => b.id === board.id ? {
          ...b,
          isPublic: !b.isPublic,
        } : b)
      );
    } catch (error) {
      console.error('Error updating board:', error);
      setError('Failed to update board');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading boards...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 text-white">Drawing Boards</h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="Enter board name"
            className="flex-1 border bg-gray-800 text-white border-gray-700 rounded px-3 py-2 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={createBoard}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium"
          >
            Create Board
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {boards.map(board => (
          <div
            key={board.id}
            className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 flex justify-between items-center hover:bg-gray-700/50 transition-colors"
          >
            <div>
              <h3 className="font-semibold text-lg text-white">{board.name}</h3>
              <p className="text-sm text-gray-400">
                Created {new Date(board.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => shareBoard(board)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  board.isPublic
                    ? 'bg-green-900/50 text-green-200 hover:bg-green-800/50'
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
              >
                {board.isPublic ? 'Public' : 'Private'}
              </button>
              <button
                onClick={() => navigate(`/board/${board.id}`)}
                className="bg-indigo-600/50 text-indigo-200 px-3 py-1 rounded text-sm font-medium hover:bg-indigo-500/50"
              >
                Open
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 