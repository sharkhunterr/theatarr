import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, HelpCircle, Trophy, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWebSocket } from '../hooks/useWebSocket';
import { Spinner } from '../components/common';
import { API_BASE } from '../api/client';

interface QuizSessionPublic {
  id: string;
  name: string;
  description?: string;
  status: string;
  question_count: number;
  current_question_index: number;
  current_question?: {
    text: string;
    choices: string[];
    allow_multiple: boolean;
    time_limit_seconds: number;
    hint?: string;
    image_url?: string;
  };
  time_remaining_seconds?: number;
  config?: {
    show_live_results: string;
    show_scores_live: boolean;
  };
  participant_count: number;
  participant_name?: string;
  my_score: number;
}

interface AnswerResult {
  is_correct: boolean;
  correct_indices: number[];
  score: number;
}

interface ScoreboardEntry {
  token_id: string;
  participant_name: string;
  score: number;
  total_answered: number;
  avg_response_time_ms: number | null;
}

type Screen = 'loading' | 'error' | 'join' | 'waiting' | 'question' | 'feedback' | 'results';

export function QuizPage() {
  const { t } = useTranslation(['votes', 'common']);
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>('loading');
  const [participantName, setParticipantName] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizSessionPublic['current_question'] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const questionStartTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevent API refetches from overriding WS-driven screen state
  const initializedRef = useRef(false);
  // Track pending HTTP answer to avoid race with WS auto-advance
  const pendingAnswerRef = useRef(false);

  // Fetch quiz session
  const { data: session, isLoading, error } = useQuery<QuizSessionPublic>({
    queryKey: ['quiz-session', token],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/quiz/${token}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to load quiz');
      }
      return response.json();
    },
    enabled: !!token,
  });

  // Determine screen based on session state (initial load only)
  useEffect(() => {
    if (isLoading) { setScreen('loading'); return; }
    if (error) { setScreen('error'); setErrorMessage((error as Error).message); return; }
    if (!session) return;

    setParticipantCount(session.participant_count);
    setTotalQuestions(session.question_count);

    // Only set screen from API data on initial load — after that, WS drives state
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!session.participant_name) {
      setScreen('join');
    } else if (session.status === 'open') {
      setScreen('waiting');
    } else if (session.status === 'active' && session.current_question) {
      setCurrentQuestion(session.current_question);
      setCurrentQuestionIndex(session.current_question_index);
      setMyScore(session.my_score);
      if (session.time_remaining_seconds != null) {
        setTimeRemaining(session.time_remaining_seconds);
      }
      setScreen('question');
      questionStartTimeRef.current = Date.now();
    } else if (session.status === 'completed') {
      setScreen('results');
    } else {
      setScreen('waiting');
    }
  }, [session, isLoading, error]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeRemaining == null || timeRemaining <= 0 || screen !== 'question') return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev == null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen, currentQuestionIndex]);

  // WebSocket for real-time quiz events
  const handleWsMessage = useCallback((message: { type: string; payload?: Record<string, unknown> }) => {
    const payload = message.payload || {};

    switch (message.type) {
      case 'quiz_started':
      case 'quiz_question': {
        const q = payload.question as QuizSessionPublic['current_question'];
        const qIdx = payload.question_index as number;
        const total = payload.total_questions as number;
        setCurrentQuestion(q || null);
        setCurrentQuestionIndex(qIdx);
        if (total) setTotalQuestions(total);
        setSelectedIndices([]);
        setAnswerResult(null);
        setHasAnswered(false);
        setTimeRemaining(q?.time_limit_seconds ?? 30);
        questionStartTimeRef.current = Date.now();
        // WS advanced to new question — cancel any pending HTTP answer feedback
        pendingAnswerRef.current = false;
        setScreen('question');
        break;
      }
      case 'quiz_question_results': {
        // Show "didn't answer" feedback only if no answer is pending (HTTP will provide real result)
        const correctIndices = payload.correct_indices as number[];
        if (correctIndices && !answerResult && !pendingAnswerRef.current) {
          setAnswerResult({
            is_correct: false,
            correct_indices: correctIndices,
            score: myScore,
          });
          setScreen('feedback');
        }
        break;
      }
      case 'quiz_ended': {
        const sb = payload.scoreboard as ScoreboardEntry[];
        if (sb) setScoreboard(sb);
        pendingAnswerRef.current = false;
        setScreen('results');
        break;
      }
      case 'quiz_participant_joined': {
        const count = payload.participant_count as number;
        if (count) setParticipantCount(count);
        break;
      }
      case 'quiz_answer_submitted': {
        // Live stats — could update distribution display
        break;
      }
    }
  }, [answerResult, myScore]);

  const { send, isConnected } = useWebSocket({
    autoConnect: !!session && !!session.participant_name,
    onMessage: handleWsMessage,
    onConnect: () => {
      if (session?.id) {
        send({
          type: 'subscribe_quiz',
          payload: { quiz_session_id: session.id },
        });
      }
    },
  });

  // Re-subscribe when session ID becomes available
  useEffect(() => {
    if (isConnected && session?.id && session.participant_name) {
      send({
        type: 'subscribe_quiz',
        payload: { quiz_session_id: session.id },
      });
    }
  }, [isConnected, session?.id, session?.participant_name, send]);

  // Join mutation
  const joinMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`${API_BASE}/api/v1/quiz/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_name: name }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to join quiz');
      }
      return response.json();
    },
    onSuccess: () => {
      initializedRef.current = false; // Allow re-initialization from fresh API data
      queryClient.invalidateQueries({ queryKey: ['quiz-session', token] });
    },
  });

  // Answer mutation
  const answerMutation = useMutation({
    mutationFn: async (indices: number[]) => {
      pendingAnswerRef.current = true;
      const responseTimeMs = Date.now() - questionStartTimeRef.current;
      const response = await fetch(`${API_BASE}/api/v1/quiz/${token}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: currentQuestionIndex,
          selected_indices: indices,
          response_time_ms: responseTimeMs,
        }),
      });
      if (!response.ok) {
        pendingAnswerRef.current = false;
        const err = await response.json();
        throw new Error(err.detail || 'Failed to submit answer');
      }
      return response.json() as Promise<AnswerResult>;
    },
    onSuccess: (result) => {
      setMyScore(result.score);
      // Only show feedback if WS hasn't already advanced to the next question
      if (pendingAnswerRef.current) {
        pendingAnswerRef.current = false;
        setAnswerResult(result);
        setHasAnswered(true);
        setScreen('feedback');
      }
    },
  });

  const handleJoin = () => {
    if (participantName.trim()) {
      joinMutation.mutate(participantName.trim());
    }
  };

  const toggleChoice = (idx: number) => {
    if (hasAnswered) return;
    const allowMultiple = currentQuestion?.allow_multiple ?? false;
    if (allowMultiple) {
      setSelectedIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    } else {
      setSelectedIndices([idx]);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedIndices.length === 0 || hasAnswered) return;
    answerMutation.mutate(selectedIndices);
  };

  // ============================================================================
  // Render Screens
  // ============================================================================

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <HelpCircle size={48} className="mx-auto text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{t('votes:quizPage.invalidLink')}</h1>
          <p className="text-gray-400">{errorMessage || t('votes:quizPage.invalidLinkMessage')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(to bottom, #1a1a2e 0%, #0f0f1a 100%)' }}
    >
      {/* Header */}
      <header className="p-4 sm:p-6 text-center border-b border-gray-800">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{session?.name || 'Quiz'}</h1>
        {session?.description && (
          <p className="text-gray-400 text-sm max-w-2xl mx-auto">{session.description}</p>
        )}
        {screen !== 'join' && (
          <div className="mt-3 flex items-center justify-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-gray-400">
              <Users size={14} />
              {participantCount}
            </span>
            {myScore > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Trophy size={14} />
                {myScore}
              </span>
            )}
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl">
        {/* JOIN SCREEN */}
        {screen === 'join' && (
          <div className="text-center">
            <HelpCircle size={64} className="mx-auto text-indigo-500 mb-6" />
            <h2 className="text-xl font-semibold text-white mb-6">{t('votes:quizPage.joinQuiz')}</h2>
            <div className="max-w-sm mx-auto space-y-4">
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder={t('votes:quizPage.yourName')}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-center text-lg"
                autoFocus
              />
              <button
                onClick={handleJoin}
                disabled={!participantName.trim() || joinMutation.isPending}
                className="w-full px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors"
              >
                {joinMutation.isPending ? t('votes:quizPage.connecting') : t('votes:quizPage.join')}
              </button>
              {joinMutation.error && (
                <p className="text-red-400 text-sm">{(joinMutation.error as Error).message}</p>
              )}
            </div>
          </div>
        )}

        {/* WAITING SCREEN */}
        {screen === 'waiting' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-semibold text-white mb-2">{t('votes:quizPage.waitingToStart')}</h2>
            <p className="text-gray-400">
              {t('votes:quizPage.participantsConnected', { count: participantCount })}
            </p>
          </div>
        )}

        {/* QUESTION SCREEN */}
        {screen === 'question' && currentQuestion && (
          <div>
            {/* Progress bar */}
            <div className="flex items-center justify-between mb-4 text-sm text-gray-400">
              <span>{t('votes:quizPage.questionProgress', { current: currentQuestionIndex + 1, total: totalQuestions })}</span>
              {timeRemaining != null && (
                <span className={`flex items-center gap-1 font-mono ${timeRemaining <= 5 ? 'text-red-400' : ''}`}>
                  <Clock size={14} />
                  {timeRemaining}s
                </span>
              )}
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full mb-6">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>

            {/* Question text */}
            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-6 text-center">
              {currentQuestion.text}
            </h2>

            {/* Hint */}
            {currentQuestion.hint && (
              <p className="text-sm text-yellow-400/80 text-center mb-4 italic">
                {t('votes:quizPage.hint')} {currentQuestion.hint}
              </p>
            )}

            {/* Choices */}
            <div className="space-y-3 mb-8">
              {currentQuestion.choices.map((choice, idx) => {
                const isSelected = selectedIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleChoice(idx)}
                    disabled={hasAnswered}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-600 text-gray-500'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-base">{choice}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submit button */}
            <div className="text-center">
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedIndices.length === 0 || hasAnswered || answerMutation.isPending}
                className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors"
              >
                {answerMutation.isPending ? t('votes:quizPage.submitting') : t('votes:quizPage.validate')}
              </button>
              {answerMutation.error && (
                <p className="text-red-400 text-sm mt-2">{(answerMutation.error as Error).message}</p>
              )}
            </div>
          </div>
        )}

        {/* FEEDBACK SCREEN */}
        {screen === 'feedback' && answerResult && currentQuestion && (
          <div className="text-center py-8">
            {answerResult.is_correct ? (
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Check size={40} className="text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-green-400">{t('votes:quizPage.correct')}</h2>
              </div>
            ) : (
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                  <X size={40} className="text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-red-400">{t('votes:quizPage.incorrect')}</h2>
              </div>
            )}

            {/* Show correct answers */}
            <div className="max-w-md mx-auto space-y-2 mb-6">
              {currentQuestion.choices.map((choice, idx) => {
                const isCorrect = answerResult.correct_indices.includes(idx);
                const wasSelected = selectedIndices.includes(idx);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                      isCorrect
                        ? 'bg-green-500/20 border border-green-500/30'
                        : wasSelected
                        ? 'bg-red-500/20 border border-red-500/30'
                        : 'bg-gray-800/50 border border-gray-700'
                    }`}
                  >
                    {isCorrect ? (
                      <Check size={16} className="text-green-400 flex-shrink-0" />
                    ) : wasSelected ? (
                      <X size={16} className="text-red-400 flex-shrink-0" />
                    ) : (
                      <div className="w-4 flex-shrink-0" />
                    )}
                    <span className={isCorrect ? 'text-green-300' : wasSelected ? 'text-red-300' : 'text-gray-400'}>
                      {choice}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Score */}
            <div className="flex items-center justify-center gap-2 text-lg">
              <Trophy size={20} className="text-yellow-400" />
              <span className="text-white font-bold">{t('votes:quizPage.score')} {answerResult.score}</span>
            </div>

            <p className="text-gray-500 text-sm mt-6">
              {t('votes:quizPage.waitingNextQuestion')}
            </p>
          </div>
        )}

        {/* RESULTS SCREEN */}
        {screen === 'results' && (
          <div className="py-4">
            <div className="text-center mb-8">
              <Trophy size={48} className="mx-auto text-yellow-400 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">{t('votes:quizPage.quizFinished')}</h2>
              <p className="text-gray-400">
                {t('votes:quizPage.yourScore')} <span className="text-yellow-400 font-bold">{myScore}</span>/{totalQuestions}
              </p>
            </div>

            {/* Scoreboard */}
            {scoreboard.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400 mb-3">{t('votes:quizPage.leaderboard')}</h3>
                {scoreboard.map((entry, idx) => (
                  <div
                    key={entry.token_id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      idx === 0
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : idx === 1
                        ? 'bg-gray-400/10 border-gray-400/30'
                        : idx === 2
                        ? 'bg-amber-700/10 border-amber-700/30'
                        : 'bg-gray-800/50 border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold w-8 ${
                        idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-white font-medium">{entry.participant_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-white font-bold">
                        {entry.score}/{entry.total_answered}
                      </span>
                      {entry.avg_response_time_ms && (
                        <span className="text-gray-500">
                          {(entry.avg_response_time_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-600 text-xs">
        {t('votes:quizPage.poweredBy')}
      </footer>
    </div>
  );
}
