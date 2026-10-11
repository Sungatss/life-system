import { useCallback, useEffect, useRef, useState } from 'react';
import { Inbox, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import './InboxPage.css';

const DRAFT_KEY = 'life-system-inbox-draft';
const asUtcDateTime = (value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;

export default function InboxPage() {
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState(() => localStorage.getItem(DRAFT_KEY) || '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const captureRef = useRef(null);

  const loadEntries = useCallback(async (isActive = () => true) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.getInbox();
      if (isActive()) setEntries(data);
    } catch {
      if (isActive()) setLoadError('Could not load your Inbox. Check your connection and try again.');
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) loadEntries(() => active); });
    return () => { active = false; };
  }, [loadEntries]);

  const updateDraft = (value) => {
    setDraft(value);
    localStorage.setItem(DRAFT_KEY, value);
    if (saveError) setSaveError('');
  };

  const capture = async (event) => {
    event.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setSaveError('');
    try {
      const entry = await api.createInboxEntry(draft.trim());
      setEntries((previous) => [entry, ...previous]);
      setLoadError('');
      setLoading(false);
      setDraft('');
      localStorage.removeItem(DRAFT_KEY);
      captureRef.current?.focus();
    } catch {
      setSaveError('Could not save this thought. Your text is still here; try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setConfirmDeleteId(null);
    setActionError('');
  };

  const stopEdit = () => {
    const id = editingId;
    setEditingId(null);
    setEditContent('');
    setActionError('');
    requestAnimationFrame(() => document.getElementById(`inbox-edit-${id}`)?.focus());
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editContent.trim() || busyId !== null) return;
    const id = editingId;
    setBusyId(id);
    setActionError('');
    try {
      const updated = await api.updateInboxEntry(id, editContent.trim());
      setEntries((previous) => previous.map((entry) => entry.id === id ? updated : entry));
      stopEdit();
    } catch {
      setActionError('Could not save changes. Your text is still here; try again.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteEntry = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setActionError('');
      return;
    }
    if (busyId !== null) return;
    setBusyId(id);
    setActionError('');
    try {
      await api.deleteInboxEntry(id);
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
      setConfirmDeleteId(null);
      captureRef.current?.focus();
    } catch {
      setActionError('Could not delete this entry. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="inbox-page">
      <div className="cockpit-date-banner inbox-banner">
        <h1 className="cockpit-title">Inbox</h1>
      </div>

      <section className="cockpit-section inbox-section" aria-labelledby="inbox-capture-heading">
        <div className="section-header">
          <div className="section-title-wrap">
            <Inbox size={17} aria-hidden="true" />
            <h2 className="section-title" id="inbox-capture-heading">Get it out of your head</h2>
          </div>
        </div>
        <form onSubmit={capture} className="inbox-capture-form">
          <label className="sr-only" htmlFor="inbox-capture">Thought or task</label>
          <textarea
            id="inbox-capture"
            ref={captureRef}
            className="task-input-field inbox-textarea"
            placeholder="Thought or task"
            value={draft}
            onChange={(event) => updateDraft(event.target.value)}
            rows={3}
            maxLength={10000}
            disabled={submitting || loading}
          />
          <div className="inbox-capture-bottom">
            <span className="inbox-hint">Draft saved in this browser</span>
            <button type="submit" className="btn-primary inbox-add-button" disabled={!draft.trim() || submitting || loading}>
              <Plus size={17} aria-hidden="true" />
              {submitting ? 'Saving…' : 'Add to Inbox'}
            </button>
          </div>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
        </form>
      </section>

      <section className="cockpit-section inbox-section" aria-labelledby="inbox-list-heading">
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title" id="inbox-list-heading">Captured</h2>
          </div>
          {!loading && !loadError && <span className="section-badge">{entries.length}</span>}
        </div>

        {loading ? <div className="empty-state"><p>Loading your Inbox…</p></div> :
          loadError ? (
            <div className="empty-state error-state" role="alert">
              <p>{loadError}</p>
              <button className="btn-secondary" type="button" onClick={() => loadEntries()}>Retry</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state inbox-empty">
              <Inbox size={24} aria-hidden="true" />
              <p>Nothing in your Inbox yet.</p>
            </div>
          ) : (
            <ul className="inbox-list">
              {entries.map((entry) => (
                <li className="inbox-entry" key={entry.id}>
                  {editingId === entry.id ? (
                    <form onSubmit={saveEdit} className="inbox-edit-form">
                      <label className="sr-only" htmlFor={`inbox-edit-content-${entry.id}`}>Edit entry</label>
                      <textarea
                        id={`inbox-edit-content-${entry.id}`}
                        className="task-input-field inbox-textarea"
                        value={editContent}
                        onChange={(event) => setEditContent(event.target.value)}
                        rows={3}
                        maxLength={10000}
                        disabled={busyId === entry.id}
                        autoFocus
                      />
                      <div className="inbox-entry-actions">
                        <button type="button" className="btn-secondary" onClick={stopEdit} disabled={busyId === entry.id}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={!editContent.trim() || busyId === entry.id}>Save changes</button>
                      </div>
                      {actionError && <p className="form-error" role="alert">{actionError}</p>}
                    </form>
                  ) : (
                    <>
                      <p className="inbox-entry-content">{entry.content}</p>
                      <div className="inbox-entry-bottom">
                        <time dateTime={asUtcDateTime(entry.created_at)}>
                          {new Date(asUtcDateTime(entry.created_at)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </time>
                        <div className="inbox-entry-actions">
                          <button type="button" className="inbox-action" id={`inbox-edit-${entry.id}`} onClick={() => startEdit(entry)} disabled={busyId === entry.id}>
                            <Pencil size={13} aria-hidden="true" /> Edit
                          </button>
                          {confirmDeleteId === entry.id && (
                            <button type="button" className="inbox-action" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                          )}
                          <button type="button" className={`inbox-action ${confirmDeleteId === entry.id ? 'inbox-danger' : ''}`} onClick={() => deleteEntry(entry.id)} disabled={busyId === entry.id}>
                            <Trash2 size={13} aria-hidden="true" /> {confirmDeleteId === entry.id ? 'Confirm delete' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      {confirmDeleteId === entry.id && actionError && <p className="form-error" role="alert">{actionError}</p>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
