import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, ButtonGroup, Button } from '../components/common';
import { VoteSessionManager } from './VoteSessionManager';
import { QuizSessionManager } from './QuizSessionManager';
import { useLayoutStore } from '../stores/layoutStore';

type Tab = 'votes' | 'quiz';

export function VotesAndQuizPage() {
  const { language } = useLayoutStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'votes';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (tab !== 'votes') {
      setSearchParams({ tab });
    } else {
      setSearchParams({});
    }
  }, [tab, setSearchParams]);

  // Reset create modal when switching tabs
  useEffect(() => {
    setCreateOpen(false);
  }, [tab]);

  const t = {
    title: 'Votes & Quiz',
    subtitle: language === 'fr'
      ? 'Gérez vos sessions de vote et quiz interactifs'
      : 'Manage your vote sessions and interactive quizzes',
    newVote: language === 'fr' ? 'Nouveau vote' : 'New vote',
    newQuiz: language === 'fr' ? 'Nouveau quiz' : 'New quiz',
  };

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
      />

      <div className="flex items-center justify-between mb-6">
        <ButtonGroup
          options={[
            { key: 'votes' as Tab, label: language === 'fr' ? 'Votes' : 'Votes' },
            { key: 'quiz' as Tab, label: 'Quiz' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9">
          <Plus className="h-4 w-4" />
          <span className="ml-1.5">{tab === 'votes' ? t.newVote : t.newQuiz}</span>
        </Button>
      </div>

      {tab === 'votes' ? (
        <VoteSessionManager createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      ) : (
        <QuizSessionManager createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      )}
    </div>
  );
}
