import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { auth } from '../config/firebase';
import { AuthContextType, TenantVerification } from '../types/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { DatabaseService } from '../services/db';

const AuthContext = createContext<AuthContextType | null>(null);
const db = new DatabaseService();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantVerification, setTenantVerification] = useState<TenantVerification | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // Check if user has verified tenant
        const tenantEmail = localStorage.getItem(`tenant_${user.uid}`);
        if (tenantEmail) {
          try {
            const verified = await verifyTenant(tenantEmail, user.email!);
            if (!verified) {
              navigate('/verify-tenant');
            } else if (location.pathname === '/login' || location.pathname === '/verify-tenant') {
              navigate('/');
            }
          } catch (error) {
            navigate('/verify-tenant');
          }
        } else {
          navigate('/verify-tenant');
        }
      } else if (location.pathname !== '/login') {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, []);

  const createTenant = async (tenantEmail: string): Promise<boolean> => {
    try {
      if (!user) throw new Error('No user logged in');

      // Check if tenant already exists
      const remoteDb = await db.getRemoteDb(tenantEmail);
      try {
        const usersDoc = await remoteDb.get('users');
        setTenantVerification({
          tenantEmail,
          isVerified: false,
          error: 'Tenant already exists. Please use a different email or verify existing tenant.'
        });
        return false;
      } catch (error: any) {
        // If 404, tenant doesn't exist, we can create it
        if (error.status !== 404) {
          throw error;
        }
      }

      // Create new tenant database
      await db.syncWithRemote(tenantEmail);
      
      // Create users document with current user as the owner
      await remoteDb.put({
        _id: 'users',
        users: [user.uid],
        owner: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Store tenant email for future reference
      localStorage.setItem(`tenant_${user.uid}`, tenantEmail);
      setTenantVerification({
        tenantEmail,
        isVerified: true
      });

      return true;
    } catch (error) {
      setTenantVerification({
        tenantEmail,
        isVerified: false,
        error: (error as Error).message
      });
      return false;
    }
  };

  const verifyTenant = async (tenantEmail: string, userEmail: string): Promise<boolean> => {
    try {
      if (!user) throw new Error('No user logged in');

      // Check if tenant exists in remote database
      const remoteDb = await db.getRemoteDb(tenantEmail);
      const usersDoc = await remoteDb.get('users').catch(() => null);

      console.log(usersDoc);
      
      if (!usersDoc) {
        setTenantVerification({
          tenantEmail,
          isVerified: false,
          error: 'Tenant not found. Please create a new tenant.'
        });
        return false;
      }

      const users = (usersDoc as any).users || [];
      const userExists = users.includes(userEmail);

      console.log({userExists, users, userEmail});

      if (!userExists) {
        setTenantVerification({
          tenantEmail,
          isVerified: false,
          error: 'User not authorized for this tenant.'
        });
        return false;
      }

      // Store tenant email for future reference
      localStorage.setItem(`tenant_${user.uid}`, tenantEmail);
      setTenantVerification({
        tenantEmail,
        isVerified: true
      });

      // Sync databases
      await db.syncWithRemote(tenantEmail);
      return true;
    } catch (error) {
      console.log("Error verifying tenant", error);
      setTenantVerification({
        tenantEmail,
        isVerified: false,
        error: (error as Error).message
      });
      return false;
    }
  };

  const loginWithGoogle = async (): Promise<User> => {
    try {
      const response = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!response.user) {
        throw new Error('Invalid response from server');
      }

      // if the user's path is /login, redirect to /
      if (location.pathname === '/login') {
        navigate('/');
      }

      return response.user;
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    }
  };

  const login = async (username: string, password: string): Promise<User> => {
    try {
      const response = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!response.user) {
        throw new Error('Invalid response from server');
      }
      setUser(response.user);
      return response.user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (username: string, password: string): Promise<User> => {
    try {
      const response = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!response.user) {
        throw new Error('Invalid response from server');
      }
      setUser(response.user);
      return response.user;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    tenantVerification,
    login,
    register,
    loginWithGoogle,
    logout,
    verifyTenant,
    createTenant
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthenticationGuard = ({ children }: { children: ReactNode }) => {
  const { loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
};