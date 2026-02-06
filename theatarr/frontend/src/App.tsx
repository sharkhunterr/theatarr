import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { SessionsPage } from './pages/SessionsPage';
import { SessionPage } from './pages/SessionPage';
import { SessionEditor } from './pages/SessionEditor';
import { ServicesConfig } from './pages/ServicesConfig';
import { WallmountPage } from './pages/WallmountPage';
import { TemplateManager } from './pages/TemplateManager';
import { VotePage } from './pages/VotePage';
import { VoteSessionManager } from './pages/VoteSessionManager';
import { TrailersManager } from './pages/TrailersManager';
import { ConfigPage } from './pages/ConfigPage';
import { SessionHistory } from './pages/SessionHistory';

// Layout
import { AdminLayout } from './components/layout';

// Stores
import { useAuthStore } from './stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Auth guard component
function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-dark-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/wallmount" element={<WallmountPage />} />
      <Route path="/vote/:token" element={<VotePage />} />
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions"
        element={
          <RequireAuth>
            <SessionsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/new"
        element={
          <RequireAuth>
            <SessionEditor />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:id"
        element={
          <RequireAuth>
            <SessionPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:id/edit"
        element={
          <RequireAuth>
            <SessionEditor />
          </RequireAuth>
        }
      />
      <Route
        path="/services"
        element={
          <RequireAuth>
            <ServicesConfig />
          </RequireAuth>
        }
      />
      <Route
        path="/templates"
        element={
          <RequireAuth>
            <TemplateManager />
          </RequireAuth>
        }
      />
      <Route
        path="/trailers"
        element={
          <RequireAuth>
            <TrailersManager />
          </RequireAuth>
        }
      />
      <Route
        path="/votes"
        element={
          <RequireAuth>
            <VoteSessionManager />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <ConfigPage />
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <SessionHistory />
          </RequireAuth>
        }
      />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
