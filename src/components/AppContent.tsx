import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './auth/LoginForm';
import { DrawingBoard } from './DrawingBoard';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};

const AppContent = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen w-full bg-gray-100">
      {user && (
        <nav className="w-full bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <span className="text-lg font-semibold text-gray-900">
                  Welcome, {user.displayName}
                </span>
              </div>
              <div className="flex items-center">
                <button
                  onClick={logout}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}
      <div className="w-full py-10">
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <div className="space-y-6">
                      <div className="bg-white shadow rounded-lg p-6">
                        <h1 className="text-2xl font-semibold text-gray-900">Collaborative Drawing Board</h1>
                        <p className="mt-4 text-gray-600">
                          Draw and collaborate in real-time. Changes are automatically saved and synced.
                        </p>
                      </div>
                      <div className="bg-white shadow rounded-lg">
                        <DrawingBoard />
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LoginForm />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppContent; 