import { Shape } from './drawing';

export interface Board {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  collaborators: string[];
  isPublic: boolean;
  lastModified?: number;
  lastModifiedBy?: string;
  type: 'board';
  accessType: 'owned' | 'shared' | 'public';
}

export interface BoardDoc extends Board {
  _id: string;
  _rev?: string;
  tenantId: string;
}

export interface BoardState {
  boards: {
    owned: Board[];
    shared: Board[];
    public: Board[];
  };
  isLoading: boolean;
  error: string | null;
}

export interface BoardCursor {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
}

export interface DrawingBoardState {
  board: Board | null;
  shapes: Shape[];
  cursors: Record<string, BoardCursor>;
  isLoading: boolean;
  error: string | null;
} 