# API Documentation

## Authentication

### Firebase Authentication

#### Initialize Authentication
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

#### Sign In Methods

```typescript
// Email/Password Sign In
const signInWithEmail = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// Google Sign In
const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

// Sign Out
const signOut = async () => {
  return auth.signOut();
};
```

## Database Operations

### Board Operations

#### Create Board
```typescript
interface CreateBoardParams {
  name: string;
  isPublic?: boolean;
}

const createBoard = async ({ name, isPublic = false }: CreateBoardParams) => {
  const boardId = nanoid();
  const timestamp = Date.now();
  
  await db.put({
    _id: `board:${boardId}`,
    type: 'board',
    name,
    createdBy: auth.currentUser?.email,
    createdAt: timestamp,
    lastModified: timestamp,
    lastModifiedBy: auth.currentUser?.email,
    collaborators: [],
    isPublic
  });
  
  return boardId;
};
```

#### Get Board
```typescript
const getBoard = async (boardId: string) => {
  try {
    return await db.get(`board:${boardId}`);
  } catch (error) {
    if (error.status === 404) {
      throw new Error('Board not found');
    }
    throw error;
  }
};
```

#### Update Board
```typescript
interface UpdateBoardParams {
  boardId: string;
  name?: string;
  isPublic?: boolean;
  collaborators?: string[];
}

const updateBoard = async ({ boardId, ...updates }: UpdateBoardParams) => {
  const board = await db.get(`board:${boardId}`);
  
  const updatedBoard = {
    ...board,
    ...updates,
    lastModified: Date.now(),
    lastModifiedBy: auth.currentUser?.email
  };
  
  return db.put(updatedBoard);
};
```

### Shape Operations

#### Add Shape
```typescript
interface AddShapeParams {
  boardId: string;
  shapeType: 'pen' | 'rectangle' | 'circle' | 'line';
  points: Point[];
  style: ShapeStyle;
}

const addShape = async ({ boardId, shapeType, points, style }: AddShapeParams) => {
  const shapeId = nanoid();
  
  await db.put({
    _id: `shape:${shapeId}`,
    type: 'shape',
    boardId,
    shapeType,
    points,
    style,
    createdBy: auth.currentUser?.email,
    createdAt: Date.now()
  });
  
  return shapeId;
};
```

#### Update Shape
```typescript
interface UpdateShapeParams {
  shapeId: string;
  points?: Point[];
  style?: Partial<ShapeStyle>;
}

const updateShape = async ({ shapeId, points, style }: UpdateShapeParams) => {
  const shape = await db.get(`shape:${shapeId}`);
  
  const updatedShape = {
    ...shape,
    ...(points && { points }),
    ...(style && { style: { ...shape.style, ...style } })
  };
  
  return db.put(updatedShape);
};
```

## Real-Time Sync

### Setup Sync
```typescript
const setupSync = (boardId: string, onUpdate: (doc: any) => void) => {
  const changes = db.changes({
    since: 'now',
    live: true,
    include_docs: true,
    selector: {
      $or: [
        { _id: `board:${boardId}` },
        { type: 'shape', boardId }
      ]
    }
  });
  
  changes.on('change', (change) => {
    onUpdate(change.doc);
  });
  
  return () => changes.cancel();
};
```

### Cursor Tracking
```typescript
interface CursorPosition {
  x: number;
  y: number;
  userId: string;
  boardId: string;
}

const updateCursorPosition = (position: CursorPosition) => {
  socket.emit('cursor-move', position);
};

const subscribeToCursors = (boardId: string, onCursorMove: (position: CursorPosition) => void) => {
  socket.on('cursor-move', onCursorMove);
  socket.emit('join-board', boardId);
  
  return () => {
    socket.off('cursor-move', onCursorMove);
    socket.emit('leave-board', boardId);
  };
};
```

## Error Handling

### Custom Error Types
```typescript
class BoardAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardAccessError';
  }
}

class ShapeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShapeValidationError';
  }
}
```

### Error Handlers
```typescript
const handleDatabaseError = (error: any) => {
  if (error.status === 401) {
    throw new BoardAccessError('Unauthorized access');
  }
  if (error.status === 404) {
    throw new Error('Resource not found');
  }
  throw error;
};

const handleShapeValidation = (shape: Shape) => {
  if (!shape.points || shape.points.length === 0) {
    throw new ShapeValidationError('Shape must have at least one point');
  }
  // Add more validation as needed
};
```

## WebSocket Events

### Available Events

| Event | Description | Payload |
|-------|-------------|---------|
| `join-board` | Join a board's real-time session | `{ boardId: string }` |
| `leave-board` | Leave a board's session | `{ boardId: string }` |
| `cursor-move` | Update cursor position | `CursorPosition` |
| `shape-add` | New shape added | `Shape` |
| `shape-update` | Shape modified | `Shape` |
| `shape-delete` | Shape deleted | `{ shapeId: string }` |

### Event Handlers
```typescript
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket server');
});
```

## Type Definitions

### Board Types
```typescript
interface Board {
  _id: string;
  type: 'board';
  name: string;
  createdBy: string;
  createdAt: number;
  lastModified: number;
  lastModifiedBy: string;
  collaborators: string[];
  isPublic: boolean;
}

interface BoardMetadata {
  id: string;
  name: string;
  createdBy: string;
  accessType: 'owned' | 'shared' | 'public' | 'private';
}
```

### Shape Types
```typescript
interface Point {
  x: number;
  y: number;
}

interface ShapeStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  opacity?: number;
}

interface Shape {
  _id: string;
  type: 'shape';
  boardId: string;
  shapeType: 'pen' | 'rectangle' | 'circle' | 'line';
  points: Point[];
  style: ShapeStyle;
  createdBy: string;
  createdAt: number;
}
``` 