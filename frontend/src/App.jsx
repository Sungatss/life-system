import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TodayPage from './pages/TodayPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import ProgressCard from './components/ProgressCard';
import InboxPage from './pages/InboxPage';
import ProjectsPage from './pages/ProjectsPage';
import ProfilePage from './pages/ProfilePage';
import RewardFeedback from './components/RewardFeedback';
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

  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header
        activeTab={activeTab}
        onNavigate={navigateTo}
        theme={theme}
        onSelectTheme={setTheme}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          if (soundEnabled) stopRewardAudio();
          else unlockRewardAudio();
          setSoundEnabled((enabled) => !enabled);
        }}
      />

      <main className="app-main" id="main-content">
        {['today', 'tasks', 'habits'].includes(activeTab) && <ProgressCard />}
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
        {activeTab === 'profile' && <ProfilePage />}
      </main>

      <RewardFeedback soundEnabled={soundEnabled} />
    </div>
  );
}
