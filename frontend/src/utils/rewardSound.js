// Short, original chimes generated locally; no audio files or network request.
const cues = {
  xp: [[587.33, 0, 0.16], [783.99, 0.1, 0.24]],
  goal: [[523.25, 0, 0.18], [659.25, 0.1, 0.18], [783.99, 0.21, 0.3]],
  level: [[392, 0, 0.18], [523.25, 0.1, 0.18], [659.25, 0.2, 0.2], [783.99, 0.31, 0.24], [1046.5, 0.43, 0.4]],
  streak: [[440, 0, 0.16], [554.37, 0.11, 0.2], [659.25, 0.23, 0.22], [880, 0.38, 0.38]],
};

let audioContext;

export function unlockRewardAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch {
    // Browsers that block audio still show the visual reward.
  }
}

export function stopRewardAudio() {
  if (!audioContext) return;
  const current = audioContext;
  audioContext = undefined;
  try {
    current.close().catch(() => {});
  } catch {
    // Muting remains effective even if closing the device context fails.
  }
}

export function playRewardSound(kind) {
  if (!audioContext || audioContext.state !== 'running' || document.visibilityState !== 'visible') return;

  try {
    const start = audioContext.currentTime + 0.015;
    const volume = kind === 'level' || kind === 'streak' ? 0.045 : 0.035;
    for (const [frequency, delay, duration] of cues[kind] || cues.xp) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + delay;

      oscillator.type = kind === 'level' || kind === 'streak' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    // Audio is optional; a device failure must never interrupt a completion.
  }
}
