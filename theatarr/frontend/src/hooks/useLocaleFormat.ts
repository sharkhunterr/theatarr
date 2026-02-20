/**
 * Hook for locale-aware date/time formatting.
 * Replaces all hardcoded 'fr-FR' / 'en-US' locale strings.
 */

import { useTranslation } from 'react-i18next';

const LOCALE_MAP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  it: 'it-IT',
  es: 'es-ES',
  de: 'de-DE',
};

export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const locale = LOCALE_MAP[i18n.language] || 'fr-FR';

  return {
    locale,

    formatDate: (date: string | Date, options?: Intl.DateTimeFormatOptions) =>
      new Date(date).toLocaleDateString(locale, options),

    formatTime: (date: string | Date, options?: Intl.DateTimeFormatOptions) =>
      new Date(date).toLocaleTimeString(locale, options ?? { hour: '2-digit', minute: '2-digit' }),

    formatDateTime: (date: string | Date, options?: Intl.DateTimeFormatOptions) =>
      new Date(date).toLocaleString(locale, options),
  };
}
