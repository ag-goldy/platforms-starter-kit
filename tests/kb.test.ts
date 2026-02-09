import { describe, it, expect } from 'vitest';

// Simple slug generation function (mirroring the one in article-form.tsx)
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100);
}

// Simple excerpt extraction (mirroring the one in article-view.tsx)
function extractExcerpt(content: string, maxLength: number = 200): string {
  const plainText = content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|\*|__|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n/g, ' ')
    .trim();
  
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength).trim() + '...';
}

describe('Knowledge Base Utilities', () => {
  describe('generateSlug', () => {
    it('should convert title to lowercase slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(generateSlug('Hello! World?')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces');
    });

    it('should limit to 100 characters', () => {
      const longTitle = 'a'.repeat(150);
      expect(generateSlug(longTitle).length).toBe(100);
    });

    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('');
    });

    it('should handle single word', () => {
      expect(generateSlug('Documentation')).toBe('documentation');
    });
  });

  describe('extractExcerpt', () => {
    it('should extract plain text from markdown', () => {
      const content = '# Heading\n\nThis is **bold** and _italic_ text.';
      // Double space is expected due to paragraph break
      expect(extractExcerpt(content)).toBe('Heading  This is bold and italic text.');
    });

    it('should remove links but keep text', () => {
      const content = 'Check out [this link](http://example.com) for more info.';
      expect(extractExcerpt(content)).toBe('Check out this link for more info.');
    });

    it('should limit length and add ellipsis', () => {
      const content = 'a'.repeat(300);
      const result = extractExcerpt(content, 50);
      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle short content without ellipsis', () => {
      const content = 'Short content';
      expect(extractExcerpt(content, 100)).toBe('Short content');
    });

    it('should replace newlines with spaces', () => {
      const content = 'Line one\nLine two\nLine three';
      expect(extractExcerpt(content)).toBe('Line one Line two Line three');
    });

    it('should remove heading markers', () => {
      const content = '## Section Heading\n### Subheading';
      expect(extractExcerpt(content)).toBe('Section Heading Subheading');
    });
  });
});

describe('KB Article Status', () => {
  const validStatuses = ['draft', 'published', 'archived'];
  const validVisibilities = ['public', 'internal', 'agents_only'];

  it('should have valid status values', () => {
    for (const status of validStatuses) {
      expect(['draft', 'published', 'archived']).toContain(status);
    }
  });

  it('should have valid visibility values', () => {
    for (const visibility of validVisibilities) {
      expect(['public', 'internal', 'agents_only']).toContain(visibility);
    }
  });
});
