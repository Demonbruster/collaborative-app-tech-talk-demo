import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Board, BoardState } from '../types/board';
import db from '../services/db';
import { nanoid } from 'nanoid';

export const BoardList = () => {
  const navigate = useNavigate();
  const { user, tenantVerification } = useAuth();
  const [state, setState] = useState<BoardState>({
    boards: {
      owned: [],
      shared: [],
      public: [],
      private: []
    },
    isLoading: true,
    error: null
  });
  const [newBoardName, setNewBoardName] = useState('');

  useEffect(() => {
    const loadBoards = async () => {
      try {
        if (!user?.email) return;
        
        // Ensure database is initialized with current user's email
        await db.initialize(tenantVerification?.tenantEmail || '');
        await db.waitForInitialization();
        
        // Set up real-time sync for boards
        const changes = db.changes({
          since: 'now',
          live: true,
          include_docs: true,
          selector: {
            type: 'board'
          }
        });

        changes.on('change', (change) => {
          const doc = change.doc as any;
          if (doc.type === 'board') {
            updateBoardsList(doc);
          }
        });

        // Initial load of boards
        const result = await db.find({
          selector: {
            type: 'board',
            $or: [
              { createdBy: user?.email },
              { collaborators: { $elemMatch: { $eq: user?.email } } },
              { isPublic: true }
            ]
          }
        });

        const boards = result.docs.reduce((acc: BoardState['boards'], doc: any) => {
          const board: Board = {
            id: doc._id.split(':')[1],
            name: doc.name,
            createdBy: doc.createdBy,
            createdAt: doc.createdAt,
            collaborators: doc.collaborators,
            isPublic: doc.isPublic,
            lastModified: doc.lastModified,
            lastModifiedBy: doc.lastModifiedBy,
            type: 'board',
            accessType: doc.createdBy === user?.email ? 
              (doc.isPublic ? 'public' : doc.collaborators.length > 0 ? 'shared' : 'private') :
              doc.collaborators.includes(user?.email) ? 'shared' : 'public'
          };

          acc[board.accessType].push(board);
          return acc;
        }, { owned: [], shared: [], public: [], private: [] });

        setState(prev => ({
          ...prev,
          boards,
          error: null,
          isLoading: false
        }));

        return () => changes.cancel();
      } catch (error) {
        console.error('Error loading boards:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to load boards',
          isLoading: false
        }));
      }
    };

    if (user?.email) {
      loadBoards();
    }
  }, [user?.email]);

  const updateBoardsList = (doc: any) => {
    const board: Board = {
      id: doc._id.split(':')[1],
      name: doc.name,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      collaborators: doc.collaborators,
      isPublic: doc.isPublic,
      lastModified: doc.lastModified,
      lastModifiedBy: doc.lastModifiedBy,
      type: 'board',
      accessType: doc.createdBy === user?.email ? 
        (doc.isPublic ? 'public' : doc.collaborators.length > 0 ? 'shared' : 'private') :
        doc.collaborators.includes(user?.email) ? 'shared' : 'public'
    };

    setState(prev => {
      const newBoards = { ...prev.boards };
      
      // Remove from all categories first
      Object.keys(newBoards).forEach(key => {
        newBoards[key as keyof typeof newBoards] = newBoards[key as keyof typeof newBoards]
          .filter(b => b.id !== board.id);
      });

      // Add to appropriate category
      newBoards[board.accessType].push(board);
      
      return {
        ...prev,
        boards: newBoards
      };
    });
  };

  const createBoard = async () => {
    if (!newBoardName.trim() || !user?.email) return;

    try {
      const boardId = nanoid();
      await db.put({
        _id: `board:${boardId}`,
        type: 'board',
        name: newBoardName.trim(),
        createdBy: user.email,
        createdAt: Date.now(),
        collaborators: [],
        isPublic: false,
        lastModified: Date.now(),
        lastModifiedBy: user.email
      });

      setNewBoardName('');
      navigate(`/board/${boardId}`);
    } catch (error) {
      console.error('Error creating board:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to create board'
      }));
    }
  };

  const renderBoardSection = (title: string, boards: Board[]) => {
    if (boards.length === 0) return null;

    return (
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(board => (
            <div
              key={board.id}
              onClick={() => navigate(`/board/${board.id}`)}
              className="p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-lg font-medium text-white">{board.name}</h3>
              <p className="text-sm text-gray-400">
                Created by {board.createdBy}
              </p>
              {board.lastModified && (
                <p className="text-sm text-gray-400">
                  Last modified {new Date(board.lastModified).toLocaleDateString()} by {board.lastModifiedBy}
                </p>
              )}
              {board.collaborators.length > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  Shared with {board.collaborators.length} user(s)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Drawing Boards</h1>
        <div className="flex gap-4">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            placeholder="New board name"
            className="px-4 py-2 bg-gray-800 text-white rounded-md border border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={createBoard}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium"
          >
            Create Board
          </button>
        </div>
      </div>

      {state.error && (
        <div className="mt-4 p-4 bg-red-900/50 text-red-200 rounded-md">
          {state.error}
        </div>
      )}

      {state.isLoading ? (
        <div className="mt-8 text-center text-gray-400">Loading boards...</div>
      ) : (
        <>
          {renderBoardSection('My Boards', state.boards.owned)}
          {renderBoardSection('Shared With Me', state.boards.shared)}
          {renderBoardSection('Public Boards', state.boards.public)}
          {renderBoardSection('Private Boards', state.boards.private)}
        </>
      )}
    </div>
  );
}; 