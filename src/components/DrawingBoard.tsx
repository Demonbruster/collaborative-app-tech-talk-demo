import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import { nanoid } from 'nanoid';
import PouchDB from 'pouchdb';
import { Shape, DrawingBoardState, DrawingTool } from '../types/drawing';

interface DrawingDoc extends Omit<Shape, 'id'> {
  _id: string;
  _rev?: string;
}

const db = new PouchDB('drawings');

// Generate a safe ID for PouchDB (no underscore prefix)
const generateSafeId = () => {
  const id = nanoid();
  return id.startsWith('_') ? `n${id}` : id;
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
  const [drawingState, setDrawingState] = useState<DrawingBoardState>({
    shapes: [],
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

  useEffect(() => {
    const loadDrawings = async () => {
      try {
        const result = await db.allDocs({ include_docs: true });
        const shapes = result.rows
          .filter(row => row.doc)
          .map(row => {
            const doc = row.doc as DrawingDoc;
            return {
              id: doc._id,
              ...doc,
            } as Shape;
          });
        setDrawingState(prev => ({ ...prev, shapes }));
      } catch (error) {
        console.error('Error loading drawings:', error);
      }
    };

    loadDrawings();
  }, []);

  const handleMouseDown = (e: any) => {
    if (drawingState.tool === 'text') {
      const pos = e.target.getStage().getPointerPosition();
      setTextPosition(pos);
      return;
    }

    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    const newShape: Shape = {
      id: generateSafeId(),
      tool: drawingState.tool,
      color: drawingState.color,
      strokeWidth: drawingState.strokeWidth,
      points: [pos.x, pos.y],
      x: pos.x,
      y: pos.y,
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

  const handleMouseUp = async () => {
    isDrawing.current = false;
    if (!drawingState.currentShape) return;

    try {
      await db.put({
        _id: drawingState.currentShape.id,
        ...drawingState.currentShape,
      });

      setDrawingState(prev => ({
        ...prev,
        shapes: [...prev.shapes, prev.currentShape!],
        currentShape: null,
      }));
    } catch (error) {
      console.error('Error saving drawing:', error);
    }
  };

  const handleTextSubmit = async () => {
    if (!textPosition || !textInput.trim()) return;

    const newShape: Shape = {
      id: generateSafeId(),
      tool: 'text',
      color: drawingState.color,
      strokeWidth: 1,
      points: [],
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      fontSize: drawingState.fontSize,
    };

    try {
      await db.put({
        _id: newShape.id,
        ...newShape,
      });

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
    const commonProps = {
      stroke: shape.tool === 'eraser' ? '#ffffff' : shape.color,
      strokeWidth: shape.strokeWidth,
      tension: 0.5,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      globalCompositeOperation: 
        shape.tool === 'eraser' 
          ? 'destination-out' as const
          : 'source-over' as const,
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

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-4 items-center flex-wrap">
        <label className="flex items-center gap-2">
          Tool:
          <select
            className="border rounded px-2 py-1"
            value={drawingState.tool}
            onChange={(e) => setDrawingState(prev => ({ ...prev, tool: e.target.value as DrawingTool }))}
            title="Drawing tool"
          >
            {TOOLS.map(tool => (
              <option key={tool.value} value={tool.value}>
                {tool.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Color:
          <input
            type="color"
            value={drawingState.color}
            onChange={(e) => setDrawingState(prev => ({ ...prev, color: e.target.value }))}
            className="w-8 h-8"
            title="Drawing color"
          />
        </label>
        <label className="flex items-center gap-2">
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
              className="border rounded px-2 py-1"
            />
            <button
              onClick={handleTextSubmit}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Add Text
            </button>
            <button
              onClick={() => setTextPosition(null)}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Stage
          width={800}
          height={600}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onMouseleave={handleMouseUp}
          ref={stageRef}
          className="bg-white"
        >
          <Layer>
            {drawingState.shapes.map(renderShape)}
            {drawingState.currentShape && renderShape(drawingState.currentShape)}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}; 