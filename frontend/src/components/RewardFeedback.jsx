import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Trophy, X, Zap } from 'lucide-react';
import { api, PROGRESS_CHANGED } from '../api/client';
import { playRewardSound } from '../utils/rewardSound';
import StreakCelebration from './StreakCelebration';
import './RewardFeedback.css';

const streakDuration = 4500;

export default function RewardFeedback({ soundEnabled }) {
  const [reward, setReward] = useState(null);
  const soundEnabledRef = useRef(soundEnabled);
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
            streakVisibleUntilRef.current = Date.now() + streakDuration;
            setReward({ id, gained, kind, streak: next.streak, previousStreak: previous.streak, level: next.level, levelUp, goalReached });
            timer = setTimeout(() => {
              streakVisibleUntilRef.current = 0;
              setReward((current) => current?.id === id ? null : current);
            }, streakDuration);
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
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismissReward();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dismissReward, reward?.id, reward?.kind]);

  if (!reward) return null;

  if (reward.kind === 'streak') {
    return <StreakCelebration key={reward.id} reward={reward} onDismiss={dismissReward} />;
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
