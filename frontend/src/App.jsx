import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import TodayPage from './pages/TodayPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';

export default function App() {
  // Sync view state with URL hash
  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '');
    if (['today', 'tasks', 'habits', 'privacy', 'terms'].includes(hash)) {
      return hash;
    }
    return 'today';
  };

  const [activeTab, setActiveTab] = useState(getInitialView);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('life-system-theme') || 'dark';
  });

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('life-system-theme', theme);
  }, [theme]);

  // Listen to hash changes for browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['today', 'tasks', 'habits', 'privacy', 'terms'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        onNavigate={navigateTo}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="app-main" id="main-content">
        {!['privacy', 'terms'].includes(activeTab) && (
          <blockquote className="cockpit-quote">
            "Figure out what you want, ignore the opinions of others, and do so much volume that it would be unreasonable to not be successful."
          </blockquote>
        )}

        {activeTab === 'today' && (
          <TodayPage
            onNavigateToTasks={() => navigateTo('tasks')}
            onNavigateToHabits={() => navigateTo('habits')}
          />
        )}
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'habits' && <HabitsPage />}
        {activeTab === 'privacy' && (
          <PrivacyPolicyPage onBack={() => navigateTo('today')} />
        )}
        {activeTab === 'terms' && (
          <TermsPage onBack={() => navigateTo('today')} />
        )}
      </main>

      <Footer onNavigate={navigateTo} />
    </div>
  );
}
