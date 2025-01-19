// remoteDb to check relations between users and tenants

import PouchDB from 'pouchdb';
import PouchFind from 'pouchdb-find';

PouchDB.plugin(PouchFind);

interface UsersDoc {
  _id: string;
  _rev?: string;
  users: string[];
  owner: string;
  createdAt: string;
  updatedAt: string;
}

const REMOTE_DB_NAME = 'collaborative-board-relations-remote';

export class RemoteDbService {
  private getRemoteDb(tenantEmail: string): PouchDB.Database {
    const remoteUrl = import.meta.env.VITE_COUCHDB_URL;
    const username = import.meta.env.VITE_COUCHDB_USER;
    const password = import.meta.env.VITE_COUCHDB_PASSWORD;

    if (!remoteUrl || !username || !password) {
      throw new Error('CouchDB environment variables are not set');
    }

    const tenantId = tenantEmail.split('@')[0];
    const remoteDbUrl = `${remoteUrl}/${tenantId}-collaborative-board`;
    
    return new PouchDB(remoteDbUrl, {
      auth: { username, password }
    });
  }

  async verifyTenantAccess(tenantEmail: string, userEmail: string): Promise<boolean> {
    try {
      const remoteDb = this.getRemoteDb(REMOTE_DB_NAME);
      
      try {
        const usersDoc = await remoteDb.get(tenantEmail) as UsersDoc;
        console.log('[RemoteDbService] Found users document:', { tenantEmail, userCount: usersDoc.users.length });
        return usersDoc.users.includes(userEmail);
      } catch (error: any) {
        if (error.status === 404) {
          console.log('[RemoteDbService] Users document not found, creating new tenant:', { tenantEmail });
          await this.createTenant(tenantEmail);
          return userEmail === tenantEmail;
        }
        console.error('[RemoteDbService] Error getting users document:', {
          tenantEmail,
          error: error.message,
          status: error.status
        });
        throw error;
      }
    } catch (error: any) {
      console.error('[RemoteDbService] Failed to verify tenant access:', {
        tenantEmail,
        userEmail,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private async ensureRemoteDbExists(tenantEmail: string): Promise<void> {
    const remoteDb = this.getRemoteDb(REMOTE_DB_NAME);
    try {
      await remoteDb.info();
      console.log('[RemoteDbService] Remote database exists:', { tenantEmail });
    } catch (error: any) {
      if (error.status === 404) {
        console.log('[RemoteDbService] Creating new remote database:', { tenantEmail });
        await remoteDb.put({
          _id: '_design/users',
          views: {
            by_email: {
              map: function(doc: any) {
                /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
                const emit = function(key: any, value: any) {};
                if (doc.users) {
                  emit(doc._id, doc.users);
                }
              }.toString()
            }
          }
        });
      } else {
        console.error('[RemoteDbService] Failed to check database existence:', {
          tenantEmail,
          error: error.message,
          status: error.status
        });
        throw error;
      }
    }
  }

  async createTenant(tenantEmail: string): Promise<boolean> {
    try {
      const remoteDb = this.getRemoteDb(REMOTE_DB_NAME);
      
      console.log('[RemoteDbService] Ensuring remote database exists:', { tenantEmail });
      await this.ensureRemoteDbExists(tenantEmail);
      
      try {
        await remoteDb.get(tenantEmail);
        console.log('[RemoteDbService] Tenant already exists:', { tenantEmail });
        return false;
      } catch (error: any) {
        if (error.status !== 404) {
          console.error('[RemoteDbService] Unexpected error checking tenant existence:', {
            tenantEmail,
            error: error.message,
            status: error.status
          });
          throw error;
        }
      }

      console.log('[RemoteDbService] Creating new tenant:', { tenantEmail });
      await remoteDb.put({
        _id: tenantEmail,
        users: [tenantEmail],
        owner: tenantEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error: any) {
      console.error('[RemoteDbService] Failed to create tenant:', {
        tenantEmail,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async addUserToTenant(tenantEmail: string, userEmail: string): Promise<boolean> {
    try {
      console.log('[RemoteDbService] Adding user to tenant:', { tenantEmail, userEmail });
      const remoteDb = this.getRemoteDb(REMOTE_DB_NAME);

      await this.ensureRemoteDbExists(tenantEmail);

      const usersDoc = await remoteDb.get(tenantEmail) as UsersDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;
      
      if (!usersDoc.users.includes(userEmail)) {
        console.log('[RemoteDbService] Adding new user to tenant:', { tenantEmail, userEmail });
        usersDoc.users.push(userEmail);
        usersDoc.updatedAt = new Date().toISOString();
        await remoteDb.put(usersDoc);
      } else {
        console.log('[RemoteDbService] User already exists in tenant:', { tenantEmail, userEmail });
      }
      
      return true;
    } catch (error: any) {
      console.error('[RemoteDbService] Failed to add user to tenant:', {
        tenantEmail,
        userEmail,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

const remoteDb = new RemoteDbService();
export default remoteDb;
