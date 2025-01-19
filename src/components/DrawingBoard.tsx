import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text, Group } from 'react-konva';
import { nanoid } from 'nanoid';
import PouchDB from 'pouchdb';
import PouchFind from 'pouchdb-find';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shape, DrawingBoardState as DrawingToolState, DrawingTool } from '../types/drawing';
import { BoardCursor, DrawingBoardState } from '../types/board';
import { ShareModal } from './ShareModal';
import db from '../services/db';
import { RemoteDbService } from '../services/remoteDb';

const remoteDb = new RemoteDbService();

PouchDB.plugin(PouchFind);

interface BaseDoc {
  _id: string;
  _rev?: string;
  type: 'board' | 'shape' | 'cursor' | 'users';
  boardId: string;
}

interface BoardDoc extends BaseDoc {
  type: 'board';
  name: string;
  createdBy: string;
  createdAt: Date;
  collaborators: string[];
  isPublic: boolean;
}

interface UsersDoc extends BaseDoc {
  type: 'users';
  users: string[];
  updatedAt: Date;
}

interface ShapeDoc extends BaseDoc {
  type: 'shape';
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  points: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  createdAt: Date;
}

interface CursorDoc extends BaseDoc {
  type: 'cursor';
  userId: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
  lastUpdated: Date;
}

const generateSafeId = (type: string) => {
  const id = nanoid();
  return `${type}:${id.startsWith('_') ? 'n' + id : id}`;
};

const TOOLS = [
  { value: 'pen', label: 'Pen' },
  { value: 'eraser', label: 'Eraser' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
  { value: 'text', label: 'Text' },
] as const;

export const DrawingBoard = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { user, tenantVerification } = useAuth();
  const [boardState, setBoardState] = useState<DrawingBoardState>({
    board: null,
    shapes: [],
    cursors: {},
    isLoading: true,
    error: null,
  });
  const [drawingState, setDrawingState] = useState<DrawingToolState>({
    shapes: [] as Shape[],
    currentShape: null,
    tool: 'pen',
    color: '#000000',
    strokeWidth: 5,
    fontSize: 20,
  });
  
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);

  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');

  // Load board data
  useEffect(() => {
    const loadBoard = async () => {
      if (!boardId) return;

      try {
        await db.waitForInitialization();
        const boardDoc = await db.get(`board:${boardId}`) as BoardDoc;
        setBoardState(prev => ({
          ...prev,
          board: {
            id: boardId,
            name: boardDoc.name,
            createdBy: boardDoc.createdBy,
            createdAt: boardDoc.createdAt,
            collaborators: boardDoc.collaborators,
            isPublic: boardDoc.isPublic,
            type: 'board',
            accessType: 'owned',
          },
        }));

        // Load shapes
        const result = await db.find({
          selector: {
            type: 'shape',
            boardId,
          },
          sort: [{ '_id': 'asc' }],
        });
        console.log("result", result);
        const shapes = (result.docs as unknown as ShapeDoc[])
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map(doc => ({
            id: doc._id.split(':')[1],
            tool: doc.tool,
            color: doc.tool === 'eraser' ? '#ffffff' : doc.color,
            strokeWidth: doc.strokeWidth,
            points: doc.points,
            x: doc.x,
            y: doc.y,
            width: doc.width,
            height: doc.height,
            text: doc.text,
            fontSize: doc.fontSize,
            createdAt: doc.createdAt,
          }));

        setDrawingState(prev => ({ ...prev, shapes }));
      } catch (error) {
        console.error('Error loading board:', error);
        setBoardState(prev => ({ ...prev, error: 'Failed to load board' }));
      } finally {
        setBoardState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadBoard();
  }, [boardId]);

  // Set up real-time sync for all document types
  useEffect(() => {
    if (!boardId) return;

    let changesFeed: PouchDB.Core.Changes<{}> | null = null;

    const setupChangesFeed = async () => {
      await db.waitForInitialization();
      changesFeed = db.changes({
        since: 'now',
        live: true,
        include_docs: true,
        filter: (doc: any) => doc.boardId === boardId,
      });

      changesFeed.on('change', (change) => {
        const doc = change.doc as BaseDoc;
        
        switch (doc.type) {
          case 'shape':
            const shapeDoc = doc as ShapeDoc;
            if (change.deleted) {
              setDrawingState(prev => ({
                ...prev,
                shapes: prev.shapes.filter(s => s && s.id !== shapeDoc._id.split(':')[1])
              }));
            } else {
              setDrawingState(prev => ({
                ...prev,
                shapes: [
                  ...prev.shapes.filter(s => s && s.id !== shapeDoc._id.split(':')[1]),
                  {
                    id: shapeDoc._id.split(':')[1],
                    tool: shapeDoc.tool,
                    color: shapeDoc.tool === 'eraser' ? '#ffffff' : shapeDoc.color,
                    strokeWidth: shapeDoc.strokeWidth,
                    points: shapeDoc.points,
                    x: shapeDoc.x,
                    y: shapeDoc.y,
                    width: shapeDoc.width,
                    height: shapeDoc.height,
                    text: shapeDoc.text,
                    fontSize: shapeDoc.fontSize,
                    createdAt: new Date(),
                  }
                ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
              }));
            }
            break;

          case 'cursor':
            const cursorDoc = doc as CursorDoc;
            const userId = cursorDoc.userId;
            if (userId !== user?.uid) {
              if (change.deleted) {
                handleCursorCleanup(userId);
              } else {
                setBoardState(prev => ({
                  ...prev,
                  cursors: {
                    ...prev.cursors,
                    [userId]: {
                      userId,
                      displayName: cursorDoc.displayName,
                      x: cursorDoc.x,
                      y: cursorDoc.y,
                      color: cursorDoc.color,
                    },
                  },
                }));
              }
            }
            break;
        }
      });
    };

    setupChangesFeed();

    return () => {
      if (changesFeed) {
        changesFeed.cancel();
      }
    };
  }, [boardId, user?.uid]);

  // Update shape saving
  const handleMouseUp = async () => {
    isDrawing.current = false;
    if (!drawingState.currentShape || !boardId) return;

    const shapeDoc: ShapeDoc = {
      _id: generateSafeId('shape'),
      type: 'shape',
      boardId,
      ...drawingState.currentShape,
    };

    try {
      await db.put(shapeDoc);
      setDrawingState(prev => ({
        ...prev,
        shapes: [...prev.shapes, prev.currentShape!],
        currentShape: null,
      }));
    } catch (error) {
      console.error('Error saving shape:', error);
    }
  };

  const handleMouseDown = async (e: any) => {
    if (drawingState.tool === 'text') {
      const pos = e.target.getStage().getPointerPosition();
      setTextPosition(pos);
      return;
    }

    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    const newShape: Shape = {
      id: generateSafeId('shape'),
      tool: drawingState.tool,
      color: drawingState.color,
      strokeWidth: drawingState.strokeWidth,
      points: [pos.x, pos.y],
      x: pos.x,
      y: pos.y,
      createdAt: new Date(),
    };
    setDrawingState(prev => ({
      ...prev,
      currentShape: newShape,
    }));
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || !drawingState.currentShape) return;

    const pos = e.target.getStage().getPointerPosition();
    
    if (drawingState.tool === 'pen' || drawingState.tool === 'eraser') {
      const newPoints = [...drawingState.currentShape.points, pos.x, pos.y];
      setDrawingState(prev => ({
        ...prev,
        currentShape: {
          ...prev.currentShape!,
          points: newPoints,
        },
      }));
    } else {
      const startX = drawingState.currentShape.x!;
      const startY = drawingState.currentShape.y!;
      setDrawingState(prev => ({
        ...prev,
        currentShape: {
          ...prev.currentShape!,
          width: pos.x - startX,
          height: pos.y - startY,
          points: drawingState.tool === 'line' ? [startX, startY, pos.x, pos.y] : [],
        },
      }));
    }
  };

  const handleTextSubmit = async () => {
    if (!textPosition || !textInput.trim() || !boardId) return;

    const newShape: Shape = {
      id: generateSafeId('shape'),
      tool: 'text' as DrawingTool,
      color: drawingState.color,
      strokeWidth: 1,
      points: [],
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      fontSize: drawingState.fontSize,
      createdAt: drawingState.currentShape?.createdAt || new Date(),
    };

    const shapeDoc: ShapeDoc = {
      _id: newShape.id,
      type: 'shape',
      boardId,
      tool: newShape.tool,
      color: newShape.color,
      strokeWidth: newShape.strokeWidth,
      points: newShape.points,
      x: newShape.x,
      y: newShape.y,
      text: newShape.text,
      fontSize: newShape.fontSize,
      createdAt: newShape.createdAt,
    };

    try {
      await db.put(shapeDoc);
      setDrawingState(prev => ({
        ...prev,
        shapes: [...prev.shapes, newShape],
      }));
      setTextInput('');
      setTextPosition(null);
    } catch (error) {
      console.error('Error saving text:', error);
    }
  };

  const renderShape = (shape: Shape) => {
    if (!shape || !shape.tool) return null;

    const commonProps = {
      stroke: shape.tool === 'eraser' ? '#ffffff' : shape.color,
      strokeWidth: shape.strokeWidth,
      tension: 0.5,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      globalCompositeOperation: shape.tool === 'eraser' ? 'destination-out' as const : 'source-over' as const,
    };

    switch (shape.tool) {
      case 'pen':
      case 'eraser':
      case 'line':
        return <Line key={shape.id} {...commonProps} points={shape.points} />;
      case 'rectangle':
        return (
          <Rect
            key={shape.id}
            {...commonProps}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            fill="transparent"
          />
        );
      case 'circle':
        return (
          <Circle
            key={shape.id}
            {...commonProps}
            x={shape.x! + (shape.width! / 2)}
            y={shape.y! + (shape.height! / 2)}
            radius={Math.max(Math.abs(shape.width!), Math.abs(shape.height!)) / 2}
            fill="transparent"
          />
        );
      case 'text':
        return (
          <Text
            key={shape.id}
            {...commonProps}
            x={shape.x}
            y={shape.y}
            text={shape.text}
            fontSize={shape.fontSize}
            fill={shape.color}
          />
        );
      default:
        return null;
    }
  };

  const handleCursorCleanup = (userId: string) => {
    setBoardState(prev => {
      const { [userId]: removedCursor, ...newCursors } = prev.cursors;
      return {
        ...prev,
        cursors: newCursors as Record<string, BoardCursor>,
      };
    });
  };

  const handleShare = async (email: string) => {
    if (!boardState.board || !email.trim()) return;
    console.log('email', email);

    try {
      console.log('boardState.board', boardState.board);
      // Update board collaborators
      const doc = await db.get(`board:${boardId}`) as BoardDoc;
      const updatedBoard = {
        ...doc,
        collaborators: [...new Set([...doc.collaborators, email.trim()])]
      };
      await db.put(updatedBoard);

      console.log('updatedBoard', updatedBoard);

      try {
        // share with remote db
        await remoteDb.addUserToTenant(tenantVerification!.tenantEmail, email.trim());
      } catch (error) {
        console.error('Error sharing board:', error);
      }

      setBoardState(prev => ({
        ...prev,
        board: {
          ...prev.board!,
          collaborators: updatedBoard.collaborators
        }
      }));
      setShareEmail('');
      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing board:', error);
    }
  };

  const handleDeleteBoard = async () => {
    if (!boardState.board || !user?.email || boardState.board.createdBy !== user.email) return;

    try {
      // Delete the board document
      const boardDoc = await db.get(`board:${boardId}`) as BoardDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;
      await db.remove({ _id: boardDoc._id, _rev: boardDoc._rev });

      // Delete all shapes associated with the board
      const shapesResult = await db.find({
        selector: {
          type: 'shape',
          boardId,
        }
      });
      
      const deletePromises = shapesResult.docs.map(async (doc: any) => {
        await db.remove({ _id: doc._id, _rev: doc._rev });
      });
      
      await Promise.all(deletePromises);

      // Navigate back to the board list
      navigate('/');
    } catch (error) {
      console.error('Error deleting board:', error);
      setBoardState(prev => ({
        ...prev,
        error: 'Failed to delete board'
      }));
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-300 hover:text-white transition-colors"
          >
            ← Back to Boards
          </button>
          {boardState.board && (
            <h1 className="text-2xl font-bold text-white">{boardState.board.name}</h1>
          )}
        </div>
        <div className="flex items-center gap-4">
          {boardState.board && user?.email === boardState.board.createdBy && (
            <button
              onClick={handleDeleteBoard}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
            >
              Delete Board
            </button>
          )}
          <button
            onClick={() => setShowShareModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium"
          >
            Share Board
          </button>
          <div className="text-sm text-gray-300">
            {Object.values(boardState.cursors).map(cursor => (
              <div key={cursor.userId} className="inline-flex items-center ml-2">
                <div
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: cursor.color }}
                />
                {cursor.displayName}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleShare}
        email={shareEmail}
        onEmailChange={setShareEmail}
      />
      
      <div className="flex gap-4 items-center flex-wrap bg-gray-800 p-4 rounded-lg">
        <label className="flex items-center gap-2 text-gray-200">
          Tool:
          <select
            className="border border-gray-700 bg-gray-900 text-white rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={drawingState.tool}
            onChange={(e) => setDrawingState(prev => ({ ...prev, tool: e.target.value as DrawingTool }))}
            title="Drawing tool"
          >
            {TOOLS.map((tool) => (
              <option key={tool.value} value={tool.value}>
                {tool.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-gray-200">
          Color:
          <input
            type="color"
            value={drawingState.color}
            onChange={(e) => setDrawingState(prev => ({ ...prev, color: e.target.value }))}
            className="w-10 h-10 rounded border border-gray-700 bg-gray-900"
            title="Drawing color"
          />
        </label>
        <label className="flex items-center gap-2 text-gray-200">
          {drawingState.tool === 'text' ? 'Font Size:' : 'Stroke Width:'}
          <input
            type="range"
            min="1"
            max={drawingState.tool === 'text' ? '72' : '20'}
            value={drawingState.tool === 'text' ? drawingState.fontSize : drawingState.strokeWidth}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setDrawingState(prev => ({
                ...prev,
                [drawingState.tool === 'text' ? 'fontSize' : 'strokeWidth']: value,
              }));
            }}
            className="w-32"
            title={drawingState.tool === 'text' ? 'Font size' : 'Stroke width'}
          />
        </label>
        {textPosition && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text"
              className="border border-gray-700 bg-gray-900 text-white rounded px-3 py-2 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handleTextSubmit}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium"
            >
              Add Text
            </button>
            <button
              onClick={() => setTextPosition(null)}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900">
        <Stage
          width={800}
          height={600}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onMouseleave={handleMouseUp}
          ref={stageRef}
          className="bg-gray-900"
        >
          <Layer>
            {drawingState.shapes.map(shape => renderShape(shape))}
            {drawingState.currentShape && renderShape(drawingState.currentShape)}
            {Object.values(boardState.cursors).map(cursor => (
              <Group key={cursor.userId}>
                <Circle
                  x={cursor.x}
                  y={cursor.y}
                  radius={5}
                  fill={cursor.color}
                />
                <Text
                  x={cursor.x + 10}
                  y={cursor.y - 10}
                  text={cursor.displayName}
                  fontSize={12}
                  fill={cursor.color}
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}; 