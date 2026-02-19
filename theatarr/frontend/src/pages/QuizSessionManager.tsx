import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Play,
  Square,
  Trash2,
  Copy,
  Eye,
  Link2,
  BarChart2,
  HelpCircle,
  Check,
  SkipForward,
  Users,
  UserPlus,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Loader2,
  RefreshCw,
  Shuffle,
} from 'lucide-react';
import { Button, Card, Modal, Spinner, ButtonGroup } from '../components/common';
import { apiClient } from '../api/client';
import { useLayoutStore } from '../stores/layoutStore';

interface QuizQuestion {
  text: string;
  choices: string[];
  correct_indices: number[];
  allow_multiple: boolean;
  time_limit_seconds: number | null;
  hint: string | null;
  image_url: string | null;
}

interface QuizConfig {
  show_live_results: 'anonymous' | 'named' | 'disabled';
  show_scores_live: boolean;
  auto_advance: boolean;
  default_time_limit_seconds: number;
  show_feedback: boolean;
  feedback_delay_seconds: number;
}

interface QuizSession {
  id: string;
  name: string;
  description?: string;
  status: string;
  questions: QuizQuestion[];
  config: QuizConfig;
  current_question_index: number;
  question_count: number;
  participant_count: number;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

interface QuizToken {
  id: string;
  token: string;
  label?: string;
  participant_name?: string;
  is_active: boolean;
  joined_at?: string;
  quiz_url?: string;
}

interface QuizScoreboardEntry {
  token_id: string;
  participant_name: string;
  score: number;
  total_answered: number;
  avg_response_time_ms: number | null;
}

interface QuizResults {
  quiz_session_id: string;
  status: string;
  question_count: number;
  scoreboard: QuizScoreboardEntry[];
  question_stats: Array<{
    question_index: number;
    total_answers: number;
    correct_count: number;
    distribution: Record<string, number>;
  }>;
}

interface QuizSessionListResponse {
  items: QuizSession[];
  total: number;
}

const defaultConfig: QuizConfig = {
  show_live_results: 'anonymous',
  show_scores_live: false,
  auto_advance: true,
  default_time_limit_seconds: 30,
  show_feedback: true,
  feedback_delay_seconds: 5,
};

const emptyQuestion: QuizQuestion = {
  text: '',
  choices: ['', ''],
  correct_indices: [0],
  allow_multiple: false,
  time_limit_seconds: null,
  hint: null,
  image_url: null,
};

interface QuizSessionManagerProps {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  aiQuizOpen?: boolean;
  onAiQuizOpenChange?: (open: boolean) => void;
}

export function QuizSessionManager({ createOpen, onCreateOpenChange, aiQuizOpen, onAiQuizOpenChange }: QuizSessionManagerProps = {}) {
  const queryClient = useQueryClient();
  const { language } = useLayoutStore();
  const [selectedSession, setSelectedSession] = useState<QuizSession | null>(null);
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const isCreateOpen = createOpen ?? internalCreateOpen;
  const setIsCreateOpen = onCreateOpenChange ?? setInternalCreateOpen;
  const [isTokensOpen, setIsTokensOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [tokens, setTokens] = useState<QuizToken[]>([]);
  const [filter, setFilter] = useState<'all' | 'draft' | 'open' | 'active' | 'completed'>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const t = {
    title: 'Quiz',
    subtitle: language === 'fr' ? 'Créez et gérez des quiz interactifs' : 'Create and manage interactive quizzes',
    createButton: language === 'fr' ? 'Nouveau quiz' : 'New Quiz',
    all: language === 'fr' ? 'Tous' : 'All',
    draft: language === 'fr' ? 'Brouillon' : 'Draft',
    open: language === 'fr' ? 'Ouvert' : 'Open',
    active: language === 'fr' ? 'En cours' : 'Active',
    completed: language === 'fr' ? 'Terminé' : 'Completed',
    questions: language === 'fr' ? 'questions' : 'questions',
    participants: language === 'fr' ? 'participants' : 'participants',
    openQuiz: language === 'fr' ? 'Ouvrir' : 'Open',
    startQuiz: language === 'fr' ? 'Démarrer' : 'Start',
    nextQuestion: language === 'fr' ? 'Question suivante' : 'Next Question',
    endQuiz: language === 'fr' ? 'Terminer' : 'End',
    tokens: language === 'fr' ? 'Liens' : 'Links',
    results: language === 'fr' ? 'Résultats' : 'Results',
    delete: language === 'fr' ? 'Supprimer' : 'Delete',
    noSessions: language === 'fr' ? 'Aucun quiz' : 'No quizzes',
    createFirst: language === 'fr' ? 'Créer votre premier quiz' : 'Create Your First Quiz',
    generateTokens: language === 'fr' ? 'Générer 5 liens' : 'Generate 5 Links',
    noTokens: language === 'fr' ? 'Aucun lien généré.' : 'No links generated yet.',
    copied: language === 'fr' ? 'Copié !' : 'Copied!',
    invite: language === 'fr' ? 'Inviter' : 'Invite',
  };

  const { data, isLoading, error } = useQuery<QuizSessionListResponse>({
    queryKey: ['quiz-sessions', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status_filter=${filter}` : '';
      return await apiClient.get<QuizSessionListResponse>(`/quiz-sessions${params}`);
    },
  });

  const openMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/quiz-sessions/${sessionId}/open`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] }),
  });

  const startMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/quiz-sessions/${sessionId}/start`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] }),
  });

  const nextQuestionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/quiz-sessions/${sessionId}/next-question`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] }),
  });

  const endMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/quiz-sessions/${sessionId}/end`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(`/quiz-sessions/${sessionId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] }),
  });

  const createTokensMutation = useMutation({
    mutationFn: async ({ sessionId, count }: { sessionId: string; count: number }) => {
      return await apiClient.post<{ items: QuizToken[]; total: number }>(`/quiz-sessions/${sessionId}/tokens`, { count });
    },
    onSuccess: (data) => setTokens(data.items),
  });

  const fetchTokensMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiClient.get<{ items: QuizToken[]; total: number }>(`/quiz-sessions/${sessionId}/tokens`);
    },
    onSuccess: (data) => setTokens(data.items),
  });

  const handleViewTokens = async (session: QuizSession) => {
    setSelectedSession(session);
    await fetchTokensMutation.mutateAsync(session.id);
    setIsTokensOpen(true);
  };

  const handleViewResults = (session: QuizSession) => {
    setSelectedSession(session);
    setIsResultsOpen(true);
  };

  const handleDelete = async (session: QuizSession) => {
    if (window.confirm(`${language === 'fr' ? 'Supprimer le quiz' : 'Delete quiz'} "${session.name}"?`)) {
      await deleteMutation.mutateAsync(session.id);
    }
  };

  const copyToClipboard = (text: string, tokenId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      completed: 'bg-dark-muted/20 text-dark-muted border-dark-muted/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status] || styles.draft;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: t.draft,
      open: t.open,
      active: t.active,
      completed: t.completed,
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {language === 'fr' ? 'Erreur lors du chargement des quiz' : 'Failed to load quizzes'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <ButtonGroup
          options={[
            { key: 'all' as const, label: t.all },
            { key: 'draft' as const, label: t.draft },
            { key: 'open' as const, label: t.open },
            { key: 'active' as const, label: t.active },
            { key: 'completed' as const, label: t.completed },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Sessions List */}
      {data?.items && data.items.length > 0 ? (
        <div className="space-y-2">
          {data.items.map((session) => (
            <Card key={session.id} className="overflow-hidden">
              <div className="p-3">
                {/* Header Row */}
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-theatarr-500/20 flex items-center justify-center flex-shrink-0">
                    <HelpCircle size={18} className="text-theatarr-500" />
                  </div>

                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-dark-text truncate">
                        {session.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(session.status)}`}
                      >
                        {getStatusLabel(session.status)}
                      </span>
                    </div>
                    {session.description && (
                      <p className="text-dark-muted text-sm mb-2 line-clamp-1">{session.description}</p>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-dark-muted">
                      <span className="flex items-center gap-1">
                        <HelpCircle size={12} />
                        {session.question_count} {t.questions}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {session.participant_count} {t.participants}
                      </span>
                      {session.status === 'active' && (
                        <span className="text-green-400">
                          Q{session.current_question_index + 1}/{session.question_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dark-border">
                  {session.status === 'draft' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openMutation.mutate(session.id)}
                      disabled={openMutation.isPending}
                    >
                      <Play size={14} className="mr-1" />
                      {t.openQuiz}
                    </Button>
                  )}

                  {session.status === 'open' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startMutation.mutate(session.id)}
                      disabled={startMutation.isPending}
                    >
                      <Play size={14} className="mr-1" />
                      {t.startQuiz}
                    </Button>
                  )}

                  {session.status === 'active' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => nextQuestionMutation.mutate(session.id)}
                        disabled={nextQuestionMutation.isPending}
                      >
                        <SkipForward size={14} className="mr-1" />
                        {t.nextQuestion}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => endMutation.mutate(session.id)}
                        disabled={endMutation.isPending}
                      >
                        <Square size={14} className="mr-1" />
                        {t.endQuiz}
                      </Button>
                    </>
                  )}

                  {(session.status === 'draft' || session.status === 'open' || session.status === 'active') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedSession(session); setIsInviteOpen(true); }}
                    >
                      <UserPlus size={14} className="mr-1" />
                      {t.invite}
                    </Button>
                  )}

                  {(session.status === 'open' || session.status === 'active') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTokens(session)}
                    >
                      <Link2 size={14} className="mr-1" />
                      {t.tokens}
                    </Button>
                  )}

                  {(session.status === 'active' || session.status === 'completed') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewResults(session)}
                    >
                      <BarChart2 size={14} className="mr-1" />
                      {t.results}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(session)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <HelpCircle size={32} className="mx-auto text-dark-muted mb-3" />
          <p className="text-sm text-dark-muted mb-3">{t.noSessions}</p>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={14} className="mr-1" />
            {t.createFirst}
          </Button>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={language === 'fr' ? 'Nouveau quiz' : 'New Quiz'}
        size="lg"
      >
        <QuizCreateForm
          language={language}
          onSave={() => {
            setIsCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
          }}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* Tokens Modal */}
      <Modal
        isOpen={isTokensOpen}
        onClose={() => {
          setIsTokensOpen(false);
          setTokens([]);
        }}
        title={`${t.tokens} - ${selectedSession?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-dark-border">
            <Button
              onClick={() => {
                if (selectedSession) {
                  createTokensMutation.mutate({ sessionId: selectedSession.id, count: 5 });
                }
              }}
              disabled={createTokensMutation.isPending}
            >
              <Plus size={14} className="mr-2" />
              {t.generateTokens}
            </Button>
          </div>

          {tokens.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 bg-dark-surface rounded-lg border border-dark-border"
                >
                  <div className="min-w-0 flex-1">
                    <code className="text-theatarr-500 font-mono text-sm">{token.token}</code>
                    {token.label && (
                      <span className="text-dark-muted text-sm ml-2">{token.label}</span>
                    )}
                    {token.participant_name && (
                      <span className="text-green-400 text-sm ml-2">{token.participant_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {token.quiz_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(token.quiz_url!, token.id)}
                        className={copiedToken === token.id ? 'text-green-400' : ''}
                      >
                        {copiedToken === token.id ? (
                          <>
                            <Check size={14} className="mr-1" />
                            {t.copied}
                          </>
                        ) : (
                          <Copy size={14} />
                        )}
                      </Button>
                    )}
                    <a
                      href={`/quiz/${token.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-dark-border rounded transition-colors"
                    >
                      <Eye size={14} className="text-dark-muted" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dark-muted text-center py-8">{t.noTokens}</p>
          )}
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        title={`${t.results} - ${selectedSession?.name}`}
        size="lg"
      >
        {selectedSession && <QuizResultsAdmin session={selectedSession} language={language} />}
      </Modal>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title={`${t.invite} - ${selectedSession?.name}`}
      >
        {selectedSession && (
          <QuizInviteUsers
            sessionId={selectedSession.id}
            language={language}
            onDone={() => {
              setIsInviteOpen(false);
              queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
            }}
          />
        )}
      </Modal>

      {/* AI Quiz Generator Modal */}
      <Modal
        isOpen={aiQuizOpen ?? false}
        onClose={() => onAiQuizOpenChange?.(false)}
        title={language === 'fr' ? 'Générer un quiz par IA' : 'AI Quiz Generator'}
        size="lg"
      >
        <AIQuizGenerator
          language={language}
          onCreated={() => {
            onAiQuizOpenChange?.(false);
            queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
          }}
          onCancel={() => onAiQuizOpenChange?.(false)}
        />
      </Modal>
    </div>
  );
}

// ============================================================================
// Quiz Create Form
// ============================================================================

interface QuizTemplate {
  id: string;
  name: string;
  template_type: string;
}

function QuizCreateForm({
  language,
  onSave,
  onCancel,
}: {
  language: 'en' | 'fr';
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([{ ...emptyQuestion }]);
  const [config, setConfig] = useState<QuizConfig>({ ...defaultConfig });
  const [expandedQuestion, setExpandedQuestion] = useState<number>(0);
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Fetch quiz templates
  const { data: templatesData } = useQuery<{ items: QuizTemplate[] }>({
    queryKey: ['templates-quiz'],
    queryFn: () => apiClient.get<{ items: QuizTemplate[] }>('/templates'),
    select: (data) => ({
      items: data.items.filter((t) => t.template_type === 'quiz'),
    }),
  });

  // Auto-select first quiz template if none selected
  useState(() => {
    if (!templateId && templatesData?.items?.[0]) {
      setTemplateId(templatesData.items[0].id);
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post('/quiz-sessions', {
        name,
        description: description || undefined,
        questions,
        config,
        template_id: templateId || undefined,
      });
    },
    onSuccess: () => onSave(),
  });

  const addQuestion = () => {
    setQuestions([...questions, { ...emptyQuestion }]);
    setExpandedQuestion(questions.length);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
    if (expandedQuestion >= questions.length - 1) {
      setExpandedQuestion(Math.max(0, questions.length - 2));
    }
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const addChoice = (qIndex: number) => {
    const q = questions[qIndex];
    if (q.choices.length >= 6) return;
    updateQuestion(qIndex, { choices: [...q.choices, ''] });
  };

  const removeChoice = (qIndex: number, cIndex: number) => {
    const q = questions[qIndex];
    if (q.choices.length <= 2) return;
    const newChoices = q.choices.filter((_, i) => i !== cIndex);
    const newCorrect = q.correct_indices
      .filter((i) => i !== cIndex)
      .map((i) => (i > cIndex ? i - 1 : i));
    updateQuestion(qIndex, {
      choices: newChoices,
      correct_indices: newCorrect.length > 0 ? newCorrect : [0],
    });
  };

  const updateChoice = (qIndex: number, cIndex: number, value: string) => {
    const q = questions[qIndex];
    const newChoices = [...q.choices];
    newChoices[cIndex] = value;
    updateQuestion(qIndex, { choices: newChoices });
  };

  const toggleCorrect = (qIndex: number, cIndex: number) => {
    const q = questions[qIndex];
    if (q.allow_multiple) {
      const newCorrect = q.correct_indices.includes(cIndex)
        ? q.correct_indices.filter((i) => i !== cIndex)
        : [...q.correct_indices, cIndex];
      updateQuestion(qIndex, { correct_indices: newCorrect.length > 0 ? newCorrect : [cIndex] });
    } else {
      updateQuestion(qIndex, { correct_indices: [cIndex] });
    }
  };

  const isValid = name.trim().length > 0 && questions.every(
    (q) => q.text.trim().length > 0 && q.choices.every((c) => c.trim().length > 0) && q.correct_indices.length > 0
  );

  const quizTemplates = templatesData?.items || [];

  const tForm = {
    name: language === 'fr' ? 'Nom du quiz' : 'Quiz Name',
    description: language === 'fr' ? 'Description (optionnel)' : 'Description (optional)',
    displayTemplate: language === 'fr' ? 'Template d\'affichage' : 'Display Template',
    noTemplate: language === 'fr' ? 'Aucun' : 'None',
    questions: language === 'fr' ? 'Questions' : 'Questions',
    addQuestion: language === 'fr' ? 'Ajouter une question' : 'Add Question',
    questionText: language === 'fr' ? 'Question' : 'Question',
    choices: language === 'fr' ? 'Choix' : 'Choices',
    addChoice: language === 'fr' ? 'Ajouter un choix' : 'Add Choice',
    correctAnswer: language === 'fr' ? 'Bonne réponse' : 'Correct answer',
    allowMultiple: language === 'fr' ? 'Plusieurs réponses' : 'Multiple answers',
    timeLimit: language === 'fr' ? 'Temps (s)' : 'Time (s)',
    hint: language === 'fr' ? 'Indice' : 'Hint',
    config: language === 'fr' ? 'Configuration' : 'Configuration',
    liveResults: language === 'fr' ? 'Résultats en direct' : 'Live results',
    anonymous: language === 'fr' ? 'Anonyme' : 'Anonymous',
    named: language === 'fr' ? 'Nommé' : 'Named',
    disabled: language === 'fr' ? 'Désactivé' : 'Disabled',
    showScoresLive: language === 'fr' ? 'Scores en direct' : 'Live scores',
    autoAdvance: language === 'fr' ? 'Avancer auto si tous ont répondu' : 'Auto-advance when all answered',
    defaultTimeLimit: language === 'fr' ? 'Temps par défaut (s)' : 'Default time (s)',
    showFeedback: language === 'fr' ? 'Afficher les bonnes réponses entre les questions' : 'Show correct answers between questions',
    feedbackDelay: language === 'fr' ? 'Délai d\'affichage (s)' : 'Display delay (s)',
    save: language === 'fr' ? 'Créer' : 'Create',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Name & Description */}
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tForm.name}
          className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-theatarr-500"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tForm.description}
          className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-theatarr-500"
        />
        {quizTemplates.length > 0 && (
          <div>
            <label className="text-xs text-dark-muted mb-1 block">{tForm.displayTemplate}</label>
            <select
              value={templateId || ''}
              onChange={(e) => setTemplateId(e.target.value || null)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:border-theatarr-500 text-sm"
            >
              <option value="">{tForm.noTemplate}</option>
              {quizTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Questions */}
      <div>
        <h3 className="text-sm font-medium text-dark-text mb-3">{tForm.questions}</h3>
        <div className="space-y-3">
          {questions.map((question, qIndex) => (
            <div key={qIndex} className="border border-dark-border rounded-lg overflow-hidden">
              {/* Question header */}
              <button
                onClick={() => setExpandedQuestion(expandedQuestion === qIndex ? -1 : qIndex)}
                className="w-full flex items-center justify-between p-3 bg-dark-surface hover:bg-dark-border/50 transition-colors"
              >
                <span className="text-sm font-medium text-dark-text">
                  Q{qIndex + 1}: {question.text || (language === 'fr' ? '(sans titre)' : '(untitled)')}
                </span>
                <div className="flex items-center gap-2">
                  {questions.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeQuestion(qIndex); }}
                      className="p-1 hover:bg-red-500/20 rounded text-red-400"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {expandedQuestion === qIndex ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Question body */}
              {expandedQuestion === qIndex && (
                <div className="p-3 space-y-3 bg-dark-bg">
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
                    placeholder={tForm.questionText}
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-theatarr-500"
                  />

                  {/* Choices */}
                  <div className="space-y-2">
                    <label className="text-xs text-dark-muted">{tForm.choices}</label>
                    {question.choices.map((choice, cIndex) => (
                      <div key={cIndex} className="flex items-center gap-2">
                        <button
                          onClick={() => toggleCorrect(qIndex, cIndex)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            question.correct_indices.includes(cIndex)
                              ? 'border-green-500 bg-green-500/20'
                              : 'border-dark-border hover:border-dark-muted'
                          }`}
                          title={tForm.correctAnswer}
                        >
                          {question.correct_indices.includes(cIndex) && (
                            <Check size={12} className="text-green-400" />
                          )}
                        </button>
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)}
                          placeholder={`${language === 'fr' ? 'Choix' : 'Choice'} ${cIndex + 1}`}
                          className="flex-1 px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-dark-text placeholder-dark-muted text-sm focus:outline-none focus:border-theatarr-500"
                        />
                        {question.choices.length > 2 && (
                          <button
                            onClick={() => removeChoice(qIndex, cIndex)}
                            className="p-1 hover:bg-red-500/20 rounded text-dark-muted hover:text-red-400"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {question.choices.length < 6 && (
                      <button
                        onClick={() => addChoice(qIndex)}
                        className="text-sm text-theatarr-500 hover:text-theatarr-400"
                      >
                        + {tForm.addChoice}
                      </button>
                    )}
                  </div>

                  {/* Options row */}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <label className="flex items-center gap-2 text-sm text-dark-muted">
                      <input
                        type="checkbox"
                        checked={question.allow_multiple}
                        onChange={(e) => updateQuestion(qIndex, { allow_multiple: e.target.checked })}
                        className="rounded"
                      />
                      {tForm.allowMultiple}
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-dark-muted">{tForm.timeLimit}</label>
                      <input
                        type="number"
                        value={question.time_limit_seconds ?? ''}
                        onChange={(e) =>
                          updateQuestion(qIndex, {
                            time_limit_seconds: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        placeholder={String(config.default_time_limit_seconds)}
                        className="w-16 px-2 py-1 bg-dark-surface border border-dark-border rounded text-dark-text text-sm focus:outline-none focus:border-theatarr-500"
                      />
                    </div>
                  </div>

                  {/* Hint */}
                  <input
                    type="text"
                    value={question.hint ?? ''}
                    onChange={(e) => updateQuestion(qIndex, { hint: e.target.value || null })}
                    placeholder={tForm.hint}
                    className="w-full px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-dark-text placeholder-dark-muted text-sm focus:outline-none focus:border-theatarr-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addQuestion}
          className="mt-3 text-sm text-theatarr-500 hover:text-theatarr-400 font-medium"
        >
          + {tForm.addQuestion}
        </button>
      </div>

      {/* Config */}
      <div>
        <h3 className="text-sm font-medium text-dark-text mb-3">{tForm.config}</h3>
        <div className="space-y-3 p-3 bg-dark-surface rounded-lg border border-dark-border">
          <div className="flex items-center gap-3">
            <label className="text-sm text-dark-muted min-w-[140px]">{tForm.liveResults}</label>
            <select
              value={config.show_live_results}
              onChange={(e) =>
                setConfig({ ...config, show_live_results: e.target.value as QuizConfig['show_live_results'] })
              }
              className="px-2 py-1 bg-dark-bg border border-dark-border rounded text-dark-text text-sm focus:outline-none focus:border-theatarr-500"
            >
              <option value="anonymous">{tForm.anonymous}</option>
              <option value="named">{tForm.named}</option>
              <option value="disabled">{tForm.disabled}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-dark-muted">
            <input
              type="checkbox"
              checked={config.show_scores_live}
              onChange={(e) => setConfig({ ...config, show_scores_live: e.target.checked })}
              className="rounded"
            />
            {tForm.showScoresLive}
          </label>
          <label className="flex items-center gap-2 text-sm text-dark-muted">
            <input
              type="checkbox"
              checked={config.auto_advance}
              onChange={(e) => setConfig({ ...config, auto_advance: e.target.checked })}
              className="rounded"
            />
            {tForm.autoAdvance}
          </label>
          <div className="flex items-center gap-3">
            <label className="text-sm text-dark-muted min-w-[140px]">{tForm.defaultTimeLimit}</label>
            <input
              type="number"
              value={config.default_time_limit_seconds}
              onChange={(e) =>
                setConfig({ ...config, default_time_limit_seconds: parseInt(e.target.value) || 30 })
              }
              className="w-20 px-2 py-1 bg-dark-bg border border-dark-border rounded text-dark-text text-sm focus:outline-none focus:border-theatarr-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-dark-muted">
            <input
              type="checkbox"
              checked={config.show_feedback}
              onChange={(e) => setConfig({ ...config, show_feedback: e.target.checked })}
              className="rounded"
            />
            {tForm.showFeedback}
          </label>
          {config.show_feedback && (
            <div className="flex items-center gap-3 ml-6">
              <label className="text-sm text-dark-muted min-w-[140px]">{tForm.feedbackDelay}</label>
              <input
                type="number"
                min={2}
                max={30}
                value={config.feedback_delay_seconds}
                onChange={(e) =>
                  setConfig({ ...config, feedback_delay_seconds: Math.min(30, Math.max(2, parseInt(e.target.value) || 5)) })
                }
                className="w-20 px-2 py-1 bg-dark-bg border border-dark-border rounded text-dark-text text-sm focus:outline-none focus:border-theatarr-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
        <Button variant="ghost" onClick={onCancel}>
          {tForm.cancel}
        </Button>
        <Button onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending}>
          {tForm.save}
        </Button>
      </div>

      {createMutation.isError && (
        <p className="text-red-400 text-sm">
          {(createMutation.error as Error)?.message || 'Error creating quiz'}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Quiz Results Admin
// ============================================================================

function QuizResultsAdmin({ session, language }: { session: QuizSession; language: 'en' | 'fr' }) {
  const { data, isLoading } = useQuery<QuizResults>({
    queryKey: ['quiz-results', session.id],
    queryFn: async () => {
      return await apiClient.get<QuizResults>(`/quiz-sessions/${session.id}/results`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-dark-muted text-center py-8">
        {language === 'fr' ? 'Aucun résultat disponible' : 'No results available'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scoreboard */}
      <div>
        <h3 className="text-sm font-medium text-dark-text mb-3">
          {language === 'fr' ? 'Classement' : 'Scoreboard'}
        </h3>
        {data.scoreboard.length > 0 ? (
          <div className="space-y-2">
            {data.scoreboard.map((entry, idx) => (
              <div
                key={entry.token_id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  idx === 0
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : idx === 1
                    ? 'bg-gray-400/10 border-gray-400/30'
                    : idx === 2
                    ? 'bg-amber-700/10 border-amber-700/30'
                    : 'bg-dark-surface border-dark-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-dark-muted w-8">{idx + 1}</span>
                  <span className="text-dark-text font-medium">{entry.participant_name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-dark-text font-bold">
                    {entry.score}/{entry.total_answered}
                  </span>
                  {entry.avg_response_time_ms && (
                    <span className="text-dark-muted">
                      {(entry.avg_response_time_ms / 1000).toFixed(1)}s avg
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-muted text-center py-4">
            {language === 'fr' ? 'Aucun participant' : 'No participants'}
          </p>
        )}
      </div>

      {/* Question Stats */}
      <div>
        <h3 className="text-sm font-medium text-dark-text mb-3">
          {language === 'fr' ? 'Statistiques par question' : 'Per-Question Stats'}
        </h3>
        <div className="space-y-3">
          {data.question_stats.map((stat) => (
            <div key={stat.question_index} className="p-3 bg-dark-surface rounded-lg border border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-dark-text">
                  Q{stat.question_index + 1}
                  {session.questions?.[stat.question_index] && (
                    <span className="text-dark-muted ml-2 font-normal">
                      {session.questions[stat.question_index].text.substring(0, 50)}
                      {session.questions[stat.question_index].text.length > 50 ? '...' : ''}
                    </span>
                  )}
                </span>
                <span className="text-sm text-dark-muted">
                  {stat.correct_count}/{stat.total_answers} {language === 'fr' ? 'correct' : 'correct'}
                </span>
              </div>
              {/* Distribution bar */}
              {session.questions?.[stat.question_index] && (
                <div className="space-y-1">
                  {session.questions[stat.question_index].choices.map((choice, cIdx) => {
                    const count = stat.distribution[String(cIdx)] || 0;
                    const pct = stat.total_answers > 0 ? (count / stat.total_answers) * 100 : 0;
                    const isCorrect = session.questions[stat.question_index].correct_indices.includes(cIdx);
                    return (
                      <div key={cIdx} className="flex items-center gap-2 text-xs">
                        <span className={`w-32 truncate ${isCorrect ? 'text-green-400' : 'text-dark-muted'}`}>
                          {isCorrect && <Check size={10} className="inline mr-1" />}
                          {choice}
                        </span>
                        <div className="flex-1 h-4 bg-dark-bg rounded overflow-hidden">
                          <div
                            className={`h-full rounded ${isCorrect ? 'bg-green-500/50' : 'bg-dark-border'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-dark-muted w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quiz Invite Users
// ============================================================================

interface InviteUser {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
}

// ============================================================================
// AI Quiz Generator (The Trivia API)
// ============================================================================

const TRIVIA_CATEGORIES = [
  { slug: 'film_and_tv', label: { fr: 'Film & TV', en: 'Film & TV' } },
  { slug: 'music', label: { fr: 'Musique', en: 'Music' } },
  { slug: 'general_knowledge', label: { fr: 'Culture générale', en: 'General Knowledge' } },
  { slug: 'arts_and_literature', label: { fr: 'Arts & Littérature', en: 'Arts & Literature' } },
  { slug: 'science', label: { fr: 'Science', en: 'Science' } },
  { slug: 'history', label: { fr: 'Histoire', en: 'History' } },
  { slug: 'geography', label: { fr: 'Géographie', en: 'Geography' } },
  { slug: 'sport_and_leisure', label: { fr: 'Sport & Loisirs', en: 'Sport & Leisure' } },
  { slug: 'society_and_culture', label: { fr: 'Société & Culture', en: 'Society & Culture' } },
  { slug: 'food_and_drink', label: { fr: 'Gastronomie', en: 'Food & Drink' } },
];

const TRIVIA_DIFFICULTIES = [
  { key: 'mixed', label: { fr: 'Mélangé', en: 'Mixed' } },
  { key: 'easy', label: { fr: 'Facile', en: 'Easy' } },
  { key: 'medium', label: { fr: 'Moyen', en: 'Medium' } },
  { key: 'hard', label: { fr: 'Difficile', en: 'Hard' } },
];

interface TriviaApiQuestion {
  id: string;
  category: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  question: { text: string };
  tags: string[];
  type: string;
  difficulty: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function convertTriviaToQuiz(triviaQuestions: TriviaApiQuestion[]): QuizQuestion[] {
  return triviaQuestions.map((tq) => {
    const allChoices = shuffleArray([tq.correctAnswer, ...tq.incorrectAnswers]);
    const correctIndex = allChoices.indexOf(tq.correctAnswer);
    return {
      text: tq.question.text,
      choices: allChoices,
      correct_indices: [correctIndex],
      allow_multiple: false,
      time_limit_seconds: null,
      hint: null,
      image_url: null,
    };
  });
}

function AIQuizGenerator({
  language,
  onCreated,
  onCancel,
}: {
  language: 'en' | 'fr';
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'config' | 'preview'>('config');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('film_and_tv');
  const [difficulty, setDifficulty] = useState('mixed');
  const [questionCount, setQuestionCount] = useState(10);
  const [tags, setTags] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);
  const [triviaRaw, setTriviaRaw] = useState<TriviaApiQuestion[]>([]);
  const [creating, setCreating] = useState(false);

  const t = {
    quizName: language === 'fr' ? 'Nom du quiz' : 'Quiz name',
    category: language === 'fr' ? 'Catégorie' : 'Category',
    difficulty: language === 'fr' ? 'Difficulté' : 'Difficulty',
    questionCount: language === 'fr' ? 'Nombre de questions' : 'Number of questions',
    tags: language === 'fr' ? 'Tags (optionnel)' : 'Tags (optional)',
    tagsHelp: language === 'fr' ? 'Séparer par des virgules (ex: james_bond, marvel)' : 'Comma separated (e.g. james_bond, marvel)',
    generate: language === 'fr' ? 'Générer' : 'Generate',
    regenerate: language === 'fr' ? 'Regénérer' : 'Regenerate',
    create: language === 'fr' ? 'Créer le quiz' : 'Create quiz',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
    back: language === 'fr' ? 'Retour' : 'Back',
    preview: language === 'fr' ? 'Aperçu des questions' : 'Questions preview',
    generating: language === 'fr' ? 'Génération en cours...' : 'Generating...',
    noQuestions: language === 'fr' ? 'Aucune question trouvée pour ces critères.' : 'No questions found for these criteria.',
    englishNote: language === 'fr' ? 'Les questions sont en anglais (API gratuite).' : 'Questions are in English (free API).',
    correct: language === 'fr' ? 'Correcte' : 'Correct',
    source: language === 'fr' ? 'Source : The Trivia API' : 'Source: The Trivia API',
    shuffleChoices: language === 'fr' ? 'Mélanger les choix' : 'Shuffle choices',
  };

  const fetchQuestions = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(questionCount));
      params.set('categories', category);
      params.set('types', 'text_choice');
      if (difficulty !== 'mixed') {
        params.set('difficulties', difficulty);
      }
      if (tags.trim()) {
        params.set('tags', tags.trim().replace(/\s*,\s*/g, ','));
      }

      const response = await fetch(`https://the-trivia-api.com/v2/questions?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data: TriviaApiQuestion[] = await response.json();

      if (data.length === 0) {
        setFetchError(t.noQuestions);
        setFetching(false);
        return;
      }

      setTriviaRaw(data);
      setGeneratedQuestions(convertTriviaToQuiz(data));

      // Auto-generate name if empty
      if (!name.trim()) {
        const catLabel = TRIVIA_CATEGORIES.find((c) => c.slug === category)?.label[language] || category;
        const diffLabel = difficulty !== 'mixed'
          ? ` - ${TRIVIA_DIFFICULTIES.find((d) => d.key === difficulty)?.label[language]}`
          : '';
        setName(`Quiz ${catLabel}${diffLabel}`);
      }

      setStep('preview');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFetching(false);
    }
  };

  const reshuffleAll = () => {
    setGeneratedQuestions(convertTriviaToQuiz(triviaRaw));
  };

  const createQuiz = async () => {
    setCreating(true);
    try {
      await apiClient.post('/quiz-sessions', {
        name: name.trim() || 'AI Quiz',
        description: `${t.source} (${TRIVIA_CATEGORIES.find((c) => c.slug === category)?.label[language]})`,
        questions: generatedQuestions,
        config: { ...defaultConfig },
      });
      onCreated();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to create quiz');
    } finally {
      setCreating(false);
    }
  };

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-dark-text">{name}</h3>
            <p className="text-xs text-dark-muted">{generatedQuestions.length} questions &middot; {t.englishNote}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={reshuffleAll} title={t.shuffleChoices}>
              <Shuffle size={14} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setStep('config'); setFetchError(null); }}>
              <RefreshCw size={14} className="mr-1" />
              {t.regenerate}
            </Button>
          </div>
        </div>

        {/* Questions preview */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {generatedQuestions.map((q, idx) => (
            <div key={idx} className="p-3 bg-dark-bg rounded-lg border border-dark-border">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xs font-mono text-dark-muted bg-dark-surface px-1.5 py-0.5 rounded flex-shrink-0">
                  {idx + 1}
                </span>
                <p className="text-sm text-dark-text">{q.text}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-7">
                {q.choices.map((choice, cIdx) => (
                  <div
                    key={cIdx}
                    className={`text-xs px-2 py-1 rounded ${
                      q.correct_indices.includes(cIdx)
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : 'bg-dark-surface text-dark-muted border border-dark-border'
                    }`}
                  >
                    {q.correct_indices.includes(cIdx) && <Check size={10} className="inline mr-1" />}
                    {choice}
                  </div>
                ))}
              </div>
              {triviaRaw[idx] && (
                <div className="flex items-center gap-2 mt-1.5 ml-7">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    triviaRaw[idx].difficulty === 'easy'
                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                      : triviaRaw[idx].difficulty === 'medium'
                      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}>
                    {triviaRaw[idx].difficulty}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Name input */}
        <div>
          <label className="text-xs text-dark-muted mb-1 block">{t.quizName}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-theatarr-500 text-sm"
          />
        </div>

        {fetchError && (
          <p className="text-red-400 text-sm">{fetchError}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-dark-border">
          <Button variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button onClick={createQuiz} disabled={creating || generatedQuestions.length === 0}>
            {creating ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
            {t.create}
          </Button>
        </div>
      </div>
    );
  }

  // Step: config
  return (
    <div className="space-y-5">
      {/* Quiz name */}
      <div>
        <label className="text-xs text-dark-muted mb-1 block">{t.quizName}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={language === 'fr' ? 'Auto-généré si vide' : 'Auto-generated if empty'}
          className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-theatarr-500 text-sm"
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-xs text-dark-muted mb-1 block">{t.category}</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:border-theatarr-500 text-sm"
        >
          {TRIVIA_CATEGORIES.map((cat) => (
            <option key={cat.slug} value={cat.slug}>{cat.label[language]}</option>
          ))}
        </select>
      </div>

      {/* Difficulty */}
      <div>
        <label className="text-xs text-dark-muted mb-1 block">{t.difficulty}</label>
        <div className="flex gap-2 flex-wrap">
          {TRIVIA_DIFFICULTIES.map((diff) => (
            <button
              key={diff.key}
              onClick={() => setDifficulty(diff.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                difficulty === diff.key
                  ? 'bg-theatarr-500 text-white border-theatarr-500'
                  : 'bg-dark-surface text-dark-muted border-dark-border hover:border-dark-muted'
              }`}
            >
              {diff.label[language]}
            </button>
          ))}
        </div>
      </div>

      {/* Question count */}
      <div>
        <label className="text-xs text-dark-muted mb-1 block">{t.questionCount}: {questionCount}</label>
        <input
          type="range"
          min={5}
          max={20}
          step={5}
          value={questionCount}
          onChange={(e) => setQuestionCount(parseInt(e.target.value))}
          className="w-full accent-theatarr-500"
        />
        <div className="flex justify-between text-[10px] text-dark-muted mt-1">
          <span>5</span><span>10</span><span>15</span><span>20</span>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs text-dark-muted mb-1 block">{t.tags}</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t.tagsHelp}
          className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-theatarr-500 text-sm"
        />
      </div>

      {/* English note */}
      <p className="text-xs text-dark-muted italic">{t.englishNote}</p>

      {fetchError && (
        <p className="text-red-400 text-sm">{fetchError}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-dark-border">
        <Button variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button onClick={fetchQuestions} disabled={fetching}>
          {fetching ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
          {fetching ? t.generating : t.generate}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Quiz Invite Users
// ============================================================================

function QuizInviteUsers({
  sessionId,
  language,
  onDone,
}: {
  sessionId: string;
  language: 'en' | 'fr';
  onDone: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<InviteUser[]>([]);
  const [inviteResult, setInviteResult] = useState<{ count: number } | null>(null);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: () => apiClient.get<{ items: InviteUser[] }>(`/users?search=${encodeURIComponent(searchQuery)}&limit=10`),
    enabled: searchQuery.length >= 2,
  });

  const inviteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return await apiClient.post<{ added: string[]; count: number }>(`/quiz-sessions/${sessionId}/invite`, userIds);
    },
    onSuccess: (result) => {
      setInviteResult(result);
      setSelectedUsers([]);
    },
  });

  const toggleUser = (user: InviteUser) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleInvite = () => {
    if (selectedUsers.length === 0) return;
    inviteMutation.mutate(selectedUsers.map((u) => u.id));
  };

  const tInvite = {
    search: language === 'fr' ? 'Rechercher un utilisateur...' : 'Search user...',
    selected: language === 'fr' ? 'Sélectionnés' : 'Selected',
    invite: language === 'fr' ? 'Inviter' : 'Invite',
    noResults: language === 'fr' ? 'Aucun résultat' : 'No results',
    success: language === 'fr' ? 'utilisateur(s) invité(s)' : 'user(s) invited',
    done: language === 'fr' ? 'Fermer' : 'Done',
  };

  return (
    <div className="space-y-4">
      {inviteResult && (
        <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
          {inviteResult.count} {tInvite.success}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={tInvite.search}
        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:border-theatarr-500"
      />

      {/* Search results */}
      {searchQuery.length >= 2 && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {isSearching && <Spinner />}
          {searchResults?.items && searchResults.items.length > 0
            ? searchResults.items.map((user) => {
                const isSelected = selectedUsers.some((u) => u.id === user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-theatarr-500/20 border border-theatarr-500/30'
                        : 'bg-dark-surface border border-dark-border hover:border-dark-muted'
                    }`}
                  >
                    <span className="text-dark-text">
                      {user.first_name || user.username}
                      {user.first_name && (
                        <span className="text-dark-muted ml-1">@{user.username}</span>
                      )}
                    </span>
                    {isSelected && <Check size={14} className="text-theatarr-500" />}
                  </button>
                );
              })
            : !isSearching && (
                <p className="text-dark-muted text-sm text-center py-2">{tInvite.noResults}</p>
              )}
        </div>
      )}

      {/* Selected users */}
      {selectedUsers.length > 0 && (
        <div>
          <p className="text-xs text-dark-muted mb-2">
            {tInvite.selected} ({selectedUsers.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-theatarr-500/20 text-theatarr-400 rounded-full text-xs"
              >
                {user.first_name || user.username}
                <button onClick={() => toggleUser(user)} className="hover:text-white">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-dark-border">
        <Button variant="ghost" onClick={onDone}>
          {tInvite.done}
        </Button>
        <Button
          onClick={handleInvite}
          disabled={selectedUsers.length === 0 || inviteMutation.isPending}
        >
          <UserPlus size={14} className="mr-2" />
          {tInvite.invite} ({selectedUsers.length})
        </Button>
      </div>
    </div>
  );
}
