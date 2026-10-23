import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TodayPage from './pages/TodayPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import ProgressCard from './components/ProgressCard';
import InboxPage from './pages/InboxPage';
import ProjectsPage from './pages/ProjectsPage';
import GoalsPage from './pages/GoalsPage';
import ProfilePage from './pages/ProfilePage';
import CalendarPage from './pages/CalendarPage';
import FinancePage from './pages/FinancePage';
import RewardFeedback from './components/RewardFeedback';
import LoginScreen from './components/LoginScreen';
import AssistantPanel from './components/AssistantPanel';
import CatPet from './components/CatPet';
import { api } from './api/client';
import { getTheme } from './theme';
import { stopRewardAudio, unlockRewardAudio } from './utils/rewardSound';
import { getHiddenPages, saveHiddenPages } from './utils/navigationPreferences';

const views = ['today', 'inbox', 'projects', 'goals', 'calendar', 'finance', 'tasks', 'habits', 'profile'];
const resolveView = (hash) => hash === 'review' ? 'profile' : views.includes(hash) ? hash : 'today';
const narrowScreen = '(max-width: 900px)';

export default function App() {
  // Sync view state with URL hash
  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '');
    return resolveView(hash);
  };

  const [activeTab, setActiveTab] = useState(getInitialView);
  const [theme, setTheme] = useState(() => getTheme(localStorage.getItem('life-system-theme')).id);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('life-system-sound') !== 'off');
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, configured: false });
  const [authError, setAuthError] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(narrowScreen).matches);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('life-system-sidebar-collapsed') === 'true');
  const [hiddenPages, setHiddenPages] = useState(getHiddenPages);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const sidebarExpanded = isNarrow ? mobileSidebarOpen : !sidebarCollapsed;

  useEffect(() => {
    const media = window.matchMedia(narrowScreen);
    const onChange = (event) => {
      setIsNarrow(event.matches);
      setMobileSidebarOpen(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('life-system-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    saveHiddenPages(hiddenPages);
  }, [hiddenPages]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    let active = true;
    api.getSession().then((session) => {
      if (active) setAuthState({ loading: false, authenticated: session.authenticated, configured: session.configured });
    }).catch((error) => {
      if (active) { setAuthError(error.message === 'API route not found' ? 'The backend needs a restart with the new Lock In code.' : (error.message || 'Could not reach the server.')); setAuthState({ loading: false, authenticated: false, configured: false }); }
    });
    const signedOut = () => { setAssistantOpen(false); setAuthState((current) => ({ ...current, authenticated: false })); };
    window.addEventListener('lock-in:auth-required', signedOut);
    return () => { active = false; window.removeEventListener('lock-in:auth-required', signedOut); };
  }, []);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getTheme(theme).background);
    localStorage.setItem('life-system-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('life-system-sound', soundEnabled ? 'on' : 'off');
    if (!soundEnabled) return undefined;

    const unlockOnKey = (event) => {
      if (event.key === 'Enter' || event.key === ' ') unlockRewardAudio();
    };
    window.addEventListener('pointerdown', unlockRewardAudio, { capture: true, passive: true });
    window.addEventListener('keydown', unlockOnKey, true);
    return () => {
      window.removeEventListener('pointerdown', unlockRewardAudio, true);
      window.removeEventListener('keydown', unlockOnKey, true);
    };
  }, [soundEnabled]);

  // Listen to hash changes for browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setActiveTab(resolveView(hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (tab) => {
    setMobileSidebarOpen(false);
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePageVisibility = (id) => {
    setHiddenPages((current) => current.includes(id)
      ? current.filter((page) => page !== id)
      : [...current, id]);
  };

  const signOut = async () => {
    try {
      const registration = await navigator.serviceWorker?.ready;
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        try { await api.removeReminderSubscription(subscription.endpoint); } catch { /* Browser subscription still needs removal. */ }
        await subscription.unsubscribe();
      }
    } catch { /* Sign out even if this device cannot update its reminder subscription. */ }
    try { await api.logout(); } catch { /* Clear the local view even if the network is unavailable. */ }
    setAssistantOpen(false);
    setAuthState((current) => ({ ...current, authenticated: false }));
  };

  const retrySession = async () => {
    setAuthState((current) => ({ ...current, loading: true }));
    try {
      const session = await api.getSession();
      setAuthError('');
      setAuthState({ loading: false, authenticated: session.authenticated, configured: session.configured });
    } catch (error) {
      setAuthError(error.message || 'Could not reach the server.');
      setAuthState({ loading: false, authenticated: false, configured: false });
    }
  };

  if (authState.loading) return <div className="login-shell" role="status">Opening Lock In…</div>;
  if (!authState.authenticated) return <LoginScreen configured={authState.configured} serverError={authError} onLogin={() => setAuthState((current) => ({ ...current, authenticated: true }))} onRetry={retrySession} />;

  return (
    <div className={`app-shell ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}${isNarrow && mobileSidebarOpen ? ' mobile-sidebar-open' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {isNarrow && mobileSidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={() => setMobileSidebarOpen(false)} />}
      <Sidebar
        activeTab={activeTab}
        expanded={sidebarExpanded}
        hiddenPages={hiddenPages}
        onNavigate={navigateTo}
        onToggle={() => {
          if (isNarrow) setMobileSidebarOpen((open) => !open);
          else setSidebarCollapsed((collapsed) => !collapsed);
        }}
      />
      <div className="app-container" inert={isNarrow && mobileSidebarOpen}>
        <Header
          activeTab={activeTab}
          showCalendar={!hiddenPages.includes('calendar')}
          onNavigate={navigateTo}
          theme={theme}
          onSelectTheme={setTheme}
          soundEnabled={soundEnabled}
          onOpenAssistant={() => setAssistantOpen(true)}
          assistantOpen={assistantOpen}
          onToggleSound={() => {
            if (soundEnabled) stopRewardAudio();
            else unlockRewardAudio();
            setSoundEnabled((enabled) => !enabled);
          }}
        />

        <main className="app-main" id="main-content" key={dataVersion}>
          {['tasks', 'habits'].includes(activeTab) && <ProgressCard />}
          {activeTab === 'today' && (
            <TodayPage
              onNavigateToTasks={() => navigateTo('tasks')}
              onNavigateToHabits={() => navigateTo('habits')}
            />
          )}
          {activeTab === 'inbox' && <InboxPage />}
          {activeTab === 'projects' && <ProjectsPage />}
          {activeTab === 'goals' && <GoalsPage />}
          {activeTab === 'calendar' && <CalendarPage />}
          {activeTab === 'finance' && <FinancePage />}
          {activeTab === 'tasks' && <TasksPage />}
          {activeTab === 'habits' && <HabitsPage />}
          {activeTab === 'profile' && <ProfilePage onSignOut={signOut} hiddenPages={hiddenPages} onTogglePageVisibility={togglePageVisibility} />}
        </main>
      </div>

      {assistantOpen && <AssistantPanel onClose={closeAssistant} onApplied={() => setDataVersion((version) => version + 1)} />}
      <CatPet activeTab={activeTab} paused={mobileSidebarOpen || assistantOpen} sidebarExpanded={sidebarExpanded} />
      <RewardFeedback soundEnabled={soundEnabled} />
    </div>
  );
}
