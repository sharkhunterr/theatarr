import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { SessionsPage } from './pages/SessionsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SessionEditor } from './pages/SessionEditor';
import { ServicesConfig } from './pages/ServicesConfig';
import { WallmountPage } from './pages/WallmountPage';
import { VotePage } from './pages/VotePage';
import { VotesAndQuizPage } from './pages/VotesAndQuizPage';
import { QuizPage } from './pages/QuizPage';
import { DisplayCodeInput, SessionDisplay } from './pages/DisplayPage';
import { MediaAndTemplatesPage } from './pages/MediaAndTemplatesPage';
import { ConfigPage } from './pages/ConfigPage';
import { SessionHistory } from './pages/SessionHistory';
import { SystemLogs } from './pages/SystemLogs';
import { UsersPage } from './pages/UsersPage';
import { HelpPage } from './pages/HelpPage';

// Portal Pages
import {
  PortalHome,
  MySessions,
  MyVotes,
  MyQuiz,
  VoteDetail,
  QuizDetail,
  SessionDetail,
  Profile,
} from './pages/portal';

// Layout
import { AdminLayout } from './components/layout';
import { PortalLayout } from './components/portal';

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

// Auth guard component for admin routes
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();
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

  // Redirect non-admin users to portal
  if (user?.role !== 'admin') {
    return <Navigate to="/portal" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

// Auth guard component for portal routes (any authenticated user)
function RequireUser({ children }: { children: JSX.Element }) {
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

  return <PortalLayout>{children}</PortalLayout>;
}

// Legacy auth guard (redirects based on role)
function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();
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

  // Redirect non-admin users to portal
  if (user?.role !== 'admin') {
    return <Navigate to="/portal" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/wallmount" element={<WallmountPage />} />
      <Route path="/wallmount/:sessionId" element={<WallmountPage />} />
      <Route path="/vote/:token" element={<VotePage />} />
      <Route path="/quiz/:token" element={<QuizPage />} />
      <Route path="/display" element={<DisplayCodeInput />} />
      <Route path="/display/:code" element={<SessionDisplay />} />
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
            <SessionDetailPage />
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
        element={<Navigate to="/media?tab=templates" replace />}
      />
      <Route
        path="/media"
        element={
          <RequireAuth>
            <MediaAndTemplatesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/votes"
        element={
          <RequireAuth>
            <VotesAndQuizPage />
          </RequireAuth>
        }
      />
      <Route
        path="/quiz"
        element={<Navigate to="/votes?tab=quiz" replace />}
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
      <Route
        path="/logs"
        element={
          <RequireAdmin>
            <SystemLogs />
          </RequireAdmin>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAdmin>
            <UsersPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/help"
        element={
          <RequireAuth>
            <HelpPage />
          </RequireAuth>
        }
      />

      {/* Portal routes (any authenticated user) */}
      <Route
        path="/portal"
        element={
          <RequireUser>
            <PortalHome />
          </RequireUser>
        }
      />
      <Route
        path="/portal/sessions"
        element={
          <RequireUser>
            <MySessions />
          </RequireUser>
        }
      />
      <Route
        path="/portal/sessions/:id"
        element={
          <RequireUser>
            <SessionDetail />
          </RequireUser>
        }
      />
      <Route
        path="/portal/votes"
        element={
          <RequireUser>
            <MyVotes />
          </RequireUser>
        }
      />
      <Route
        path="/portal/votes/:id"
        element={
          <RequireUser>
            <VoteDetail />
          </RequireUser>
        }
      />
      <Route
        path="/portal/quiz"
        element={
          <RequireUser>
            <MyQuiz />
          </RequireUser>
        }
      />
      <Route
        path="/portal/quiz/:id"
        element={
          <RequireUser>
            <QuizDetail />
          </RequireUser>
        }
      />
      <Route
        path="/portal/profile"
        element={
          <RequireUser>
            <Profile />
          </RequireUser>
        }
      />
      <Route
        path="/portal/help"
        element={
          <RequireUser>
            <HelpPage />
          </RequireUser>
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
