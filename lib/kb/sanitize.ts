/**
 * HTML Sanitization for Knowledge Base Articles
 *
 * Uses DOMPurify to sanitize HTML content before rendering.
 * This prevents XSS attacks while allowing safe HTML elements.
 */

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "a",
  "strong",
  "em",
  "u",
  "s",
  "del",
  "ins",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "caption",
  "div",
  "span",
];

const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "class",
  "id",
  "target",
  "rel",
  "width",
  "height",
  "style",
];

/**
 * Sanitize HTML content for safe rendering
 */
export function sanitizeArticleContent(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    SANITIZE_DOM: true,
  });
}

/**
 * Strip HTML tags for plain text preview
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate excerpt from HTML content
 */
export function generateExcerpt(html: string, maxLength: number = 150): string {
  const plainText = stripHtml(html);
  if (plainText.length <= maxLength) return plainText;
  return plainText.slice(0, maxLength).trim() + "...";
}
