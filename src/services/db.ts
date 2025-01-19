import PouchDB from 'pouchdb';
import PouchFind from 'pouchdb-find';


PouchDB.plugin(PouchFind);

export class DatabaseService {
  private db: PouchDB.Database;
  private syncHandler: PouchDB.Replication.Sync<{}> | null = null;
  private tenantId: string | null = null;
  private initPromise: Promise<void>;
  private isInitialized: boolean = false;
  private activeChangesFeeds: Set<PouchDB.Core.Changes<{}>> = new Set();
  private static instance: DatabaseService | null = null;

  private constructor() {
    this.db = new PouchDB('temp-db');
    this.initPromise = Promise.resolve();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(tenantEmail: string) {
    try {
      if (this.syncHandler) {
        this.syncHandler.cancel();
      }

      if (this.db) {
        await this.db.close();
      }

      const dbName = `${tenantEmail.split('@')[0]}-collaborative-board`;
      console.log('[DatabaseService] Initializing database:', { dbName, tenantEmail });
      this.db = new PouchDB(dbName);
      
      // Start sync with remote immediately
      await this.syncWithRemote(tenantEmail);
      
      this.isInitialized = true;
      console.log('[DatabaseService] Database initialized successfully');
    } catch (error) {
      console.error('[DatabaseService] Initialization failed:', error);
      throw error;
    }
  }

  async getRemoteDb(tenantEmail: string): Promise<PouchDB.Database> {
    const remoteUrl = import.meta.env.VITE_COUCHDB_URL;
    const username = import.meta.env.VITE_COUCHDB_USER;
    const password = import.meta.env.VITE_COUCHDB_PASSWORD;

    if (!remoteUrl || !username || !password) {
      console.error('[DatabaseService] Missing CouchDB configuration');
      throw new Error('CouchDB environment variables are not set');
    }

    const tenantId = tenantEmail.split('@')[0];
    const remoteDbUrl = `${remoteUrl}/${tenantId}-collaborative-board`;
    console.log('[DatabaseService] Connecting to remote database:', { remoteDbUrl, tenantId });
    
    return new PouchDB(remoteDbUrl, {
      auth: { username, password }
    });
  }

  async syncWithRemote(tenantEmail: string): Promise<void> {
    try {
      console.log('[DatabaseService] Starting sync with remote:', { tenantEmail });
      
      if (this.syncHandler) {
        console.log('[DatabaseService] Cancelling existing sync');
        this.syncHandler.cancel();
      }

      const remoteDb = await this.getRemoteDb(tenantEmail);
      const tenantId = tenantEmail.split('@')[0];
      
      if (this.db) {
        console.log('[DatabaseService] Closing existing local database');
        await this.db.close();
      }

      const localDbName = `${tenantId}-collaborative-board`;
      console.log('[DatabaseService] Creating new local database:', { localDbName });
      this.db = new PouchDB(localDbName);

      console.log('[DatabaseService] Starting live sync');
      this.syncHandler = this.db.sync(remoteDb, {
        live: true,
        retry: true
      })
      .on('change', (info) => {
        console.log('[DatabaseService] Sync change:', { 
          direction: info.direction,
          docs: info.change?.docs?.length
        });
      })
      .on('paused', () => {
        console.log('[DatabaseService] Sync paused');
      })
      .on('active', () => {
        console.log('[DatabaseService] Sync active');
      })
      .on('error', (err: any) => {
        console.error('[DatabaseService] Sync error:', {
          error: err.message,
          stack: err.stack
        });
      });

      this.tenantId = tenantId;
      console.log('[DatabaseService] Sync setup complete:', { tenantId });
    } catch (error: any) {
      console.error('[DatabaseService] Failed to sync with remote:', {
        tenantEmail,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      console.log('[DatabaseService] Waiting for database initialization');
      await this.initPromise;
      if (!this.isInitialized) {
        console.error('[DatabaseService] Database initialization failed');
        throw new Error('Database not initialized: No user logged in');
      }
    }
  }

  // Proxy PouchDB methods with tenant awareness and logging
  async get(id: string) {
    await this.ensureInitialized();
    try {
      const result = await this.db.get(id);
      console.log('[DatabaseService] Document retrieved:', { id });
      return result;
    } catch (error: any) {
      console.error('[DatabaseService] Failed to get document:', {
        id,
        error: error.message,
        status: error.status
      });
      throw error;
    }
  }

  async put(doc: any) {
    await this.ensureInitialized();
    try {
      const result = await this.db.put(doc);
      console.log('[DatabaseService] Document saved:', { id: doc._id, rev: result.rev });
      return result;
    } catch (error: any) {
      console.error('[DatabaseService] Failed to save document:', {
        id: doc._id,
        error: error.message,
        status: error.status
      });
      throw error;
    }
  }

  async find(options: PouchDB.Find.FindRequest<any>) {
    await this.ensureInitialized();
    try {
      const result = await this.db.find(options);
      console.log('[DatabaseService] Find query executed:', { 
        selector: options.selector,
        docs: result.docs.length 
      });
      return result;
    } catch (error: any) {
      console.error('[DatabaseService] Find query failed:', {
        selector: options.selector,
        error: error.message
      });
      throw error;
    }
  }

  async allDocs(options?: PouchDB.Core.AllDocsWithKeyOptions | PouchDB.Core.AllDocsWithKeysOptions | PouchDB.Core.AllDocsWithinRangeOptions | PouchDB.Core.AllDocsOptions) {
    await this.ensureInitialized();
    return this.db.allDocs(options);
  }

  async remove(doc: PouchDB.Core.RemoveDocument) {
    await this.ensureInitialized();
    return this.db.remove(doc);
  }

  changes(options?: PouchDB.Core.ChangesOptions) {
    console.log('[DatabaseService] Starting changes feed:', { options });
    const feed = this.db.changes(options);
    this.activeChangesFeeds.add(feed);
    
    feed.on('complete', () => {
      console.log('[DatabaseService] Changes feed completed');
      this.activeChangesFeeds.delete(feed);
    });

    feed.on('error', (error) => {
      console.error('[DatabaseService] Changes feed error:', {
        error: error.message
      });
      this.activeChangesFeeds.delete(feed);
    });
    
    return feed;
  }

  // Get current tenant ID
  getTenantId() {
    return this.tenantId;
  }

  // Check if database is initialized
  isReady() {
    return this.isInitialized;
  }

  // Wait for initialization
  async waitForInitialization() {
    await this.initPromise;
    return this.isInitialized;
  }

  async close() {
    console.log('[DatabaseService] Closing database connection');
    try {
      const feedCount = this.activeChangesFeeds.size;
      for (const feed of this.activeChangesFeeds) {
        feed.cancel();
      }
      this.activeChangesFeeds.clear();
      console.log('[DatabaseService] Cancelled active changes feeds:', { count: feedCount });

      if (this.syncHandler) {
        this.syncHandler.cancel();
        console.log('[DatabaseService] Cancelled sync handler');
      }
      
      await this.db.close();
      console.log('[DatabaseService] Database closed successfully');
      return;
    } catch (error: any) {
      console.error('[DatabaseService] Error closing database:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Export a singleton instance
const db = DatabaseService.getInstance();
export default db;