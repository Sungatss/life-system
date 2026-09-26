import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

export default function DailyNoteEditor({ date, initialContent, onContentSaved }) {
  const [content, setContent] = useState(initialContent || '');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [wordCount, setWordCount] = useState(0);
  const debounceTimerRef = useRef(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    setContent(initialContent || '');
    const words = (initialContent || '').trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setSaveStatus('saved');
    isFirstMount.current = true;
  }, [date, initialContent]);

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

  const handleChange = (e) => {
    const newText = e.target.value;
    setContent(newText);
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

  return (
    <div className="daily-note-container">
      <textarea
        className="daily-note-textarea"
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Write a note... What is on your mind today? Daily reflections, plans, problems, or quick ideas."
        aria-label="Daily note content"
        rows={7}
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
