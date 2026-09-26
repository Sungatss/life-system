import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage({ onBack }) {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <button
          type="button"
          className="btn-secondary"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}
        >
          <ArrowLeft size={14} />
          <span>Back to cockpit</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Shield size={20} />
          <h1 className="legal-title">Privacy Policy</h1>
        </div>
        <div className="legal-meta">Last updated: September 2026</div>
      </div>

      <div className="legal-content">
        <h2>1. Overview</h2>
        <p>
          Life System is designed as a personal, single-user productivity tool. We believe your thoughts, daily notes, task lists, and personal habits are private by default.
        </p>

        <h2>2. Data Collection and Storage</h2>
        <p>
          All information created within Life System, including daily notes, task entries, and habit records, is stored directly in your designated backend database (such as SQLite on your server or personal device).
        </p>
        <ul>
          <li>No telemetry or behavioral tracking is enabled.</li>
          <li>No advertising trackers, analytics scripts, or third-party pixels are loaded.</li>
          <li>No user data is ever sold, rented, or shared with outside parties.</li>
        </ul>

        <h2>3. Local Storage</h2>
        <p>
          The application uses browser local storage exclusively for your interface preferences, such as your chosen light or dark theme mode.
        </p>

        <h2>4. Data Retention and Control</h2>
        <p>
          You have complete ownership of your data. You may modify or delete any task, note, or habit directly from the interface at any time. When you delete an item, it is permanently removed from the database.
        </p>

        <h2>5. Contact</h2>
        <p>
          For questions regarding data handling or technical deployment, contact the system administrator through your self-hosted instance repository.
        </p>
      </div>
    </div>
  );
}
