/**
 * i18next configuration — bundled translations, no HTTP backend.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonFr from './locales/fr/common.json';
import adminFr from './locales/fr/admin.json';
import sessionsFr from './locales/fr/sessions.json';
import votesFr from './locales/fr/votes.json';
import servicesFr from './locales/fr/services.json';
import mediaFr from './locales/fr/media.json';
import settingsFr from './locales/fr/settings.json';
import portalFr from './locales/fr/portal.json';

import commonEn from './locales/en/common.json';
import adminEn from './locales/en/admin.json';
import sessionsEn from './locales/en/sessions.json';
import votesEn from './locales/en/votes.json';
import servicesEn from './locales/en/services.json';
import mediaEn from './locales/en/media.json';
import settingsEn from './locales/en/settings.json';
import portalEn from './locales/en/portal.json';

import commonIt from './locales/it/common.json';
import adminIt from './locales/it/admin.json';
import sessionsIt from './locales/it/sessions.json';
import votesIt from './locales/it/votes.json';
import servicesIt from './locales/it/services.json';
import mediaIt from './locales/it/media.json';
import settingsIt from './locales/it/settings.json';
import portalIt from './locales/it/portal.json';

import commonEs from './locales/es/common.json';
import adminEs from './locales/es/admin.json';
import sessionsEs from './locales/es/sessions.json';
import votesEs from './locales/es/votes.json';
import servicesEs from './locales/es/services.json';
import mediaEs from './locales/es/media.json';
import settingsEs from './locales/es/settings.json';
import portalEs from './locales/es/portal.json';

import commonDe from './locales/de/common.json';
import adminDe from './locales/de/admin.json';
import sessionsDe from './locales/de/sessions.json';
import votesDe from './locales/de/votes.json';
import servicesDe from './locales/de/services.json';
import mediaDe from './locales/de/media.json';
import settingsDe from './locales/de/settings.json';
import portalDe from './locales/de/portal.json';

const SUPPORTED_LANGUAGES = ['fr', 'en', 'it', 'es', 'de'];

// Read persisted language from layoutStore localStorage
function getPersistedLanguage(): string {
  try {
    const raw = localStorage.getItem('theatarr-layout');
    if (raw) {
      const parsed = JSON.parse(raw);
      const lang = parsed?.state?.language;
      if (SUPPORTED_LANGUAGES.includes(lang)) return lang;
    }
  } catch {
    // ignore
  }
  return 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: {
      common: commonFr,
      admin: adminFr,
      sessions: sessionsFr,
      votes: votesFr,
      services: servicesFr,
      media: mediaFr,
      settings: settingsFr,
      portal: portalFr,
    },
    en: {
      common: commonEn,
      admin: adminEn,
      sessions: sessionsEn,
      votes: votesEn,
      services: servicesEn,
      media: mediaEn,
      settings: settingsEn,
      portal: portalEn,
    },
    it: {
      common: commonIt,
      admin: adminIt,
      sessions: sessionsIt,
      votes: votesIt,
      services: servicesIt,
      media: mediaIt,
      settings: settingsIt,
      portal: portalIt,
    },
    es: {
      common: commonEs,
      admin: adminEs,
      sessions: sessionsEs,
      votes: votesEs,
      services: servicesEs,
      media: mediaEs,
      settings: settingsEs,
      portal: portalEs,
    },
    de: {
      common: commonDe,
      admin: adminDe,
      sessions: sessionsDe,
      votes: votesDe,
      services: servicesDe,
      media: mediaDe,
      settings: settingsDe,
      portal: portalDe,
    },
  },
  lng: getPersistedLanguage(),
  fallbackLng: 'fr',
  defaultNS: 'common',
  ns: ['common', 'admin', 'sessions', 'votes', 'services', 'media', 'settings', 'portal'],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
