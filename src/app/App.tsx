import { QueryClientProvider } from '@tanstack/react-query';
import { Component, useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { FeedbackHost, toast } from '@/components/glass/feedback.tsx';
import { Button, Loading } from '@/components/ui.tsx';
import { makeT, useT } from '@/i18n/index.ts';
import { isUnauthorized } from '@/lib/api.ts';
import { queryClient, syncOutbox, useMe } from '@/lib/queries.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { Welcome } from '../features/auth/Welcome.tsx';
import { LibraryPage } from '../features/exercises/LibraryPage.tsx';
import { HomePage } from '../features/home/HomePage.tsx';
import { FriendsPage, ProfilePage } from '../features/profile/pages.tsx';
import { ProgressPage } from '../features/progress/ProgressPage.tsx';
import { RoutineEditPage, RoutinesPage } from '../features/routines/pages.tsx';
import { SettingsPage } from '../features/settings/SettingsPage.tsx';
import { EditWorkoutPage, HistoryDetailPage, HistoryPage, WorkoutDonePage } from '../features/workout/pages.tsx';
import { WorkoutPage } from '../features/workout/WorkoutPage.tsx';
import { Layout } from './Layout.tsx';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/workout', element: <WorkoutPage /> },
      { path: '/workout/done/:id', element: <WorkoutDonePage /> },
      { path: '/routines', element: <RoutinesPage /> },
      { path: '/routines/:id', element: <RoutineEditPage /> },
      { path: '/progress', element: <ProgressPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/u/:username', element: <ProfilePage /> },
      { path: '/friends', element: <FriendsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/library', element: <LibraryPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/history/:id', element: <HistoryDetailPage /> },
      { path: '/history/:id/edit', element: <EditWorkoutPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

/** Signed-in gate. Offline with a cached profile still lets you train. */
function Gate() {
  const { t } = useT();
  const me = useMe();
  const setPrefs = usePrefs((s) => s.set);
  const user = me.data?.user;

  // The account is the source of truth for language, theme and units.
  useEffect(() => {
    if (user) setPrefs({ lang: user.locale, theme: user.theme, units: user.units });
  }, [user?.locale, user?.theme, user?.units, setPrefs, user]);

  useEffect(() => {
    if (!user) return;
    void syncOutbox();
    const onOnline = () => void syncOutbox();
    window.addEventListener('online', onOnline);
    const id = setInterval(onOnline, 60_000);
    if (sessionStorage.getItem('himbo-recovered')) toast(t('auth.afterRecovery'), 'lock');
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(id);
    };
  }, [user, t]);

  // 401 → sign in. Cached profile (e.g. offline) → app. No profile and no answer → sign in.
  if (me.isError && isUnauthorized(me.error)) return <Welcome />;
  if (me.data) return <RouterProvider router={router} />;
  if (me.isError || me.data === null) return <Welcome />;
  return <Loading label={t('common.loading')} />;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const { t } = makeT(usePrefs.getState().lang);
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-sm">{t('error.boundary')}</h1>
        <Button variant="primary" onClick={() => location.reload()}>
          {t('error.reload')}
        </Button>
      </main>
    );
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Gate />
        <FeedbackHost />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
