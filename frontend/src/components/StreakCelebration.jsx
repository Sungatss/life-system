import { Flame, X } from 'lucide-react';

const nextStreakMilestone = (streak) => [7, 14, 30, 50, 100].find((day) => day > streak)
  || (Math.floor(streak / 100) + 1) * 100;

export default function StreakCelebration({ reward, onDismiss }) {
  const milestone = nextStreakMilestone(reward.streak);
  return (
    <div className="reward-feedback-layer reward-feedback-streak">
      <section className="reward-streak-card" aria-label="Streak celebration">
        <button type="button" className="reward-dismiss" aria-label="Dismiss streak celebration" onClick={onDismiss}><X size={17} aria-hidden="true" /></button>
        <div className="reward-streak-summary" role="status" aria-atomic="true">
          <span className="reward-streak-kicker">{reward.streak === 1 ? 'A new beginning' : 'You showed up again'}</span>
          <div className="reward-streak-main">
            <div className="reward-streak-badge" aria-hidden="true">
              <svg viewBox="0 0 88 88" fill="none"><circle className="reward-streak-orbit-track" cx="44" cy="44" r="36" /><circle className="reward-streak-orbit" cx="44" cy="44" r="36" pathLength="100" /></svg>
              <Flame className="reward-streak-flame" size={34} strokeWidth={1.7} />
              <i className="reward-streak-spark reward-streak-spark-one" /><i className="reward-streak-spark reward-streak-spark-two" /><i className="reward-streak-spark reward-streak-spark-three" />
            </div>
            <div className="reward-streak-copy">
              <strong className="reward-streak-count"><span className="reward-streak-count-previous" aria-hidden="true">{reward.previousStreak}</span><span className="reward-streak-count-current">{reward.streak}</span></strong>
              <h2>day streak{reward.streak === 1 ? ' started' : ''}</h2>
            </div>
          </div>
          <p className="reward-streak-message">A little progress, every day.</p>
          <div className="reward-streak-bonuses"><span>+{reward.gained} XP</span>{reward.goalReached && <span>Daily goal complete</span>}{reward.levelUp && <span>Level {reward.level} unlocked</span>}</div>
        </div>
        <div className="reward-streak-milestone">
          <div><span>Next milestone</span><strong>{reward.streak} / {milestone} days</strong></div>
          <div className="reward-streak-track" role="progressbar" aria-label={`Progress to ${milestone} day streak`} aria-valuemin={0} aria-valuemax={milestone} aria-valuenow={reward.streak}><span style={{ width: `${reward.streak / milestone * 100}%` }} /></div>
        </div>
      </section>
    </div>
  );
}
