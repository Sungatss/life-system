import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { trapDialogFocus } from '../utils/dialog';
import { Search, X, Calendar, FileText, ArrowRight, Loader2 } from 'lucide-react';

export default function NoteSearchModal({ isOpen, onClose, onSelectDate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSearch = (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.searchNotes(trimmed);
        setResults(data);
      } catch (err) {
        console.error('Note search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    handleSearch(val);
  };

  const handleSelect = (dateStr) => {
    onSelectDate(dateStr);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search notes">
      <div className="modal-content note-search-modal" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { trapDialogFocus(e); if (e.key === 'Escape') onClose(); }}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Search size={18} />
            <h2 className="modal-title">Search Daily Notes</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="note-search-input-box">
          <Search size={16} className="note-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="note-search-field"
            placeholder="Search past thoughts, ideas, decisions..."
            value={query}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          {loading && <Loader2 size={16} className="spin-loader" />}
        </div>

        {/* Results List */}
        <div className="note-search-results">
          {results.length > 0 ? (
            <div className="note-search-list">
              <div className="note-search-count">
                Found {results.length} {results.length === 1 ? 'note' : 'notes'} matching "{query}"
              </div>
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="note-search-item"
                  onClick={() => handleSelect(item.date)}
                >
                  <div className="note-search-item-header">
                    <div className="note-search-date">
                      <Calendar size={13} />
                      <span>{item.date}</span>
                    </div>
                    <span className="note-search-meta">{item.word_count} words</span>
                  </div>
                  <p className="note-search-snippet">{item.snippet}</p>
                  <div className="note-search-action">
                    <span>Jump to note</span>
                    <ArrowRight size={13} />
                  </div>
                </button>
              ))}
            </div>
          ) : hasSearched && !loading ? (
            <div className="note-search-empty">
              <FileText size={32} />
              <p>No notes found containing "{query}"</p>
              <span>Try searching for different keywords or reflections</span>
            </div>
          ) : !hasSearched ? (
            <div className="note-search-placeholder">
              <p>Type keywords to search across all your daily notes, journal entries, and reflections.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
