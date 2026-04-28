/**
 * Shared formatting utilities used across the application.
 *
 * Keeping these in one place means any change to display logic (e.g.
 * switching from KB to KiB) is made once and propagates everywhere.
 */

/**
 * Convert a byte count into a human-readable size string.
 *
 * @param {number} bytes - File size in bytes.
 * @returns {string} e.g. "1.4 MB", "512 B"
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Convert a duration in seconds into a human-readable countdown string.
 *
 * Returns "—" for non-finite or negative values (e.g. when ETA can't be
 * computed yet because not enough bytes have transferred).
 *
 * @param {number} seconds - Duration in seconds.
 * @returns {string} e.g. "45s", "2m 10s", "—"
 */
export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Repair markdown tables that have been flattened onto a single line.
 *
 * Some GPT responses include valid markdown table syntax but with the row
 * separator squashed onto one line (no physical newlines between pipe chars).
 * This function detects that pattern and injects the missing line breaks so
 * ReactMarkdown renders the table correctly.
 *
 * @param {string} text - Raw markdown string from the bot.
 * @returns {string} Markdown with pipe-separated rows on their own lines.
 */
export function formatFlattenedTable(text) {
  if (!text) return text;
  // Only repair when a separator row is present but newlines between cells are missing
  if (text.includes('|---|') && !text.includes('\n|')) {
    return text.replace(/\|\s+(?=\|)/g, '|\n');
  }
  return text;
}
