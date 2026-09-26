import React from 'react';

export default function Footer({ onNavigate }) {
  return (
    <footer className="app-footer">
      <div className="footer-top">
        <div className="brand" style={{ fontSize: '14px' }}>
          Life System
        </div>
        <nav className="footer-nav" aria-label="Footer Navigation">
          <button
            type="button"
            className="footer-link"
            style={{ background: 'none', border: 'none', font: 'inherit', padding: 0 }}
            onClick={() => onNavigate('today')}
          >
            Today
          </button>
          <button
            type="button"
            className="footer-link"
            style={{ background: 'none', border: 'none', font: 'inherit', padding: 0 }}
            onClick={() => onNavigate('tasks')}
          >
            Tasks
          </button>
          <button
            type="button"
            className="footer-link"
            style={{ background: 'none', border: 'none', font: 'inherit', padding: 0 }}
            onClick={() => onNavigate('habits')}
          >
            Habits
          </button>
          <button
            type="button"
            className="footer-link"
            style={{ background: 'none', border: 'none', font: 'inherit', padding: 0 }}
            onClick={() => onNavigate('privacy')}
            id="footer-privacy-btn"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            className="footer-link"
            style={{ background: 'none', border: 'none', font: 'inherit', padding: 0 }}
            onClick={() => onNavigate('terms')}
            id="footer-terms-btn"
          >
            Terms and Conditions
          </button>
        </nav>
      </div>
      <div className="footer-note">
        Personal daily cockpit. Minimalist, private, and distraction-free.
      </div>
    </footer>
  );
}
