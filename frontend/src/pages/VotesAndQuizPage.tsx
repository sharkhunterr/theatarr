import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader, ButtonGroup, Button } from '../components/common';
import { VoteSessionManager } from './VoteSessionManager';
import { QuizSessionManager } from './QuizSessionManager';

type Tab = 'votes' | 'quiz';

export function VotesAndQuizPage() {
  const { t } = useTranslation(['votes', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'votes';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiQuizOpen, setAiQuizOpen] = useState(false);

  useEffect(() => {
    if (tab !== 'votes') {
      setSearchParams({ tab });
    } else {
      setSearchParams({});
    }
  }, [tab, setSearchParams]);

  // Reset modals when switching tabs
  useEffect(() => {
    setCreateOpen(false);
    setAiQuizOpen(false);
  }, [tab]);

  return (
    <div>
      <PageHeader
        title={t('votes:page.title')}
        subtitle={t('votes:page.subtitle')}
      />

      <div className="flex items-center justify-between mb-6">
        <ButtonGroup
          options={[
            { key: 'votes' as Tab, label: t('votes:page.tabVotes') },
            { key: 'quiz' as Tab, label: t('votes:page.tabQuiz') },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex items-center gap-2">
          {tab === 'quiz' && (
            <Button size="sm" variant="secondary" onClick={() => setAiQuizOpen(true)} className="h-9">
              <Sparkles className="h-4 w-4" />
              <span className="ml-1.5">{t('votes:page.ai')}</span>
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9">
            <Plus className="h-4 w-4" />
            <span className="ml-1.5">{tab === 'votes' ? t('votes:page.newVote') : t('votes:page.newQuiz')}</span>
          </Button>
        </div>
      </div>

      {tab === 'votes' ? (
        <VoteSessionManager createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      ) : (
        <QuizSessionManager createOpen={createOpen} onCreateOpenChange={setCreateOpen} aiQuizOpen={aiQuizOpen} onAiQuizOpenChange={setAiQuizOpen} />
      )}
    </div>
  );
}
