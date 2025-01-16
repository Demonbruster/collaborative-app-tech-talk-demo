import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthenticationGuard } from './contexts/AuthContext';
import TenantVerification from './components/TenantVerification';
import AppContent from './components/AppContent';
import './App.css';
import Login from './components/Login';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verify-tenant" element={
            <AuthenticationGuard>
              <TenantVerification />
            </AuthenticationGuard>
          } />
          <Route path="/*" element={
            <AuthenticationGuard>
              <AppContent />
            </AuthenticationGuard>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
