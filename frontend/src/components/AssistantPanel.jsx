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
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [answer, setAnswer] = useState('');
  const [proposals, setProposals] = useState([]);
  const [focus, setFocus] = useState('');
  const [targets, setTargets] = useState([]);
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
    Promise.all([api.assistantStatus(), api.getTasks('active'), api.getProjects()])
      .then(([nextStatus, tasks, projects]) => {
        if (!active) return;
        setStatus(nextStatus);
        setTargets([
          ...tasks.slice(0, 50).map((item) => ({ value: `task:${item.id}`, label: `Task: ${item.title}` })),
          ...projects.slice(0, 50).map((item) => ({ value: `project:${item.id}`, label: `Project: ${item.name}` })),
        ]);
      })
      .catch((failure) => { if (active) setError(failure.message || 'Could not load assistant options.'); });
    return () => { active = false; };
  }, []);

  const ask = async (intent, customQuestion) => {
    const text = (customQuestion || question).trim();
    if (!text || busy) return;
    let focusType = null;
    let focusId = null;
    if (intent === 'breakdown') {
      if (!focus) { setError('Choose a task or project first.'); return; }
      const [kind, id] = focus.split(':');
      focusType = kind;
      focusId = Number(id);
    }
    setBusy(true);
    setError('');
    setAnswer('');
    setProposals([]);
    try {
      const result = await api.askAssistant({ question: text, intent, focus_type: focusType, focus_id: focusId, today: localDate(), history: history.slice(-4) });
      setAnswer(result.answer);
      setProposals(result.proposals || []);
      setHistory((previous) => [...previous, { role: 'user', content: text.slice(0, 500) }, { role: 'assistant', content: result.answer.slice(0, 500) }].slice(-4));
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
      setProposals((previous) => previous.map((item) => item.id === proposalId ? { ...item, applied: true } : item));
      onApplied();
    } catch (failure) {
      setError(failure.message || 'Could not apply this change.');
    } finally {
      setApplying('');
    }
  };

  const planToday = () => ask('plan_today', 'Suggest a realistic plan for today from my active tasks and habits.');
  const breakDown = () => ask('breakdown', `Break this selected ${focus.startsWith('project:') ? 'project' : 'task'} into a few concrete steps.`);

  return (
    <dialog className="assistant-dialog" id="ask-lock-in-panel" ref={dialogRef} aria-labelledby="assistant-title" aria-describedby="assistant-notice">
      <div className="assistant-panel">
        <header className="assistant-header">
          <h2 id="assistant-title"><Sparkles size={20} aria-hidden="true" /> Ask Lock In</h2>
          <button type="button" className="assistant-close" onClick={() => dialogRef.current?.close()} aria-label="Close assistant"><X size={20} aria-hidden="true" /></button>
        </header>
        <p className="assistant-notice" id="assistant-notice">Relevant saved tasks, habits, projects, or Inbox items are sent to Groq to answer your request. Nothing suggested is saved until you press Apply.</p>
        {status && !status.available && <p className="assistant-error" role="status">AI is not configured. Set a free Groq API key and supported model on the server.</p>}
        <div className="assistant-body">
          <div className="assistant-shortcuts">
            <button type="button" onClick={planToday} disabled={busy || status?.available === false}>Plan today</button>
            <label htmlFor="assistant-focus">Break down</label>
            <select id="assistant-focus" value={focus} onChange={(event) => setFocus(event.target.value)}>
              <option value="">Choose a task or project</option>
              {targets.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
            <button type="button" onClick={breakDown} disabled={busy || !focus || status?.available === false}>Make steps</button>
          </div>
          {busy && <p role="status" className="assistant-muted">Thinking…</p>}
          {error && <p className="assistant-error" role="alert">{error}</p>}
          {answer && <section className="assistant-answer" aria-label="Assistant answer"><p>{answer}</p></section>}
          {proposals.length > 0 && (
            <section className="assistant-proposals" aria-label="Suggested changes">
              <h3>Suggested changes</h3>
              {proposals.map((proposal) => (
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
        <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); ask('ask'); }}>
          <label htmlFor="assistant-question">Ask about your saved work</label>
          <textarea id="assistant-question" ref={questionRef} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={2} placeholder="What should I focus on?" />
          <button type="submit" disabled={!question.trim() || busy || status?.available === false}>Ask</button>
        </form>
      </div>
    </dialog>
  );
}
