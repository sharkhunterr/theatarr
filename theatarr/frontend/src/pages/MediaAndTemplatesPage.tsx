import { PageHeader } from '../components/common';
import { TrailersManager } from './TrailersManager';
import { useLayoutStore } from '../stores/layoutStore';

export function MediaAndTemplatesPage() {
  const { language } = useLayoutStore();

  const t = {
    title: language === 'fr' ? 'Médias' : 'Media',
    subtitle: language === 'fr'
      ? 'Bandes-annonces, pré-rolls, sons et modèles d\'affichage'
      : 'Trailers, pre-rolls, sounds and display templates',
  };

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
      />
      <TrailersManager />
    </div>
  );
}
