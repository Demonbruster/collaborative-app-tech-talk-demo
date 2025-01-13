import db from './db';
import { getAuth } from 'firebase/auth';
import { nanoid } from 'nanoid';
import { DatabaseOperations, PouchDocument, PouchResponse } from '../types/database';

export const createDatabaseOperations = <T extends object>(collectionName: string): DatabaseOperations<T> => {
  let tenantId: string | null = null;

  const initializeTenant = async (): Promise<void> => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user?.email) {
      throw new Error('User not authenticated');
    }
    tenantId = user.email.split('@')[0];
  };

  if (!db) {
    throw new Error('Database not initialized');
  }

  return {
    create: async (item: T): Promise<PouchResponse> => {
      try {
        if (!tenantId) await initializeTenant();
        const response = await db.put({
          ...item,
          _id: `${tenantId}:${collectionName}:${nanoid()}`,
          type: collectionName,
          tenantId,
        });
        return response;
      } catch (error) {
        console.error(`Error creating document in ${collectionName}:`, error);
        throw error;
      }
    },
    read: async (id: string): Promise<T & PouchDocument> => {
      try {
        const doc = await db.get(id);
        return doc as T & PouchDocument;
      } catch (error) {
        console.error(`Error reading document ${id} from ${collectionName}:`, error);
        throw error;
      }
    },
    update: async (id: string, updates: Partial<T>): Promise<PouchResponse> => {
      try {
        const doc = await db.get(id);
        const updatedDoc = { ...doc, ...updates };
        const response = await db.put(updatedDoc);
        return response;
      } catch (error) {
        console.error(`Error updating document ${id} in ${collectionName}:`, error);
        throw error;
      }
    },
    delete: async (id: string): Promise<PouchResponse> => {
      try {
        const doc = await db.get(id);
        const response = await db.remove(doc);
        return response;
      } catch (error) {
        console.error(`Error deleting document ${id} from ${collectionName}:`, error);
        throw error;
      }
    },
    list: async (options?: PouchDB.Core.AllDocsOptions): Promise<(T & PouchDocument)[]> => {
      try {
        if (!tenantId) await initializeTenant();
        const result = await db.allDocs({
          include_docs: true,
          startkey: `${tenantId}:${collectionName}:`,
          endkey: `${tenantId}:${collectionName}:\ufff0`,
          ...options,
        });
        return result.rows.map((row) => row.doc as T & PouchDocument);
      } catch (error) {
        console.error(`Error listing documents in ${collectionName}:`, error);
        throw error;
      }
    },
    find: async (query: PouchDB.Find.FindRequest<T & PouchDocument>): Promise<PouchDB.Find.FindResponse<T & PouchDocument>> => {
      try {
        if (!tenantId) await initializeTenant();
        const enhancedQuery = {
          ...query,
          selector: {
            ...query.selector,
            tenantId,
            type: collectionName,
          },
        };
        const result = await db.find(enhancedQuery);
        return result as PouchDB.Find.FindResponse<T & PouchDocument>;
      } catch (error) {
        console.error(`Error finding documents in ${collectionName}:`, error);
        throw error;
      }
    },
    close: async (): Promise<void> => {
      try {
        await db.close();
      } catch (error) {
        console.error('Error closing database:', error);
        throw error;
      }
    },
  };
};