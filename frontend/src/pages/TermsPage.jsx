import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage({ onBack }) {
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
          <FileText size={20} />
          <h1 className="legal-title">Terms and Conditions</h1>
        </div>
        <div className="legal-meta">Last updated: September 2026</div>
      </div>

      <div className="legal-content">
        <h2>1. Purpose of the Software</h2>
        <p>
          Life System is provided as a personal, minimalist productivity application designed to help individuals plan their day, organize tasks, record daily notes, and track habits.
        </p>

        <h2>2. Use License and Ownership</h2>
        <p>
          You are granted a personal, non-exclusive license to use and self-host the software. You retain full ownership of all notes, tasks, and data entered into the application.
        </p>

        <h2>3. Data Responsibility and Backups</h2>
        <p>
          Because Life System stores records in your local or self-hosted database instance, you are responsible for maintaining proper database backups according to your personal data retention requirements.
        </p>

        <h2>4. Disclaimer of Warranties</h2>
        <p>
          The software is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied.
        </p>

        <h2>5. Modifications</h2>
        <p>
          These terms may be updated alongside new software releases. Continued use of the tool indicates acceptance of any revised terms.
        </p>
      </div>
    </div>
  );
}
