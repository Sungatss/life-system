import { useEffect, useRef, useState } from 'react';
import { Sparkles, Trophy, X, Zap } from 'lucide-react';
import { api, PROGRESS_CHANGED } from '../api/client';
import { playRewardSound } from '../utils/rewardSound';
import './RewardFeedback.css';

export default function RewardFeedback({ soundEnabled }) {
  const [reward, setReward] = useState(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    let active = true;
    let previous = null;
    let timer;
    let queue = Promise.resolve();

    const refresh = (celebrate = false) => {
      // Serialize reads so the initial snapshot is not discarded by a fast first click.
      queue = queue.then(async () => {
        const next = await api.getProgress();
        if (!active) return;

        if (celebrate && previous && next.total_xp > previous.total_xp) {
          const gained = next.total_xp - previous.total_xp;
          const kind = next.level > previous.level ? 'level'
            : previous.today_xp < next.daily_goal && next.today_xp >= next.daily_goal ? 'goal'
              : 'xp';
          clearTimeout(timer);
          setReward({ id: Date.now(), gained, kind, level: next.level });
          timer = setTimeout(() => setReward(null), kind === 'level' ? 5000 : 3000);
          if (soundEnabledRef.current) playRewardSound(kind);

          // Vibration is optional; unsupported browsers simply show the visual reward.
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
              document.visibilityState === 'visible' && typeof navigator.vibrate === 'function') {
            try {
              navigator.vibrate(kind === 'level' ? [45, 35, 70] : kind === 'goal' ? [30, 25, 30] : 20);
            } catch {
              // Haptics are a bonus; a denied vibration must not affect progress.
            }
          }
        } else if (previous && next.total_xp < previous.total_xp) {
          clearTimeout(timer);
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

  if (!reward) return null;

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
