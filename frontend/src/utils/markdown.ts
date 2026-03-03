/**
 * Lightweight Markdown to HTML renderer with Tailwind classes.
 * Supports: headers, code blocks, inline code, bold, lists, paragraphs.
 */

export function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let inList: 'ul' | 'ol' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        html.push('</code></pre>');
        inCodeBlock = false;
      } else {
        if (inList) { html.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = null; }
        html.push('<pre class="bg-dark-bg/80 border border-dark-border rounded-lg p-3 overflow-x-auto my-2"><code class="text-sm text-dark-text">');
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      html.push(escapeHtml(line) + '\n');
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      if (inList) { html.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = null; }
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList) { html.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = null; }
      html.push(`<h3 class="text-base font-semibold text-dark-text mt-4 mb-1">${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = null; }
      html.push(`<h2 class="text-lg font-semibold text-dark-text mt-5 mb-2">${inline(line.slice(3))}</h2>`);
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line.trimStart())) {
      if (inList !== 'ul') {
        if (inList) html.push('</ol>');
        html.push('<ul class="list-disc list-inside space-y-1 my-2 text-dark-muted">');
        inList = 'ul';
      }
      html.push(`<li class="text-sm">${inline(line.trimStart().slice(2))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.trimStart().match(/^(\d+)\.\s/);
    if (olMatch) {
      if (inList !== 'ol') {
        if (inList) html.push('</ul>');
        html.push('<ol class="list-decimal list-inside space-y-1 my-2 text-dark-muted">');
        inList = 'ol';
      }
      html.push(`<li class="text-sm">${inline(line.trimStart().slice(olMatch[0].length))}</li>`);
      continue;
    }

    // Paragraph
    if (inList) { html.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = null; }
    html.push(`<p class="text-sm text-dark-muted my-1.5 leading-relaxed">${inline(line)}</p>`);
  }

  if (inList) html.push(inList === 'ul' ? '</ul>' : '</ol>');
  if (inCodeBlock) html.push('</code></pre>');

  return html.join('\n');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Process inline formatting: bold, inline code */
function inline(text: string): string {
  let result = escapeHtml(text);
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code class="bg-dark-bg/80 text-theatarr-400 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-dark-text font-semibold">$1</strong>');
  return result;
}
