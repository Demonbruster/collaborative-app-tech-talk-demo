import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { auth } from '../config/firebase';
import { AuthContextType, TenantVerification } from '../types/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User, signInWithEmailAndPassword } from 'firebase/auth';
import { DatabaseService } from '../services/db';
import { RemoteDbService } from '../services/remoteDb';

const AuthContext = createContext<AuthContextType | null>(null);
let db: DatabaseService | null = null;
const remoteDb = new RemoteDbService();

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

      db = DatabaseService.getInstance();
      
      // Create users document with current user as the owner
      await remoteDb.createTenant(tenantEmail);

      // Store tenant email for future reference
      localStorage.setItem(`tenant_${user.uid}`, tenantEmail);
      setTenantVerification({
        tenantEmail,
        isVerified: true
      });

      await db.initialize(tenantEmail);
      return true;
    } catch (error) {
      console.error('Error creating tenant:', error);
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

      const hasAccess = await remoteDb.verifyTenantAccess(tenantEmail, userEmail);
      
      if (!hasAccess) {
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

      db = DatabaseService.getInstance();
      await db.initialize(tenantEmail);
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
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const db = DatabaseService.getInstance();
      await db.initialize(result.user.email!);
      return result.user;
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const db = DatabaseService.getInstance();
      await db.initialize(email); // Initialize DB with user's email
      return userCredential.user;
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