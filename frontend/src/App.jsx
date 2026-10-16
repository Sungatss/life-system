import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TodayPage from './pages/TodayPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import ProgressCard from './components/ProgressCard';
import InboxPage from './pages/InboxPage';
import ProjectsPage from './pages/ProjectsPage';
import ProfilePage from './pages/ProfilePage';
import RewardFeedback from './components/RewardFeedback';
import LoginScreen from './components/LoginScreen';
import AssistantPanel from './components/AssistantPanel';
import { api } from './api/client';
import { getTheme } from './theme';
import { stopRewardAudio, unlockRewardAudio } from './utils/rewardSound';

const views = ['today', 'inbox', 'projects', 'tasks', 'habits', 'profile'];
const resolveView = (hash) => hash === 'review' ? 'profile' : views.includes(hash) ? hash : 'today';

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
  const [dataVersion, setDataVersion] = useState(0);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);

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
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const signOut = async () => {
    try { await api.logout(); } catch { /* Clear the local view even if the network is unavailable. */ }
    setAssistantOpen(false);
    setAuthState((current) => ({ ...current, authenticated: false }));
  };

  if (authState.loading) return <div className="login-shell" role="status">Opening Lock In…</div>;
  if (!authState.authenticated) return <LoginScreen configured={authState.configured} serverError={authError} onLogin={() => setAuthState((current) => ({ ...current, authenticated: true }))} />;

  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header
        activeTab={activeTab}
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
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'habits' && <HabitsPage />}
        {activeTab === 'profile' && <ProfilePage onSignOut={signOut} />}
      </main>

      {assistantOpen && <AssistantPanel onClose={closeAssistant} onApplied={() => setDataVersion((version) => version + 1)} />}
      <RewardFeedback soundEnabled={soundEnabled} />
    </div>
  );
}
