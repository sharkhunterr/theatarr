import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/common';
import { TrailersManager } from './TrailersManager';

export function MediaAndTemplatesPage() {
  const { t } = useTranslation(['media', 'common']);

  return (
    <div>
      <PageHeader
        title={t('media:page.title')}
        subtitle={t('media:page.subtitle')}
      />
      <TrailersManager />
    </div>
  );
}
