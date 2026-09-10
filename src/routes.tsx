import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/AuthGuard';
import { Loading } from './components/app/Primitives';
const Login = lazy(() => import('./pages/auth/Login').then(module => ({default:module.Login})));
const Register = lazy(() => import('./pages/auth/Register').then(module => ({default:module.Register})));
const Workspace = lazy(() => import('./pages/operator/TicketWorkspace').then(module => ({default:module.TicketWorkspace})));
const Form = lazy(() => import('./pages/public/PublicTicketForm').then(module => ({default:module.PublicTicketForm})));
const Detail = lazy(() => import('./pages/public/TicketDetail').then(module => ({default:module.TicketDetail})));
const Lookup = lazy(() => import('./pages/public/TicketLookup').then(module => ({default:module.TicketLookup})));
const Account = lazy(() => import('./pages/auth/Account').then(module => ({default:module.Account})));
const AccessDenied = lazy(() => import('./pages/error/AccessDenied').then(module => ({default:module.AccessDenied})));
const RootRedirect = () => {
  const {isAuthenticated,isStaff,isLoading}=useAuth();
  return isLoading?<Loading label="Memeriksa sesi Anda…"/>:<Navigate to={!isAuthenticated?'/login':isStaff?'/dashboard':'/my-tickets'} replace/>;
};
export function AppRoutes() {
  return <Suspense fallback={<Loading label="Menyiapkan halaman…"/>}><Routes>
    <Route path="/" element={<RootRedirect/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/register" element={<Register/>}/>
    <Route path="/access-denied" element={<AccessDenied/>}/>
    {['/submit','/buat-tiket'].map(path=><Route key={path} path={path} element={<ProtectedRoute requiredPermission="ticket.create"><Form/></ProtectedRoute>}/>)}
    {['/track','/cek-tiket'].map(path=><Route key={path} path={path} element={<ProtectedRoute><Lookup/></ProtectedRoute>}/>)}
    <Route path="/tickets/:id" element={<ProtectedRoute><Detail/></ProtectedRoute>}/>
    <Route path="/account" element={<ProtectedRoute><Account/></ProtectedRoute>}/>
    <Route path="/my-tickets" element={<ProtectedRoute><Workspace/></ProtectedRoute>}/>
    <Route path="/dashboard" element={<ProtectedRoute requireStaff><Workspace/></ProtectedRoute>}/>
    <Route path="*" element={<RootRedirect/>}/>
  </Routes></Suspense>;
}
