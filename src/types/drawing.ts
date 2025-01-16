export interface Point {
  x: number;
  y: number;
}

export type DrawingTool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text';

export interface Shape {
  id: string;
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

export interface DrawingBoardState {
  shapes: Shape[];
  currentShape: Shape | null;
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  fontSize: number;
} 