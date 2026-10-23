import { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import './CatPet.css';

const pagePhrases = {
  today: 'A little progress today is enough for me to purr.',
  inbox: 'Let’s sort one thought at a time.',
  tasks: 'Pick one task. I’ll keep the others company.',
  projects: 'Big ideas grow from small, steady steps.',
  goals: 'Your next step is a lovely place to start.',
  calendar: 'There is room to breathe between plans.',
  finance: 'A thoughtful plan is worth sleeping on.',
  habits: 'Tiny repeats make strong roots.',
  profile: 'Look how far your little pawprints have come.',
};

const morePhrases = [
  'One small step still counts. 🐾',
  'You may rest. Your plans will be here later.',
  'Stretch your shoulders. I just did.',
  'Progress can be quiet. I still see it.',
  'Let’s do the next kind thing for future you.',
  'A fresh start fits into any moment.',
  'Drink some water, human. I’ll guard the list.',
  'You don’t have to finish everything today.',
];

function CatIllustration() {
  return <svg className="cat-pet-art" viewBox="0 0 88 88" fill="none" aria-hidden="true">
    <path className="cat-pet-tail" d="M64 68c12 4 20-1 20-11 0-6-3-9-7-10" stroke="#aaa99c" strokeWidth="10" strokeLinecap="round" />
    <ellipse cx="44" cy="69" rx="24" ry="18" fill="#c6c6b9" stroke="#47514e" strokeWidth="2" />
    <ellipse cx="44" cy="72" rx="12" ry="10" fill="#e8e4d7" />
    <path d="M18 34 16 10c0-2 2-3 4-2l15 12c6-2 12-2 18 0L68 8c2-1 4 0 4 2l-2 24c4 7 3 16-3 22-5 6-14 10-23 10S26 62 21 56c-6-6-7-15-3-22Z" fill="#d7d7ca" stroke="#47514e" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="m22 17 1 14 9-9-10-5ZM66 17l-10 5 9 9 1-14Z" fill="#c99fa0" />
    <ellipse cx="33" cy="48" rx="10" ry="7" fill="#e8e4d7" />
    <ellipse cx="55" cy="48" rx="10" ry="7" fill="#e8e4d7" />
    <g className="cat-pet-eyes" fill="#34413d"><ellipse cx="34" cy="39" rx="2.5" ry="3.5" /><ellipse cx="54" cy="39" rx="2.5" ry="3.5" /></g>
    <path d="m40 47 4 3 4-3c-2-2-6-2-8 0Z" fill="#bd858a" />
    <path d="M44 50v3m0 0c-2 3-4 3-6 1m6-1c2 3 4 3 6 1M26 49l-11-2m11 6-11 2m47-6 11-2m-11 6 11 2" stroke="#58625e" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M28 60c9 6 23 7 32 0" stroke="#849f91" strokeWidth="4" strokeLinecap="round" />
    <circle cx="44" cy="65" r="3" fill="#e6c390" />
    <ellipse cx="30" cy="80" rx="8" ry="4" fill="#d7d7ca" stroke="#47514e" strokeWidth="1.5" />
    <ellipse cx="58" cy="80" rx="8" ry="4" fill="#d7d7ca" stroke="#47514e" strokeWidth="1.5" />
  </svg>;
}

export default function CatPet({ activeTab }) {
  const [open, setOpen] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(-1);
  const triggerRef = useRef(null);

  const closeNote = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open]);

  const anotherPhrase = () => {
    if (open) setPhraseIndex((index) => (index + 1) % morePhrases.length);
    else { setPhraseIndex(-1); setOpen(true); }
  };

  return <aside className={`cat-pet${open ? ' is-open' : ''}`} aria-label="Miso the cat">
    {open && <div className="cat-pet-note" id="cat-pet-note">
      <div className="cat-pet-note-head"><span>Miso says</span><button type="button" onClick={closeNote} aria-label="Close Miso's message"><X size={15} aria-hidden="true" /></button></div>
      <p aria-live="polite">{phraseIndex < 0 ? pagePhrases[activeTab] || pagePhrases.today : morePhrases[phraseIndex]}</p>
      <button type="button" className="cat-pet-next" onClick={anotherPhrase}>Another thought <ArrowRight size={14} aria-hidden="true" /></button>
    </div>}
    <button type="button" className="cat-pet-trigger" ref={triggerRef} onClick={anotherPhrase} aria-label={open ? 'Pet Miso for another phrase' : 'Hear a phrase from Miso the cat'} aria-expanded={open} aria-controls={open ? 'cat-pet-note' : undefined} title="Miso the cat">
      <CatIllustration />
      <span>Miso</span>
    </button>
  </aside>;
}
