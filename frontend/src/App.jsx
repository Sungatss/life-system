import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Footer from './components/Footer';
import TodayPage from './pages/TodayPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import ProgressCard from './components/ProgressCard';
import InboxPage from './pages/InboxPage';
import ProjectsPage from './pages/ProjectsPage';
import ProfilePage from './pages/ProfilePage';
import { getTheme } from './theme';

const views = ['today', 'inbox', 'projects', 'tasks', 'habits', 'profile', 'privacy', 'terms'];
const resolveView = (hash) => hash === 'review' ? 'profile' : views.includes(hash) ? hash : 'today';

export default function App() {
  // Sync view state with URL hash
  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '');
    return resolveView(hash);
  };

  const [activeTab, setActiveTab] = useState(getInitialView);
  const [theme, setTheme] = useState(() => getTheme(localStorage.getItem('life-system-theme')).id);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getTheme(theme).background);
    localStorage.setItem('life-system-theme', theme);
  }, [theme]);

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
        onNavigate={navigateTo}
        theme={theme}
        onSelectTheme={setTheme}
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
        {activeTab === 'privacy' && (
          <PrivacyPolicyPage onBack={() => navigateTo('today')} />
        )}
        {activeTab === 'terms' && (
          <TermsPage onBack={() => navigateTo('today')} />
        )}
      </main>

      <Footer onNavigate={navigateTo} />
      <BottomNav activeTab={activeTab} onNavigate={navigateTo} />
    </div>
  );
}
