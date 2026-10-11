import { useEffect, useRef, useState } from 'react';
import { Check, Flame, Sprout, Zap } from 'lucide-react';
import { api, PROGRESS_CHANGED } from '../api/client';
import './ProgressCard.css';

export default function ProgressCard() {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const retryRef = useRef(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let celebrationId = 0;
    let previous = null;
    let celebrationTimer;
    const refresh = async (celebrate = false) => {
      const id = ++requestId;
      try {
        const next = await api.getProgress();
        if (!active || id !== requestId) return;
        clearTimeout(celebrationTimer);
        let reward = null;
        if (celebrate && previous?.date === next.date && next.today_xp > previous.today_xp) {
          const gained = next.today_xp - previous.today_xp;
          const kind = next.level > previous.level ? 'level'
            : previous.today_xp < next.daily_goal && next.today_xp >= next.daily_goal ? 'goal'
              : 'xp';
          const message = kind === 'level' ? `Level ${next.level}! Keep growing.`
            : kind === 'goal' ? 'Daily goal complete. Nicely done!'
              : 'One small step forward.';
          reward = { id: ++celebrationId, gained, kind, message };
        }
        previous = next;
        setProgress(next);
        setError(false);
        setCelebration(reward);
        if (reward) celebrationTimer = setTimeout(() => setCelebration(null), 4500);
      } catch {
        if (!active || id !== requestId) return;
        previous = null;
        setCelebration(null);
        setError(true);
      }
    };
    const onChange = () => refresh(true);
    const onFocus = () => refresh();
    retryRef.current = onFocus;
    refresh();
    window.addEventListener(PROGRESS_CHANGED, onChange);
    window.addEventListener('focus', onFocus);
    // Refresh the local day after midnight, even if this tab stays open.
    const interval = setInterval(onFocus, 60000);
    return () => {
      active = false;
      clearTimeout(celebrationTimer);
      clearInterval(interval);
      window.removeEventListener(PROGRESS_CHANGED, onChange);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (error) return (
    <section className="progress-card progress-card-placeholder" aria-label="Your progress">
      <span>Progress is temporarily unavailable.</span>
      <button type="button" className="btn-secondary" onClick={() => retryRef.current?.()}>Retry</button>
    </section>
  );
  if (!progress) return (
    <section className="progress-card progress-card-placeholder" aria-label="Your progress" aria-busy="true">
      Loading your progress…
    </section>
  );

  const goalMet = progress.today_xp >= progress.daily_goal;
  const remaining = (progress.daily_goal - progress.today_xp) / 10;
  const goalPercent = Math.min(100, (progress.today_xp / progress.daily_goal) * 100);
  const prompt = goalMet ? 'Daily goal complete. Every extra step is a bonus.'
    : progress.today_xp > 0 ? `${remaining} more ${remaining === 1 ? 'completion' : 'completions'} to your daily goal.`
    : 'Complete 3 tasks or habits today. Start with one.';

  return (
    <section className={`progress-card${goalMet ? ' progress-card-complete' : ''}${celebration ? ` progress-card-reward-${celebration.kind}` : ''}`} aria-label="Your progress">
      <div className="progress-card-top">
        <div className="progress-card-heading">
          <span className="progress-card-icon" aria-hidden="true">
            <Sprout size={21} />
            {(celebration?.kind === 'goal' || celebration?.kind === 'level') && (
              <span key={celebration.id} className="progress-sparkles">
                {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
              </span>
            )}
          </span>
          <div><h2>Small steps, every day</h2><p>{prompt}</p></div>
        </div>
        <div className="progress-card-stats">
          <span className={`progress-streak${progress.streak ? ' is-active' : ''}`}>
            <Flame size={17} aria-hidden="true" />
            <strong>{progress.streak}</strong> day streak
          </span>
          <span className="progress-level"><Zap size={15} aria-hidden="true" /> <span key={celebration?.kind === 'level' ? celebration.id : progress.level} className={celebration?.kind === 'level' ? 'progress-level-up' : ''}>Level {progress.level}</span>
            <span className="progress-total">{progress.total_xp.toLocaleString()} XP</span>
          </span>
        </div>
      </div>
      <div className="progress-goal-row">
        <span className="progress-goal-label">{goalMet && <Check size={14} aria-hidden="true" />} Today’s goal</span>
        <div className="progress-goal-bar" role="progressbar" aria-label="Today's XP goal" aria-valuemin={0} aria-valuemax={progress.daily_goal} aria-valuenow={Math.min(progress.today_xp, progress.daily_goal)}>
          <span className="progress-goal-fill" style={{ width: `${goalPercent}%` }} />
        </div>
        <span className="progress-goal-value">{progress.today_xp} / {progress.daily_goal} XP</span>
      </div>
      <div className="progress-card-footer">
        <div className="progress-feedback" role="status" aria-live="polite" aria-atomic="true">
          {celebration && (
            <span key={celebration.id} className="progress-feedback-content">
              <strong className="progress-xp-burst">+{celebration.gained} XP</strong>
              <span>{celebration.message}</span>
            </span>
          )}
        </div>
        <details className="progress-rules">
          <summary>How it works</summary>
          <p>Earn 10 XP for each completed task or daily habit. Reach 30 XP for your daily goal and gain a level every 100 XP. {progress.xp_to_next_level} XP to your next level.</p>
          <p>One completion a day keeps your streak going. Today follows your device’s timezone, even when you browse past dates. Past habit check-ins count on their date; tasks count when completed.</p>
          <p>XP reflects saved completions, including existing history. Undoing or deleting a completion removes its XP. Steps count toward their parent task, with no extra XP.</p>
        </details>
      </div>
    </section>
  );
}
