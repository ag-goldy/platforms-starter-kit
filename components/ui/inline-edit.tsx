'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Check, X, Edit2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface InlineEditTextProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  validate?: (value: string) => string | null;
}

export function InlineEditText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  validate,
}: InlineEditTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (validate) {
      const validationError = validate(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (editValue !== value) {
      setIsSaving(true);
      try {
        await onSave(editValue);
        setIsEditing(false);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className={cn("h-8", inputClassName)}
            placeholder={placeholder}
            disabled={isSaving}
          />
          {error && (
            <span className="text-xs text-red-500 mt-1 block">{error}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-green-600"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-600"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1",
        className
      )}
      onClick={() => setIsEditing(true)}
    >
      <span className={cn("flex-1", !value && "text-gray-400")}>
        {value || placeholder || 'Click to edit'}
      </span>
      <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

interface InlineEditSelectProps {
  value: string;
  options: { value: string; label: string; color?: string }[];
  onSave: (value: string) => Promise<void> | void;
  className?: string;
  placeholder?: string;
}

export function InlineEditSelect({
  value,
  options,
  onSave,
  className,
  placeholder,
}: InlineEditSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (newValue: string) => {
    if (newValue !== value) {
      setIsSaving(true);
      try {
        await onSave(newValue);
      } finally {
        setIsSaving(false);
        setIsEditing(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const selectedOption = options.find((opt) => opt.value === value);

  if (isEditing) {
    return (
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={isSaving}
        open
        onOpenChange={(open) => !open && setIsEditing(false)}
      >
        <SelectTrigger className={cn("h-8 w-auto min-w-[120px]", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                {option.color && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div
      className={cn(
        "group inline-flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-1",
        className
      )}
      onClick={() => setIsEditing(true)}
    >
      {selectedOption?.color && (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: selectedOption.color }}
        />
      )}
      <span className={cn(!value && "text-gray-400")}>
        {selectedOption?.label || placeholder || 'Select...'}
      </span>
      <ChevronDown className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// Badge-style inline edit for status/priority
interface InlineEditBadgeProps {
  value: string;
  options: { value: string; label: string; className: string }[];
  onSave: (value: string) => Promise<void> | void;
  className?: string;
}

export function InlineEditBadge({
  value,
  options,
  onSave,
  className,
}: InlineEditBadgeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (newValue: string) => {
    if (newValue !== value) {
      setIsSaving(true);
      try {
        await onSave(newValue);
      } finally {
        setIsSaving(false);
        setIsEditing(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const selectedOption = options.find((opt) => opt.value === value);

  if (isEditing) {
    return (
      <div className="relative">
        <div className="absolute z-10 bg-white border rounded-lg shadow-lg p-1 min-w-[150px]">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleChange(option.value)}
              disabled={isSaving}
              className={cn(
                "w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-50 transition-colors",
                option.value === value && "bg-gray-50"
              )}
            >
              <span className={cn("inline-block px-2 py-0.5 rounded text-xs", option.className)}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all hover:ring-2 hover:ring-offset-1",
        selectedOption?.className || "bg-gray-100 text-gray-700",
        className
      )}
      disabled={isSaving}
    >
      {selectedOption?.label || value}
      <ChevronDown className="h-3 w-3 opacity-50" />
    </button>
  );
}
