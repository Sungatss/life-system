import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Sparkles, Plus } from 'lucide-react';

const REFLECTION_EXAMPLES = [
  '#### What exactly did I do today that will help me achieve my goal?',
  '#### what has prevented me from being productive and needs to be changed',
  '#### "Am I fully unlocking the potential inside me?"',
];

const FULL_TEMPLATE = `${REFLECTION_EXAMPLES[0]}\n\n\n${REFLECTION_EXAMPLES[1]}\n\n\n${REFLECTION_EXAMPLES[2]}\n\n`;

export default function DailyNoteEditor({ date, initialContent, onContentSaved }) {
  const [content, setContent] = useState(initialContent || '');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [wordCount, setWordCount] = useState(0);
  const debounceTimerRef = useRef(null);
  const textareaRef = useRef(null);
  const contentRef = useRef(initialContent || '');

  useEffect(() => {
    setContent(initialContent || '');
    contentRef.current = initialContent || '';
    const words = (initialContent || '').trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setSaveStatus('saved');
  }, [date, initialContent]);

  // Flush any pending save on unmount or before navigating away
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        api.saveNote(date, contentRef.current).catch((e) => console.error('Unmount save failed', e));
      }
    };
  }, [date]);

  const performSave = async (textToSave) => {
    setSaveStatus('saving');
    try {
      await api.saveNote(date, textToSave);
      setSaveStatus('saved');
      if (onContentSaved) {
        onContentSaved(textToSave);
      }
    } catch (err) {
      console.error('Failed to save daily note:', err);
      setSaveStatus('error');
    }
  };

  const updateAndSave = (newText) => {
    setContent(newText);
    contentRef.current = newText;
    const words = newText.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave(newText);
    }, 600);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      performSave(contentRef.current);
    }
  };

  const handleChange = (e) => {
    updateAndSave(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Ctrl+S or Cmd+S quick save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      performSave(content);
    }
  };

  const insertPrompt = (promptText) => {
    let nextContent = content;
    if (!content.trim()) {
      nextContent = `${promptText}\n\n`;
    } else {
      nextContent = `${content.trimEnd()}\n\n${promptText}\n\n`;
    }
    updateAndSave(nextContent);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const insertAllPrompts = () => {
    let nextContent = content;
    if (!content.trim()) {
      nextContent = FULL_TEMPLATE;
    } else {
      nextContent = `${content.trimEnd()}\n\n${FULL_TEMPLATE}`;
    }
    updateAndSave(nextContent);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const placeholderText = `Write a note... For example:\n\n${REFLECTION_EXAMPLES[0]}\n\n${REFLECTION_EXAMPLES[1]}\n\n${REFLECTION_EXAMPLES[2]}`;

  return (
    <div className="daily-note-container">
      {/* Reflection Prompts Toolbar */}
      <div className="note-prompts-bar">
        <span className="note-prompts-label">Reflection prompts:</span>
        <button
          type="button"
          className="note-prompt-btn"
          onClick={insertAllPrompts}
          title="Insert full reflection template"
        >
          <Sparkles size={11} />
          <span>Insert template</span>
        </button>
        <button
          type="button"
          className="note-prompt-btn"
          onClick={() => insertPrompt(REFLECTION_EXAMPLES[0])}
          title="Insert goal achievement prompt"
        >
          <Plus size={11} />
          <span>1. Goal progress</span>
        </button>
        <button
          type="button"
          className="note-prompt-btn"
          onClick={() => insertPrompt(REFLECTION_EXAMPLES[1])}
          title="Insert productivity blockers prompt"
        >
          <Plus size={11} />
          <span>2. Blockers</span>
        </button>
        <button
          type="button"
          className="note-prompt-btn"
          onClick={() => insertPrompt(REFLECTION_EXAMPLES[2])}
          title="Insert unlocking potential prompt"
        >
          <Plus size={11} />
          <span>3. Unlocking potential</span>
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="daily-note-textarea"
        value={content}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholderText}
        aria-label="Daily note content"
        rows={8}
      />

      <div className="daily-note-footer">
        <div className="save-status">
          <div className={`save-indicator ${saveStatus}`} />
          <span>
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Error saving. Check connection.'}
          </span>
        </div>
        <div>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </div>
      </div>
    </div>
  );
}
