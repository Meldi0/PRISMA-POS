import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error in Boundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">Terjadi Sedikit Kendala Tampilan</h2>
              <p className="text-xs text-[#64748B] mt-1">
                Data sedang disinkronkan dengan server. Silakan muat ulang halaman untuk melanjutkan.
              </p>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0D5C75] text-white text-xs font-bold hover:bg-[#083342] transition-colors cursor-pointer"
              >
                <RefreshCw size={14} /> Muat Ulang Halaman
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Home size={14} /> Kembali ke Halaman Masuk
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
