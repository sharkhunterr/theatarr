/**
 * Full help page with categories, articles, search.
 * Accessible at /help (admin) and /portal/help (portal).
 */

import { useState, useMemo } from 'react';
import {
  Search,
  ArrowLeft,
  ChevronRight,
  Rocket,
  Clapperboard,
  Layers,
  Vote,
  Film,
  Plug,
  Settings,
  UserCircle,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHelp, type HelpCategory, type HelpArticle } from '../hooks/useHelp';
import { renderMarkdown } from '../utils/markdown';

const ICON_MAP: Record<string, LucideIcon> = {
  Rocket,
  Clapperboard,
  Layers,
  Vote,
  Film,
  Plug,
  Settings,
  UserCircle,
  HelpCircle,
};

export function HelpPage() {
  const { t } = useTranslation('help');
  const { categories, getArticles, getArticle, search } = useHelp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const searchResults = useMemo(
    () => (searchQuery.length >= 2 ? search(searchQuery) : []),
    [searchQuery, search]
  );

  const categoryArticles = useMemo(
    () => (selectedCategory ? getArticles(selectedCategory) : []),
    [selectedCategory, getArticles]
  );

  const selectedArticle = selectedArticleId ? getArticle(selectedArticleId) : null;

  // Determine current view
  const isSearching = searchQuery.length >= 2;
  const showArticle = !!selectedArticle;
  const showArticleList = !!selectedCategory && !showArticle;
  const showCategories = !showArticle && !showArticleList;

  const selectedCat = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-text">{t('page.title')}</h1>
        <p className="text-dark-muted text-sm mt-1">{t('page.subtitle')}</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedCategory(null);
            setSelectedArticleId(null);
          }}
          placeholder={t('page.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-theatarr-500/50"
        />
      </div>

      {/* Breadcrumb navigation */}
      {(showArticleList || showArticle) && !isSearching && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedArticleId(null);
            }}
            className="text-theatarr-400 hover:text-theatarr-300 transition-colors"
          >
            {t('page.backToCategories')}
          </button>
          {showArticleList && selectedCat && (
            <>
              <ChevronRight size={14} className="text-dark-muted" />
              <span className="text-dark-text">{selectedCat.title}</span>
            </>
          )}
          {showArticle && selectedCat && (
            <>
              <ChevronRight size={14} className="text-dark-muted" />
              <button
                onClick={() => setSelectedArticleId(null)}
                className="text-theatarr-400 hover:text-theatarr-300 transition-colors"
              >
                {selectedCat.title}
              </button>
              <ChevronRight size={14} className="text-dark-muted" />
              <span className="text-dark-text truncate max-w-[200px]">
                {selectedArticle?.title}
              </span>
            </>
          )}
        </div>
      )}

      {/* Search results */}
      {isSearching && (
        <div>
          {searchResults.length === 0 ? (
            <div className="text-center py-12 text-dark-muted text-sm">
              {t('page.noResults')}
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((article) => (
                <ArticleListItem
                  key={article.id}
                  article={article}
                  categories={categories}
                  onClick={() => {
                    setSelectedArticleId(article.id);
                    setSelectedCategory(article.category);
                    setSearchQuery('');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category grid */}
      {showCategories && !isSearching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              articlesLabel={t('page.articles')}
              onClick={() => setSelectedCategory(cat.id)}
            />
          ))}
        </div>
      )}

      {/* Article list for selected category */}
      {showArticleList && !isSearching && (
        <div className="space-y-2">
          {categoryArticles.map((article) => (
            <ArticleListItem
              key={article.id}
              article={article}
              categories={categories}
              onClick={() => setSelectedArticleId(article.id)}
            />
          ))}
        </div>
      )}

      {/* Full article view */}
      {showArticle && !isSearching && selectedArticle && (
        <div className="bg-dark-surface border border-dark-border rounded-xl p-6">
          <button
            onClick={() => setSelectedArticleId(null)}
            className="flex items-center gap-1.5 text-sm text-dark-muted hover:text-dark-text transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            {t('page.backToArticles')}
          </button>
          <h2 className="text-xl font-bold text-dark-text mb-4">
            {selectedArticle.title}
          </h2>
          <div
            className="help-content"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(selectedArticle.content),
            }}
          />
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function CategoryCard({
  category,
  articlesLabel,
  onClick,
}: {
  category: HelpCategory;
  articlesLabel: string;
  onClick: () => void;
}) {
  const Icon = ICON_MAP[category.icon] || HelpCircle;

  return (
    <button
      onClick={onClick}
      className="bg-dark-surface border border-dark-border rounded-xl p-5 text-left hover:border-theatarr-500/50 transition-colors group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-theatarr-500/15 flex items-center justify-center">
          <Icon size={20} className="text-theatarr-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-dark-text group-hover:text-theatarr-400 transition-colors">
            {category.title}
          </h3>
          <span className="text-xs text-dark-muted">
            {category.articleCount} {articlesLabel}
          </span>
        </div>
      </div>
      <p className="text-xs text-dark-muted leading-relaxed">
        {category.description}
      </p>
    </button>
  );
}

function ArticleListItem({
  article,
  categories,
  onClick,
}: {
  article: HelpArticle;
  categories: HelpCategory[];
  onClick: () => void;
}) {
  const cat = categories.find((c) => c.id === article.category);
  const Icon = cat ? ICON_MAP[cat.icon] || HelpCircle : HelpCircle;

  return (
    <button
      onClick={onClick}
      className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-3 text-left hover:border-theatarr-500/50 transition-colors flex items-start gap-3 group"
    >
      <div className="h-8 w-8 rounded-lg bg-theatarr-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-theatarr-400" />
      </div>
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
        className="text-dark-muted mt-1 flex-shrink-0 group-hover:text-theatarr-400 transition-colors"
      />
    </button>
  );
}
