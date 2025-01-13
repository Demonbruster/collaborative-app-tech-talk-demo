import { Shape } from './drawing';

export interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  collaborators: string[];
  isPublic: boolean;
}

export interface BoardCursor {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
}

export interface BoardState {
  board: Board | null;
  shapes: Shape[];
  cursors: { [key: string]: BoardCursor };
  isLoading: boolean;
  error: string | null;
} 