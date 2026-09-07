import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireStaff?: boolean;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireStaff = false,
  requiredPermission
}) => {
  const { isAuthenticated, isStaff, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F3EE] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-[#0D5C75] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-[#8C847E] tracking-wide">Memuat sesi PRISMA POS...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireStaff && !isStaff) {
    // Public users trying to access operator dashboard are redirected to their ticket portal
    return <Navigate to="/my-tickets" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};
