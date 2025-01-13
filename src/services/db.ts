import PouchDB from 'pouchdb';
import PouchFind from 'pouchdb-find';
import { auth } from '../config/firebase';

PouchDB.plugin(PouchFind);

class DatabaseService {
  private db: PouchDB.Database;
  private remoteDb: PouchDB.Database | null = null;
  private syncHandler: PouchDB.Replication.Sync<{}> | null = null;
  private tenantId: string | null = null;
  private initPromise: Promise<void>;
  private isInitialized: boolean = false;

  constructor() {
    this.db = new PouchDB('collaborative-board');
    this.initPromise = this.initializeDb();
  }

  private async initializeDb() {
    return new Promise<void>((resolve) => {
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          const tenantId = user.email?.split('@')[0] || 'default';
          if (tenantId !== this.tenantId) {
            if (this.syncHandler) {
              this.syncHandler.cancel();
            }
            if (this.db) {
              await this.db.close();
            }
            
            const localDbName = `${tenantId}-collaborative-board`;
            const remoteUrl = import.meta.env.VITE_COUCHDB_URL;
            const username = import.meta.env.VITE_COUCHDB_USER;
            const password = import.meta.env.VITE_COUCHDB_PASSWORD;
            
            if (!remoteUrl || !username || !password) {
              console.warn('CouchDB environment variables are not set (VITE_COUCHDB_URL, VITE_COUCHDB_USER, VITE_COUCHDB_PASSWORD). Remote sync will not work.');
              this.remoteDb = null;
            } else {
              const remoteDbUrl = `${remoteUrl}/${tenantId}-collaborative-board`;
              console.log('Connecting to remote DB:', remoteDbUrl);
              this.remoteDb = new PouchDB(remoteDbUrl, {
                auth: {
                  username,
                  password
                }
              });

              // Create remote database if it doesn't exist
              try {
                await this.remoteDb.info();
              } catch (error: any) {
                if (error.status === 404) {
                  console.log('Creating remote database...');
                  await new PouchDB(remoteDbUrl, {
                    auth: { username, password },
                    skip_setup: false
                  });
                } else {
                  console.error('Error checking remote database:', error);
                }
              }
            }

            console.log('Connecting to local DB:', localDbName);
            this.db = new PouchDB(localDbName);
            this.tenantId = tenantId;

            // Set up sync only if remote DB is available
            if (this.remoteDb) {
              this.syncHandler = this.db.sync(this.remoteDb, {
                live: true,
                retry: true
              }).on('error', function (err) {
                console.error('Sync error:', err);
              }).on('change', function (change) {
                console.log('Change:', change);
              });
            }

            try {
              await this.db.createIndex({
                index: {
                  fields: ['type', 'boardId']
                }
              });
            } catch (error) {
              console.error('Error creating index:', error);
            }
          }
          this.isInitialized = true;
          resolve();
        } else {
          if (this.syncHandler) {
            this.syncHandler.cancel();
          }
          if (this.db) {
            await this.db.close();
          }
          this.db = new PouchDB('collaborative-board');
          this.remoteDb = null;
          this.syncHandler = null;
          this.tenantId = null;
          this.isInitialized = false;
          resolve();
        }
      });
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
    // No need to await initialization for changes feed
    return this.db.changes(options);
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
    if (this.syncHandler) {
      this.syncHandler.cancel();
    }
    return this.db.close();
  }
}

const db = new DatabaseService();
export default db;