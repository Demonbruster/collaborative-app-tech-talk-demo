import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { getTenantId, COUCH_DB_URL } from '../utils/constants';
import { DatabaseAuth, SyncHandler } from '../types/database';
import { auth as firebaseAuth } from '../config/firebase';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User as FirebaseUser,
  User
} from 'firebase/auth';

// Create PouchDB class with plugins
const PouchWithPlugins = PouchDB.plugin(PouchDBFind);

const tenantId = getTenantId();
const DB_NAME = tenantId || 'default';

// Initialize databases
export const localDB = new PouchWithPlugins(DB_NAME);
export const remoteDB = new PouchWithPlugins(`${COUCH_DB_URL}${DB_NAME}`);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Authentication methods using Firebase
export const auth: DatabaseAuth = {
  signup: async (email: string, password: string): Promise<User> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const { user } = userCredential;
      return handleAuthSuccess(user);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },

    login: async (email: string, password: string): Promise<User> => {
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const { user } = userCredential;
      return handleAuthSuccess(user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  loginWithGoogle: async (): Promise<User> => {
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const { user } = result;
      return handleAuthSuccess(user);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await signOut(firebaseAuth);
      localStorage.removeItem('session');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  getSession: async (): Promise<User> => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        throw new Error('No user session found');
      }
      return user;
    } catch (error) {
      console.error('Get session error:', error);
      throw error;
    }
  }
};

// Helper function to handle successful authentication
const handleAuthSuccess = (user: FirebaseUser): User => {
  const sessionData = {
    userCtx: {
      name: user.email,
      roles: ['user']
    }
  };
  localStorage.setItem('session', JSON.stringify(sessionData));
  
  return user;
};

// Replicate DB with authentication
export const setupSync = (): SyncHandler => {
  const sync = localDB
    .sync(remoteDB, {
      live: true,
      retry: true,
    }) as unknown as SyncHandler;

  sync
    .on('change', (info: PouchDB.Replication.SyncResult<{}>) => {
      console.log('Change detected:', info);
    })
    .on('paused', (err: Error) => {
      console.log('Replication paused:', err);
    })
    .on('active', () => {
      console.log('Replication resumed');
    })
    .on('denied', (err: Error) => {
      console.log('Replication denied:', err);
    })
    .on('complete', (info: PouchDB.Replication.SyncResultComplete<{}>) => {
      console.log('Replication complete:', info);
    })
    .on('error', (err: Error) => {
      console.error('Replication error:', err);
    });

  sync.catch((err) => {
    console.error('Replication catch error:', err);
    sync.cancel();
  });

  return sync;
};

// Ensure db is closed when app shuts down or window unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    localDB.close();
    remoteDB.close();
  });
} else if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    localDB.close();
    remoteDB.close();
  });
}

export default localDB;