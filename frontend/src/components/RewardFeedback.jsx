import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Trophy, X, Zap } from 'lucide-react';
import { api, PROGRESS_CHANGED } from '../api/client';
import { playRewardSound } from '../utils/rewardSound';
import './RewardFeedback.css';

const nextStreakMilestone = (streak) => [7, 14, 30, 50, 100].find((day) => day > streak)
  || (Math.floor(streak / 100) + 1) * 100;

function StreakFlame() {
  return (
    <svg className="reward-streak-flame" viewBox="0 0 200 240" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="streak-outer" x1="36" y1="32" x2="161" y2="215" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE17C" /><stop offset=".37" stopColor="#FF9B24" /><stop offset=".74" stopColor="#FF5724" /><stop offset="1" stopColor="#E83727" />
        </linearGradient>
        <linearGradient id="streak-inner" x1="76" y1="101" x2="121" y2="216" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF9CC" /><stop offset=".54" stopColor="#FFE574" /><stop offset="1" stopColor="#FFB62F" />
        </linearGradient>
      </defs>
      <path className="reward-flame-outer" d="M105 9c3 37-28 52-21 86-14-11-19-35-17-53-24 26-42 62-42 100 0 53 34 88 78 88 47 0 82-36 82-84 0-45-24-73-45-92 4 33-7 49-17 57 2-41-3-72-18-102Z" fill="url(#streak-outer)" />
      <path className="reward-flame-middle" d="M105 72c-3 28-23 38-24 68-8-9-11-18-11-27-16 20-26 43-26 67 0 29 24 50 57 50 34 0 59-25 59-56 0-27-13-44-30-58 1 20-6 33-15 39 2-35-2-61-10-83Z" fill="#FFB72F" />
      <path className="reward-flame-inner" d="M107 125c-3 21-22 32-21 51-6-5-10-12-10-19-9 11-15 25-15 38 0 21 17 35 40 35 24 0 41-16 41-38 0-17-8-29-19-39 1 14-4 23-11 28 0-21-1-39-5-56Z" fill="url(#streak-inner)" />
    </svg>
  );
}

export default function RewardFeedback({ soundEnabled }) {
  const [reward, setReward] = useState(null);
  const soundEnabledRef = useRef(soundEnabled);
  const streakSceneRef = useRef(null);
  const streakButtonRef = useRef(null);
  const streakVisibleUntilRef = useRef(0);

  const dismissReward = useCallback(() => {
    streakVisibleUntilRef.current = 0;
    setReward(null);
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    let active = true;
    let previous = null;
    let timer;
    let rewardId = 0;
    let queue = Promise.resolve();

    const refresh = (celebrate = false) => {
      // Serialize reads so the initial snapshot is not discarded by a fast first click.
      queue = queue.then(async () => {
        const next = await api.getProgress();
        if (!active) return;

        if (celebrate && previous && next.total_xp > previous.total_xp) {
          const gained = next.total_xp - previous.total_xp;
          const levelUp = next.level > previous.level;
          const goalReached = previous.today_xp < next.daily_goal && next.today_xp >= next.daily_goal;
          const kind = next.streak > previous.streak ? 'streak' : levelUp ? 'level' : goalReached ? 'goal' : 'xp';
          if (kind === 'streak') {
            clearTimeout(timer);
            const id = ++rewardId;
            streakVisibleUntilRef.current = Date.now() + 6500;
            setReward({ id, gained, kind, streak: next.streak, level: next.level, levelUp, goalReached });
            timer = setTimeout(() => {
              streakVisibleUntilRef.current = 0;
              setReward((current) => current?.id === id ? null : current);
            }, 6500);
          } else if (Date.now() < streakVisibleUntilRef.current) {
            setReward((current) => current?.kind === 'streak'
              ? { ...current, gained: current.gained + gained, level: next.level,
                levelUp: current.levelUp || levelUp, goalReached: current.goalReached || goalReached }
              : current);
          } else {
            clearTimeout(timer);
            const id = ++rewardId;
            setReward({ id, gained, kind, level: next.level });
            timer = setTimeout(() => setReward((current) => current?.id === id ? null : current), kind === 'level' ? 5000 : 3000);
          }
          if (soundEnabledRef.current) playRewardSound(kind);

          // Vibration is optional; unsupported browsers simply show the visual reward.
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
              document.visibilityState === 'visible' && typeof navigator.vibrate === 'function') {
            try {
              navigator.vibrate(kind === 'streak' ? [35, 40, 70] : kind === 'level' ? [45, 35, 70] : kind === 'goal' ? [30, 25, 30] : 20);
            } catch {
              // Haptics are a bonus; a denied vibration must not affect progress.
            }
          }
        } else if (previous && next.total_xp < previous.total_xp) {
          clearTimeout(timer);
          streakVisibleUntilRef.current = 0;
          setReward(null);
        }
        previous = next;
      }).catch(() => {
        // Keep the last known total so a later successful refresh can recover.
      });
    };

    const onChange = () => refresh(true);
    const onFocus = () => refresh();
    refresh();
    window.addEventListener(PROGRESS_CHANGED, onChange);
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener(PROGRESS_CHANGED, onChange);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (reward?.kind !== 'streak') return undefined;
    const previousFocus = document.activeElement;
    streakSceneRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismissReward();
      if (event.key === 'Tab') {
        event.preventDefault();
        streakButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [dismissReward, reward?.id, reward?.kind]);

  if (!reward) return null;

  if (reward.kind === 'streak') {
    const milestone = nextStreakMilestone(reward.streak);
    return (
      <div className="reward-feedback-layer reward-feedback-streak" onClick={dismissReward}>
        <div ref={streakSceneRef} className="reward-streak-scene" role="dialog" aria-modal="true" aria-labelledby="reward-streak-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
          <div className="reward-streak-glow" aria-hidden="true" />
          <div className="reward-streak-art" aria-hidden="true">
            <span className="reward-streak-ring reward-streak-ring-one" />
            <span className="reward-streak-ring reward-streak-ring-two" />
            <span className="reward-streak-shadow" />
            <span className="reward-streak-embers">
              {Array.from({ length: 20 }, (_, index) => {
                const angle = (index * 137.5) * Math.PI / 180;
                const distance = 90 + (index % 5) * 20;
                return <i key={index} style={{ '--ember-x': `${Math.cos(angle) * distance}px`, '--ember-y': `${Math.sin(angle) * distance}px`, '--ember-delay': `${(index % 7) * 75}ms`, '--ember-size': `${3 + (index % 3) * 2}px` }} />;
              })}
            </span>
            <StreakFlame />
          </div>
          <div className="reward-streak-copy">
            <span className="reward-streak-kicker">YOUR FIRE IS GROWING</span>
            <strong className="reward-streak-count">{reward.streak}</strong>
            <h2 id="reward-streak-title">{reward.streak === 1 ? 'DAY STREAK STARTED' : 'DAY STREAK'}</h2>
            <p>{reward.streak === 1 ? 'One day down. Keep showing up.' : 'Another day of showing up. Keep it burning.'}</p>
            <div className="reward-streak-bonuses">
              <span>+{reward.gained} XP</span>
              {reward.goalReached && <span>Daily goal complete</span>}
              {reward.levelUp && <span>Level {reward.level} unlocked</span>}
            </div>
            <div className="reward-streak-milestone">
              <div><span>Next milestone</span><strong>{milestone} days</strong></div>
              <div className="reward-streak-track" role="progressbar" aria-label={`Progress to ${milestone} day streak`} aria-valuemin={0} aria-valuemax={milestone} aria-valuenow={reward.streak}>
                <span style={{ width: `${reward.streak / milestone * 100}%` }} />
              </div>
            </div>
            <button ref={streakButtonRef} type="button" className="reward-streak-continue" onClick={dismissReward}>Keep going</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`reward-feedback-layer reward-feedback-${reward.kind}`} onClick={reward.kind === 'level' ? () => setReward(null) : undefined}>
      {reward.kind === 'level' ? (
        <div key={reward.id} className="reward-level-popup" role="status" aria-atomic="true" onClick={(event) => event.stopPropagation()}>
          <div className="reward-confetti" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </div>
          <button className="reward-dismiss" type="button" aria-label="Dismiss level celebration" onClick={() => setReward(null)}><X size={17} /></button>
          <span className="reward-level-icon" aria-hidden="true"><Trophy size={34} /></span>
          <span className="reward-eyebrow">Level up!</span>
          <strong>Level {reward.level}</strong>
          <span className="reward-level-xp">+{reward.gained} XP · Keep going</span>
        </div>
      ) : (
        <div key={reward.id} className="reward-xp-toast" role="status" aria-atomic="true">
          {reward.kind === 'goal' ? <Sparkles size={20} aria-hidden="true" /> : <Zap size={19} aria-hidden="true" />}
          <span><strong>+{reward.gained} XP</strong>{reward.kind === 'goal' && <small>Daily goal complete!</small>}</span>
        </div>
      )}
    </div>
  );
}
