'use client';

import { useState, useCallback, useRef } from 'react';

interface MentionUser {
  id: string;
  name: string;
  email: string;
}

export function useMentions(orgId: string) {
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionUser[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  const handleInput = useCallback(async (e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const cursorPosition = textarea.selectionStart;
    const value = textarea.value;

    // Check if we're in a mention (after @)
    const beforeCursor = value.slice(0, cursorPosition);
    const afterAt = beforeCursor.match(/@([\w\s]*)$/);

    if (afterAt) {
      const query = afterAt[1].trim();
      setMentionQuery(query);
      mentionStartRef.current = cursorPosition - afterAt[0].length;

      // Fetch suggestions
      if (query.length >= 1) {
        try {
          const response = await fetch(`/api/users/mentions?orgId=${orgId}&q=${encodeURIComponent(query)}`);
          if (response.ok) {
            const users = await response.json();
            setMentionSuggestions(users);
            setShowMentions(users.length > 0);
            setMentionIndex(0);
          }
        } catch {
          setShowMentions(false);
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
      mentionStartRef.current = -1;
    }
  }, [orgId]);

  const insertMention = useCallback((user: MentionUser) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStartRef.current === -1) return;

    const value = textarea.value;
    const beforeMention = value.slice(0, mentionStartRef.current);
    const afterMention = value.slice(textarea.selectionStart);
    
    // Insert formatted mention
    const mentionText = `@[${user.name}](${user.id}) `;
    textarea.value = beforeMention + mentionText + afterMention;
    
    // Move cursor after mention
    const newPosition = mentionStartRef.current + mentionText.length;
    textarea.setSelectionRange(newPosition, newPosition);
    textarea.focus();

    // Clear mention state
    setShowMentions(false);
    setMentionQuery('');
    mentionStartRef.current = -1;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showMentions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIndex]);
        break;
      case 'Escape':
        setShowMentions(false);
        break;
    }
  }, [showMentions, mentionSuggestions, mentionIndex, insertMention]);

  return {
    textareaRef,
    mentionSuggestions,
    showMentions,
    mentionIndex,
    handleInput,
    handleKeyDown,
    insertMention,
  };
}
