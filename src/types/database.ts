import { User as FirebaseUser } from 'firebase/auth';

declare global {
  namespace PouchDB {
    interface Database {
      find<T extends {} = {}>(request: PouchDB.Find.FindRequest<T>): Promise<PouchDB.Find.FindResponse<T>>;
    }
  }
}

export interface PouchResponse {
  ok: boolean;
  id: string;
  rev: string;
}

export interface PouchDocument {
  _id: string;
  _rev?: string;
  type: string;
  tenantId: string;
  [key: string]: any;
}

export interface DatabaseOperations<T extends object> {
  create: (item: T) => Promise<PouchResponse>;
  read: (id: string) => Promise<T & PouchDocument>;
  update: (id: string, updates: Partial<T>) => Promise<PouchResponse>;
  delete: (id: string) => Promise<PouchResponse>;
  list: (options?: PouchDB.Core.AllDocsOptions) => Promise<(T & PouchDocument)[]>;
  find: (query: PouchDB.Find.FindRequest<T & PouchDocument>) => Promise<PouchDB.Find.FindResponse<T & PouchDocument>>;
  close: () => Promise<void>;
}

export interface DatabaseAuth {
  signup: (username: string, password: string) => Promise<FirebaseUser>;
  login: (username: string, password: string) => Promise<FirebaseUser>;
  loginWithGoogle: () => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  getSession: () => Promise<FirebaseUser>;
}

export interface SyncHandler extends PouchDB.Replication.Sync<{}> {
  on(event: 'change', callback: (change: PouchDB.Replication.SyncResult<{}>) => void): this;
  on(event: 'error', callback: (err: Error) => void): this;
  on(event: string, callback: Function): this;
} 