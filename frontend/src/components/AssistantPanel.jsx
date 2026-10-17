import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { api } from '../api/client';
import './AssistantPanel.css';

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function AssistantPanel({ onClose, onApplied }) {
  const dialogRef = useRef(null);
  const questionRef = useRef(null);
  const bodyRef = useRef(null);
  const messageIdRef = useRef(0);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    questionRef.current?.focus();
    const close = () => onClose();
    dialog.addEventListener('close', close);
    return () => {
      dialog.removeEventListener('close', close);
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    api.assistantStatus()
      .then((nextStatus) => { if (active) setStatus(nextStatus); })
      .catch((failure) => { if (active) setError(failure.message || 'Could not load assistant status.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, busy, error]);

  const ask = async () => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      const history = messages.slice(-4).map((item) => ({ role: item.role, content: item.content.slice(0, 500) }));
      const result = await api.askAssistant({ question: text, today: localDate(), history });
      const userId = ++messageIdRef.current;
      const assistantId = ++messageIdRef.current;
      setMessages((previous) => [...previous,
        { id: userId, role: 'user', content: text },
        { id: assistantId, role: 'assistant', content: result.answer, proposals: result.proposals || [] },
      ].slice(-12));
      setQuestion('');
    } catch (failure) {
      setError(failure.message || 'Assistant request failed.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async (proposalId) => {
    setApplying(proposalId);
    setError('');
    try {
      await api.applyAssistantProposal(proposalId);
      setMessages((previous) => previous.map((message) => ({
        ...message,
        proposals: message.proposals?.map((item) => item.id === proposalId ? { ...item, applied: true } : item),
      })));
      onApplied();
    } catch (failure) {
      setError(failure.message || 'Could not apply this change.');
    } finally {
      setApplying('');
    }
  };

  return (
    <dialog className="assistant-dialog" id="ask-lock-in-panel" ref={dialogRef} aria-labelledby="assistant-title" aria-describedby="assistant-data-note">
      <div className="assistant-panel">
        <header className="assistant-header">
          <h2 id="assistant-title"><Sparkles size={20} aria-hidden="true" /> Ask Lock In</h2>
          <button type="button" className="assistant-close" onClick={() => dialogRef.current?.close()} aria-label="Close assistant"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="assistant-body" ref={bodyRef} role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && !busy && <p className="assistant-empty">Ask about your work, plan today, or break down a task by name.</p>}
          {messages.map((message) => (
            <div className={`assistant-message assistant-message-${message.role}`} key={message.id}>
              <p>{message.content}</p>
              {message.proposals?.length > 0 && (
                <section className="assistant-proposals" aria-label="Suggested changes">
                  <h3>Suggested changes</h3>
                  {message.proposals.map((proposal) => (
                    <div className="assistant-proposal" key={proposal.id}>
                      <h4>{proposal.label}</h4>
                      <dl>{proposal.changes.map((change, index) => (
                        <div key={`${change.field}-${index}`}>
                          <dt>{change.field}</dt>
                          <dd>{change.before ? `${change.before} → ${change.after}` : change.after}</dd>
                        </div>
                      ))}</dl>
                      <button type="button" onClick={() => apply(proposal.id)} disabled={proposal.applied || !!applying} aria-label={`Apply ${proposal.label}`}>
                        {proposal.applied ? 'Applied' : applying === proposal.id ? 'Applying…' : 'Apply'}
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </div>
          ))}
          {busy && <p role="status" className="assistant-muted">Thinking…</p>}
          {error && <p className="assistant-error" role="alert">{error}</p>}
          {status && !status.available && <p className="assistant-error" role="status">AI is not configured. Set a free Groq API key and supported model on the server.</p>}
        </div>
        <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); ask(); }}>
          <label htmlFor="assistant-question">Ask about your saved work</label>
          <textarea id="assistant-question" ref={questionRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(); } }} maxLength={1000} rows={2} placeholder="What should I focus on?" disabled={busy} />
          <button type="submit" disabled={!question.trim() || busy || status?.available === false}>Ask</button>
          <small className="assistant-data-note" id="assistant-data-note">Relevant saved work goes to Groq. Changes need Apply.</small>
        </form>
      </div>
    </dialog>
  );
}
