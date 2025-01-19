import PouchDB from 'pouchdb';
import PouchFind from 'pouchdb-find';
import { auth } from '../config/firebase';
import { EventEmitter } from 'events';

PouchDB.plugin(PouchFind);

export class DatabaseService {
  private db: PouchDB.Database;
  private syncHandler: PouchDB.Replication.Sync<{}> | null = null;
  private tenantId: string | null = null;
  private initPromise: Promise<void>;
  private isInitialized: boolean = false;
  private activeChangesFeeds: Set<PouchDB.Core.Changes<{}>> = new Set();

  constructor(tenantEmail: string) {
    this.db = new PouchDB(`${tenantEmail.split('@')[0]}-collaborative-board`);
    this.initPromise = this.initializeDb(tenantEmail);
  }

  async getRemoteDb(tenantEmail: string): Promise<PouchDB.Database> {
    const remoteUrl = import.meta.env.VITE_COUCHDB_URL;
    const username = import.meta.env.VITE_COUCHDB_USER;
    const password = import.meta.env.VITE_COUCHDB_PASSWORD;

    if (!remoteUrl || !username || !password) {
      throw new Error('CouchDB environment variables are not set');
    }

    const tenantId = tenantEmail.split('@')[0];
    const remoteDbUrl = `${remoteUrl}/${tenantId}-collaborative-board`;
    return new PouchDB(remoteDbUrl, {
      auth: {
        username,
        password
      }
    });
  }

  async syncWithRemote(tenantEmail: string): Promise<void> {
    if (this.syncHandler) {
      this.syncHandler.cancel();
    }

    const remoteDb = await this.getRemoteDb(tenantEmail);
    const tenantId = tenantEmail.split('@')[0];
    
    // Close and destroy existing local db
    if (this.db) {
      await this.db.close();
    }

    // Create new local db with tenant prefix
    const localDbName = `${tenantId}-collaborative-board`;
    this.db = new PouchDB(localDbName);

    // Start sync
    this.syncHandler = this.db.sync(remoteDb, {
      live: true,
      retry: true
    });

    this.tenantId = tenantId;
  }

  private async initializeDb(tenantEmail: string) {
    return new Promise<void>((resolve) => {
      // init db
      this.db = new PouchDB(`${tenantEmail.split('@')[0]}-collaborative-board`);
      this.isInitialized = true;
      resolve();
    });
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initPromise;
      if (!this.isInitialized) {
        throw new Error('Database not initialized: No user logged in');
      }
    }
  }

  // Proxy PouchDB methods with tenant awareness
  async get(id: string) {
    await this.ensureInitialized();
    return this.db.get(id);
  }

  async put(doc: any) {
    await this.ensureInitialized();
    return this.db.put(doc);
  }

  async find(options: PouchDB.Find.FindRequest<any>) {
    await this.ensureInitialized();
    return this.db.find(options);
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
    const feed = this.db.changes(options);
    this.activeChangesFeeds.add(feed);
    
    // Automatically remove from set when feed ends
    feed.on('complete', () => {
      this.activeChangesFeeds.delete(feed);
    });

    feed.on('error', () => {
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
    // Cancel all active changes feeds
    for (const feed of this.activeChangesFeeds) {
      feed.cancel();
    }
    this.activeChangesFeeds.clear();

    if (this.syncHandler) {
      this.syncHandler.cancel();
    }
    return this.db.close();
  }
}

const db = new DatabaseService('test@test.com');
export default db;