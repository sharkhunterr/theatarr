/**
 * Hook for accessing help content from i18n.
 * Provides categories, articles, and search functionality.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  articleCount: number;
}

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
}

export function useHelp() {
  const { t, i18n } = useTranslation('help');

  const { categories, articles } = useMemo(() => {
    // Access raw help data from i18n resources
    const helpData = i18n.getResourceBundle(i18n.language, 'help') ||
                     i18n.getResourceBundle('fr', 'help');

    if (!helpData) return { categories: [], articles: [] };

    const rawCategories = helpData.categories || {};
    const rawArticles = helpData.articles || {};

    // Build articles list
    const articlesList: HelpArticle[] = Object.entries(rawArticles).map(
      ([id, data]: [string, any]) => ({
        id,
        category: data.category || '',
        title: data.title || id,
        summary: data.summary || '',
        content: data.content || '',
        keywords: data.keywords || [],
      })
    );

    // Build categories with article counts
    const categoriesList: HelpCategory[] = Object.entries(rawCategories).map(
      ([id, data]: [string, any]) => ({
        id,
        title: data.title || id,
        description: data.description || '',
        icon: data.icon || 'HelpCircle',
        articleCount: articlesList.filter((a) => a.category === id).length,
      })
    );

    return { categories: categoriesList, articles: articlesList };
  }, [i18n.language, t]);

  return {
    categories,

    getArticles(categoryId?: string): HelpArticle[] {
      if (!categoryId) return articles;
      return articles.filter((a) => a.category === categoryId);
    },

    getArticle(id: string): HelpArticle | null {
      return articles.find((a) => a.id === id) || null;
    },

    search(query: string): HelpArticle[] {
      if (query.length < 2) return [];
      const q = query.toLowerCase();
      return articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.toLowerCase().includes(q))
      );
    },
  };
}
