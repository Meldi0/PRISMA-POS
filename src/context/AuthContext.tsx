import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, AccountStatus } from '../types';
import { apiService } from '../services/api';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  position?: string;
  role?: UserRole;
  data_scope?: string;
  region_id?: string;
  office_id?: string;
  nopen_kc?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isStaff: boolean;
  isPublicUser: boolean;
  isLoading: boolean;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  login: (email: string, password: string) => Promise<{ 
    success: boolean; 
    message?: string; 
    role?: UserRole;
    mfa_required?: boolean;
    challenge_token?: string;
    masked_email?: string;
    otp_preview?: string;
    account_status?: AccountStatus;
  }>;
  resendMfa: (challenge_token: string) => Promise<{
    success: boolean;
    message?: string;
    masked_email?: string;
  }>;
  verifyMfa: (challenge_token: string, otp_code: string) => Promise<{
    success: boolean;
    message?: string;
    role?: UserRole;
  }>;
  register: (payload: RegisterPayload | string, email?: string, password?: string) => Promise<{ 
    success: boolean; 
    message?: string; 
    account_status?: AccountStatus;
  }>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    const storedUser = apiService.getStoredUser();
    const storedToken = apiService.getStoredToken();
    if (storedUser && storedToken) {
      setUser(storedUser);
      setToken(storedToken);
      // Validasi token dan status akun langsung ke backend
      try {
        const res = await apiService.getProfile();
        if (res.status === 'success' && res.data) {
          setUser(res.data);
          apiService.setStoredUser(res.data);
        } else {
          setUser(null);
          setToken(null);
          apiService.setStoredUser(null);
          apiService.setStoredToken(null);
        }
      } catch {
        setUser(null);
        setToken(null);
        apiService.setStoredUser(null);
        apiService.setStoredToken(null);
      }
    } else {
      setUser(null);
      setToken(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const refreshUser = useCallback(async () => {
    const storedToken = apiService.getStoredToken();
    if (!storedToken) return;
    try {
      const res = await apiService.getProfile();
      if (res.status === 'success' && res.data) {
        setUser(res.data);
        apiService.setStoredUser(res.data);
      }
    } catch {
      // Ignore network errors on refresh
    }
  }, []);

  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!user) return false;
    // Super admins always have full access
    if (user.role === 'ADMIN' || user.role === 'ADMIN_PUSAT' || user.role === 'admin') return true;

    const perms = user.permissions || [];
    if (perms.includes('*')) return true;
    return perms.includes(permissionCode);
  }, [user]);

  const hasAnyPermission = useCallback((permissionCodes: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'ADMIN_PUSAT' || user.role === 'admin') return true;
    return permissionCodes.some(code => hasPermission(code));
  }, [user, hasPermission]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiService.login({ email, password });
      
      // Case 1: MFA is required
      if (res.mfa_required && res.challenge_token) {
        setIsLoading(false);
        return {
          success: false,
          mfa_required: true,
          challenge_token: res.challenge_token,
          masked_email: res.masked_email,
          otp_preview: res.otp_preview,
          message: res.message || 'Verifikasi Multi-Factor Authentication (MFA) diperlukan.'
        };
      }

      // Case 2: Login success without MFA
      if (res.status === 'success' && res.data?.token && res.data?.user) {
        setUser(res.data.user);
        setToken(res.data.token);
        setIsLoading(false);
        return { success: true, role: res.data.user.role };
      }

      setIsLoading(false);
      return { 
        success: false, 
        message: res.message || 'Login gagal. Periksa kembali email dan password Anda.',
        account_status: res.account_status
      };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, message: err.message || 'Gagal menghubungi server autentikasi.' };
    }
  };

  const verifyMfa = async (challenge_token: string, otp_code: string) => {
    setIsLoading(true);
    try {
      const res = await apiService.verifyMfa({ challenge_token, otp_code });
      if (res.status === 'success' && res.data?.token && res.data?.user) {
        setUser(res.data.user);
        setToken(res.data.token);
        setIsLoading(false);
        return { success: true, role: res.data.user.role };
      }
      setIsLoading(false);
      return {
        success: false,
        message: res.message || 'Kode verifikasi MFA tidak valid atau telah kedaluwarsa.'
      };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        message: err.message || 'Gagal memverifikasi kode MFA.'
      };
    }
  };

  const resendMfa = async (challenge_token: string) => {
    try {
      const res = await apiService.resendMfa({ challenge_token });
      if (res.status === 'success') {
        return {
          success: true,
          message: res.message || 'Kode OTP baru berhasil dikirimkan.',
          masked_email: res.masked_email
        };
      }
      return {
        success: false,
        message: res.message || 'Gagal mengirim ulang kode OTP.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Terjadi kesalahan saat meminta kode OTP baru.'
      };
    }
  };

  const register = async (payload: RegisterPayload | string, emailArg?: string, passwordArg?: string) => {
    setIsLoading(true);
    try {
      let reqBody: any;
      if (typeof payload === 'string') {
        reqBody = {
          name: payload,
          email: emailArg || '',
          password: passwordArg || ''
        };
      } else {
        reqBody = {
          name: payload.name,
          email: payload.email,
          password: payload.password,
          phone: payload.phone,
          position: payload.position,
          nopen: payload.nopen_kc,
          region_id: payload.region_id,
          office_id: payload.office_id
        };
      }

      const res = await apiService.register(reqBody);
      setIsLoading(false);
      
      if (res.status === 'success') {
        return { 
          success: true, 
          message: res.message, 
          account_status: (res.data?.account_status as AccountStatus) || 'PENDING'
        };
      }
      
      return { 
        success: false, 
        message: res.message || 'Registrasi gagal.',
        account_status: res.account_status 
      };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, message: err.message || 'Terjadi kesalahan sistem saat registrasi.' };
    }
  };

  const logout = () => {
    apiService.setStoredUser(null);
    setUser(null);
    setToken(null);
  };

  // isStaff is strictly for Helpdesk Operators and Administrators who manage the triage /dashboard
  const isStaff = Boolean(
    user && [
      'ADMIN',
      'ADMIN_PUSAT', 
      'admin', 
      'OPERATOR',
      'PETUGAS_UPT',
      'operator', 
      'upt_pusat'
    ].includes(user.role)
  );

  // General users / Pelapor / UPT Luar Cabang are public users
  const isPublicUser = Boolean(!isStaff);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isStaff,
        isPublicUser,
        isLoading,
        hasPermission,
        hasAnyPermission,
        login,
        verifyMfa,
        resendMfa,
        register,
        refreshUser,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

