import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PublicTicketForm } from './pages/public/PublicTicketForm';
import { PublicTicketTracker } from './pages/public/PublicTicketTracker';
import { MyTicketsPage } from './pages/public/MyTicketsPage';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { OperatorDashboard } from './pages/operator/OperatorDashboard';
import { AccessDenied } from './pages/error/AccessDenied';
import { ProtectedRoute } from './components/auth/AuthGuard';

// Root Redirect based on Authentication and Role
const RootRedirect: React.FC = () => {
  const { isAuthenticated, isStaff, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isStaff) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/my-tickets" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirected to login or role portal (Beranda dihapus) */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/submit" element={<PublicTicketForm />} />
      <Route path="/buat-tiket" element={<PublicTicketForm />} />
      <Route path="/track" element={<PublicTicketTracker />} />
      <Route path="/cek-tiket" element={<PublicTicketTracker />} />

      {/* AUTH ROUTES */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/access-denied" element={<AccessDenied />} />

      {/* PUBLIC USER AUTHENTICATED PORTAL */}
      <Route
        path="/my-tickets"
        element={
          <ProtectedRoute>
            <MyTicketsPage />
          </ProtectedRoute>
        }
      />

      {/* PROTECTED OPERATOR / STAFF DASHBOARD (Dark Glassmorphism Theme) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireStaff={true}>
            <OperatorDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback to Login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
