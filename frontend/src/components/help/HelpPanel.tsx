/**
 * Floating help panel — contextual help bubble (bottom-right).
 * Shows help articles relevant to the current page.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  HelpCircle,
  X,
  ChevronRight,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useHelp, type HelpArticle } from '../../hooks/useHelp';
import { renderMarkdown } from '../../utils/markdown';

/** Map URL paths to help category IDs */
const PAGE_HELP_MAP: Record<string, string> = {
  '/': 'getting-started',
  '/sessions': 'sessions',
  '/sessions/new': 'sessions',
  '/votes': 'votes-quiz',
  '/services': 'services',
  '/media': 'media',
  '/settings': 'settings',
  '/users': 'settings',
  '/logs': 'settings',
  '/history': 'sessions',
  '/portal': 'portal',
  '/portal/sessions': 'portal',
  '/portal/votes': 'portal',
  '/portal/quiz': 'portal',
  '/portal/profile': 'portal',
};

function resolveCategory(pathname: string): string {
  // Exact match first
  if (PAGE_HELP_MAP[pathname]) return PAGE_HELP_MAP[pathname];

  // Pattern match: /sessions/:id/edit → sessions, /portal/sessions/:id → portal
  if (pathname.startsWith('/portal/')) return 'portal';
  if (pathname.startsWith('/sessions/')) return 'sessions';
  if (pathname.startsWith('/votes/') || pathname.startsWith('/quiz/')) return 'votes-quiz';

  return 'getting-started';
}

export function HelpPanel() {
  const { t } = useTranslation('help');
  const location = useLocation();
  const { getArticles, getArticle } = useHelp();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const category = resolveCategory(location.pathname);
  const articles = useMemo(() => getArticles(category), [category, getArticles]);
  const selectedArticle = selectedArticleId ? getArticle(selectedArticleId) : null;

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setSelectedArticleId(null);
  }, [location.pathname]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Determine help page path based on current location
  const helpPagePath = location.pathname.startsWith('/portal') ? '/portal/help' : '/help';

  return (
    <div ref={panelRef} className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[380px] max-h-[500px] bg-dark-surface border border-dark-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-surface">
            {selectedArticle ? (
              <button
                onClick={() => setSelectedArticleId(null)}
                className="flex items-center gap-1.5 text-sm text-dark-muted hover:text-dark-text transition-colors"
              >
                <ArrowLeft size={14} />
                {t('panel.backToList')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-theatarr-400" />
                <span className="text-sm font-semibold text-dark-text">{t('panel.title')}</span>
              </div>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-dark-border/50 text-dark-muted hover:text-dark-text transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {selectedArticle ? (
              <ArticleContent article={selectedArticle} />
            ) : (
              <ArticleList
                articles={articles}
                noArticlesText={t('panel.noArticles')}
                onSelect={setSelectedArticleId}
              />
            )}
          </div>

          {/* Footer — link to full help page */}
          {!selectedArticle && (
            <div className="border-t border-dark-border px-4 py-2.5">
              <Link
                to={helpPagePath}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 text-xs text-theatarr-400 hover:text-theatarr-300 transition-colors"
              >
                <BookOpen size={12} />
                {t('panel.allHelp')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setSelectedArticleId(null);
        }}
        className={clsx(
          'h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200',
          isOpen
            ? 'bg-dark-border text-dark-text'
            : 'bg-theatarr-500 hover:bg-theatarr-600 text-white'
        )}
        aria-label={t('panel.title')}
      >
        {isOpen ? <X size={20} /> : <HelpCircle size={20} />}
      </button>
    </div>
  );
}

// --- Sub-components ---

function ArticleList({
  articles,
  noArticlesText,
  onSelect,
}: {
  articles: HelpArticle[];
  noArticlesText: string;
  onSelect: (id: string) => void;
}) {
  if (articles.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-dark-muted">
        {noArticlesText}
      </div>
    );
  }

  return (
    <div className="py-1">
      {articles.map((article) => (
        <button
          key={article.id}
          onClick={() => onSelect(article.id)}
          className="w-full px-4 py-3 text-left hover:bg-dark-border/30 transition-colors flex items-start gap-3 group"
        >
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-dark-text group-hover:text-theatarr-400 transition-colors">
              {article.title}
            </h4>
            <p className="text-xs text-dark-muted mt-0.5 line-clamp-2">
              {article.summary}
            </p>
          </div>
          <ChevronRight
            size={14}
            className="text-dark-muted mt-0.5 flex-shrink-0 group-hover:text-theatarr-400 transition-colors"
          />
        </button>
      ))}
    </div>
  );
}

function ArticleContent({ article }: { article: HelpArticle }) {
  return (
    <div className="px-4 py-3">
      <h3 className="text-base font-semibold text-dark-text mb-2">
        {article.title}
      </h3>
      <div
        className="help-content"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
      />
    </div>
  );
}
