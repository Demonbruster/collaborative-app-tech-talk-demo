import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { auth } from '../config/firebase';
import { AuthContextType } from '../types/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';

const AuthContext = createContext<AuthContextType | null>(null);

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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // firebase auth listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      // if the user's path is /login, redirect to /
      if (location.pathname === '/login') {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, []);

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

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
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