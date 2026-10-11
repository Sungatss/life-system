import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import {
  Sparkles,
  Plus,
  Bold,
  Italic,
  Heading2,
  List,
  CheckSquare,
  Quote,
  Code,
  Eye,
  Edit3
} from 'lucide-react';
import { marked } from 'marked';

// Configure marked for clean GFM parsing
marked.use({
  gfm: true,
  breaks: true,
});

const REFLECTION_PROMPTS = [
  '### Progress',
  '### Blockers',
  '### Next step',
];

const FULL_TEMPLATE = `${REFLECTION_PROMPTS[0]}\n\n\n${REFLECTION_PROMPTS[1]}\n\n\n${REFLECTION_PROMPTS[2]}\n\n`;

export default function DailyNoteEditor({ date, initialContent, onContentSaved }) {
  const [content, setContent] = useState(initialContent || '');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [wordCount, setWordCount] = useState(0);
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'
  const debounceTimerRef = useRef(null);
  const textareaRef = useRef(null);
  const contentRef = useRef(initialContent || '');
  const initializedDateRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (initializedDateRef.current === date) return;
    initializedDateRef.current = date;
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
        const pendingText = contentRef.current;
        saveQueueRef.current = saveQueueRef.current
          .catch(() => {})
          .then(() => api.saveNote(date, pendingText))
          .catch((e) => console.error('Unmount save failed', e));
      }
    };
  }, [date]);

  const performSave = (textToSave) => {
    setSaveStatus('saving');
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(async () => {
      try {
        await api.saveNote(date, textToSave);
        if (textToSave === contentRef.current) setSaveStatus('saved');
        if (onContentSaved) onContentSaved(textToSave);
      } catch (err) {
        console.error('Failed to save daily note:', err);
        if (textToSave === contentRef.current) setSaveStatus('error');
      }
    });
    return saveQueueRef.current;
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

  // Markdown Formatting Helper
  const applyMarkdown = (prefix, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content;
    const selectedText = text.substring(start, end) || defaultText;

    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = `${before}${prefix}${selectedText}${suffix}${after}`;

    updateAndSave(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 0);
  };

  const insertPrompt = (promptText) => {
    let nextContent = content;
    if (!content.trim()) {
      nextContent = `${promptText}\n\n`;
    } else {
      nextContent = `${content.trimEnd()}\n\n${promptText}\n\n`;
    }
    updateAndSave(nextContent);
    setActiveTab('write');
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
    setActiveTab('write');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Preview mode task list toggle handler
  const handlePreviewClick = (e) => {
    if (e.target && e.target.type === 'checkbox') {
      const checkboxIndex = Array.from(
        e.currentTarget.querySelectorAll('input[type="checkbox"]')
      ).indexOf(e.target);

      if (checkboxIndex !== -1) {
        let count = -1;
        const updated = content.replace(/- \[( |x|X)\]/g, (match) => {
          count++;
          if (count === checkboxIndex) {
            return match === '- [ ]' ? '- [x]' : '- [ ]';
          }
          return match;
        });
        updateAndSave(updated);
      }
    }
  };

  const renderedHtml = activeTab === 'preview' ? marked.parse(content || '') : '';

  return (
    <div className="daily-note-container">
      {/* Editor Top Bar with Mode Tabs & Formatting */}
      <div className="note-top-bar">
        {/* Write / Preview Tab Switcher */}
        <div className="note-tab-switcher">
          <button
            type="button"
            className={`note-tab-btn ${activeTab === 'write' ? 'active' : ''}`}
            onClick={() => setActiveTab('write')}
          >
            <Edit3 size={13} />
            <span>Write</span>
          </button>
          <button
            type="button"
            className={`note-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
        </div>

        {/* Formatting Toolbar (Visible in Write Mode) */}
        {activeTab === 'write' && (
          <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => applyMarkdown('**', '**', 'bold')}
              title="Bold"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => applyMarkdown('*', '*', 'italic')}
              title="Italic"
            >
              <Italic size={13} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => applyMarkdown('### ', '', 'Heading')}
              title="Heading"
            >
              <Heading2 size={13} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => applyMarkdown('- ', '', 'List item')}
              title="Bullet list"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => applyMarkdown('- [ ] ', '', 'Task item')}
              title="Checklist"
            >
              <CheckSquare size={13} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => applyMarkdown('> ', '', 'Quote')}
              title="Quote"
            >
              <Quote size={13} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => applyMarkdown('`', '`', 'code')}
              title="Code"
            >
              <Code size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Reflection Prompts Quick Inserters */}
      <div className="note-prompts-bar">
        <span className="note-prompts-label">Prompts</span>
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
          onClick={() => insertPrompt(REFLECTION_PROMPTS[0])}
          title="Insert progress heading"
        >
          <Plus size={11} />
          <span>Progress</span>
        </button>
        <button
          type="button"
          className="note-prompt-btn"
          onClick={() => insertPrompt(REFLECTION_PROMPTS[1])}
          title="Insert blockers heading"
        >
          <Plus size={11} />
          <span>Blockers</span>
        </button>
        <button
          type="button"
          className="note-prompt-btn"
          onClick={() => insertPrompt(REFLECTION_PROMPTS[2])}
          title="Insert next step heading"
        >
          <Plus size={11} />
          <span>Next step</span>
        </button>
      </div>

      {/* Main Content: Write Mode vs Preview Mode */}
      {activeTab === 'write' ? (
        <textarea
          ref={textareaRef}
          className="daily-note-textarea"
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Write a note"
          aria-label="Daily note content"
          rows={9}
        />
      ) : (
        <div
          className="daily-note-preview markdown-body"
          onClick={handlePreviewClick}
          dangerouslySetInnerHTML={{
            __html:
              renderedHtml ||
              '<p class="preview-empty">No note yet.</p>',
          }}
        />
      )}

      {/* Footer Status & Word Counter */}
      <div className="daily-note-footer">
        <div className="save-status">
          <div className={`save-indicator ${saveStatus}`} />
          <span>
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Error saving. Check connection.'}
          </span>
        </div>
        <div className="note-footer-meta">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        </div>
      </div>
    </div>
  );
}
