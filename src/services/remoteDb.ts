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
      const usersDoc = await remoteDb.get(tenantEmail) as UsersDoc;
      console.log('usersDoc', usersDoc);
      
      return usersDoc.users.includes(userEmail);
    } catch (error: any) {
      if (error.status === 404) {
        return false; // Tenant database or users document doesn't exist
      }
      throw error;
    }
  }

  async createTenant(tenantEmail: string): Promise<boolean> {
    try {
      const remoteDb = this.getRemoteDb(REMOTE_DB_NAME);
      
      // Check if tenant already exists
      try {
        await remoteDb.get('users');
        return false; // Tenant already exists
      } catch (error: any) {
        if (error.status !== 404) {
          throw error;
        }
      }

      // Create users document with owner
      await remoteDb.put({
        _id: tenantEmail,
        users: [tenantEmail],
        owner: tenantEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async addUserToTenant(tenantEmail: string, userEmail: string): Promise<boolean> {
    try {
      const remoteDb = this.getRemoteDb(REMOTE_DB_NAME);
      const usersDoc = await remoteDb.get(tenantEmail) as UsersDoc & PouchDB.Core.IdMeta & PouchDB.Core.GetMeta;
      
      if (!usersDoc.users.includes(userEmail)) {
        usersDoc.users.push(userEmail);
        usersDoc.updatedAt = new Date().toISOString();
        await remoteDb.put(usersDoc);
      }
      
      return true;
    } catch (error) {
      console.error('Error adding user to tenant:', error);
      throw error;
    }
  }
}

const remoteDb = new RemoteDbService();
export default remoteDb;
