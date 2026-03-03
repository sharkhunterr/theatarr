/**
 * Quiz detail page for portal - participate in quiz via authenticated access.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock, Trophy, X } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import { useWebSocket } from '../../hooks/useWebSocket';

interface QuizQuestion {
  text: string;
  choices: string[];
  allow_multiple: boolean;
  time_limit_seconds: number;
  hint?: string;
  image_url?: string;
}

interface ScoreboardEntry {
  token_id: string;
  participant_name: string;
  score: number;
  total_answered: number;
  avg_response_time_ms: number | null;
}

interface MyAnswer {
  selected_indices: number[];
  is_correct: boolean;
  correct_indices: number[];
}

interface ReviewItem {
  question_index: number;
  text: string;
  choices: string[];
  correct_indices: number[];
  selected_indices: number[] | null;
  is_correct: boolean;
  answered: boolean;
  response_time_ms: number | null;
}

interface QuizDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  question_count: number;
  current_question_index: number;
  current_question: QuizQuestion | null;
  my_score: number;
  my_answer: MyAnswer | null;
  has_joined: boolean;
  participant_name: string | null;
  token: string;
  my_token_id: string;
  scoreboard: ScoreboardEntry[] | null;
  review: ReviewItem[] | null;
  my_rank: number | null;
  config: {
    show_live_results: string;
    show_scores_live: boolean;
  };
}

interface AnswerResult {
  is_correct: boolean;
  correct_indices: number[];
  score: number;
}

type Screen = 'loading' | 'waiting' | 'question' | 'feedback' | 'results';

export function QuizDetail() {
  const { t } = useTranslation(['portal', 'common']);
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const authToken = localStorage.getItem('theatarr_token');
  const [screen, setScreen] = useState<Screen>('loading');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const questionStartTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevent API refetches from overriding WS-driven screen state
  const initializedRef = useRef(false);
  // Track pending HTTP answer to avoid race with WS auto-advance
  const pendingAnswerRef = useRef(false);

  const { data: quiz, isLoading } = useQuery<QuizDetail>({
    queryKey: ['portal', 'quiz', id],
    queryFn: () => apiClient.get<QuizDetail>(`/portal/quiz/${id}`),
    enabled: !!id,
  });

  // Determine screen from quiz state (initial load only)
  useEffect(() => {
    if (isLoading || !quiz) return;

    setTotalQuestions(quiz.question_count);

    // Only set screen from API data on initial load — after that, WS drives state
    if (initializedRef.current) return;
    initializedRef.current = true;

    setMyScore(quiz.my_score);

    if (quiz.status === 'open') {
      setScreen('waiting');
    } else if (quiz.status === 'active' && quiz.current_question) {
      setCurrentQuestion(quiz.current_question);
      setCurrentQuestionIndex(quiz.current_question_index);
      // If user already answered this question, show feedback
      if (quiz.my_answer) {
        setSelectedIndices(quiz.my_answer.selected_indices);
        setAnswerResult({
          is_correct: quiz.my_answer.is_correct,
          correct_indices: quiz.my_answer.correct_indices,
          score: quiz.my_score,
        });
        setHasAnswered(true);
        setScreen('feedback');
      } else {
        setTimeRemaining(quiz.current_question.time_limit_seconds);
        questionStartTimeRef.current = Date.now();
        setScreen('question');
      }
    } else if (quiz.status === 'completed') {
      if (quiz.scoreboard) setScoreboard(quiz.scoreboard);
      setScreen('results');
    } else {
      setScreen('waiting');
    }
  }, [quiz, isLoading]);

  // Timer
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

  // WebSocket
  const handleWsMessage = useCallback((message: { type: string; payload?: Record<string, unknown> }) => {
    const payload = message.payload || {};

    switch (message.type) {
      case 'quiz_started':
      case 'quiz_question': {
        const q = payload.question as QuizQuestion;
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
        const correctIndices = payload.correct_indices as number[];
        // Only show "didn't answer" feedback if no answer is pending (HTTP will provide real result)
        if (correctIndices && !answerResult && !pendingAnswerRef.current) {
          setAnswerResult({ is_correct: false, correct_indices: correctIndices, score: myScore });
          setScreen('feedback');
        }
        break;
      }
      case 'quiz_ended': {
        const sb = payload.scoreboard as ScoreboardEntry[];
        if (sb) setScoreboard(sb);
        pendingAnswerRef.current = false;
        setScreen('results');
        // Refetch to get review data (all questions + answers)
        queryClient.invalidateQueries({ queryKey: ['portal', 'quiz', id] });
        break;
      }
    }
  }, [answerResult, myScore]);

  const { send, isConnected } = useWebSocket({
    token: authToken,
    autoConnect: !!quiz?.has_joined,
    onMessage: handleWsMessage,
  });

  useEffect(() => {
    if (isConnected && quiz?.id) {
      send({ type: 'subscribe_quiz', payload: { quiz_session_id: quiz.id } });
    }
  }, [isConnected, quiz?.id, send]);

  // Join mutation
  const joinMutation = useMutation({
    mutationFn: () => apiClient.post(`/portal/quiz/${id}/join`, {}),
    onSuccess: () => {
      initializedRef.current = false; // Allow re-initialization from fresh API data
      queryClient.invalidateQueries({ queryKey: ['portal', 'quiz', id] });
    },
  });

  // Answer mutation
  const answerMutation = useMutation({
    mutationFn: async (indices: number[]) => {
      pendingAnswerRef.current = true;
      const responseTimeMs = Date.now() - questionStartTimeRef.current;
      return await apiClient.post<AnswerResult>(`/portal/quiz/${id}/answer`, {
        question_index: currentQuestionIndex,
        selected_indices: indices,
        response_time_ms: responseTimeMs,
      });
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

  const toggleChoice = (idx: number) => {
    if (hasAnswered) return;
    if (currentQuestion?.allow_multiple) {
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-dark-surface rounded animate-pulse" />
        <div className="h-48 bg-dark-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-muted">{t('portal:quizDetail.notFound')}</p>
        <Link to="/portal/quiz" className="text-theatarr-500 hover:underline mt-2 inline-block">
          {t('portal:quizDetail.backToQuiz')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        to="/portal/quiz"
        className="inline-flex items-center gap-2 text-dark-muted hover:text-dark-text transition-colors"
      >
        <ArrowLeft size={18} />
        <span>{t('portal:quizDetail.back')}</span>
      </Link>

      {/* Header */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h1 className="text-xl font-bold text-dark-text">{quiz.name}</h1>
        {quiz.description && (
          <p className="text-dark-muted mt-1 text-sm">{quiz.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <span className="text-dark-muted">{t('portal:quizDetail.questions', { count: quiz.question_count })}</span>
          {myScore > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Trophy size={14} />
              {myScore}
            </span>
          )}
        </div>
      </div>

      {/* Join button if not joined */}
      {!quiz.has_joined && (quiz.status === 'open' || quiz.status === 'active') && (
        <button
          onClick={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
          className="w-full py-4 bg-theatarr-500 text-white font-medium rounded-xl hover:bg-theatarr-600 transition-colors"
        >
          {joinMutation.isPending ? t('portal:quizDetail.joining') : t('portal:quizDetail.joinQuiz')}
        </button>
      )}

      {/* WAITING SCREEN */}
      {screen === 'waiting' && quiz.has_joined && (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-theatarr-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-dark-text font-medium">{t('portal:quizDetail.waitingStart')}</p>
          <p className="text-dark-muted text-sm mt-1">
            {t('portal:quizDetail.waitingStartHint')}
          </p>
        </div>
      )}

      {/* QUESTION SCREEN */}
      {screen === 'question' && currentQuestion && (
        <div>
          {/* Progress */}
          <div className="flex items-center justify-between mb-3 text-sm text-dark-muted">
            <span>{t('portal:quizDetail.question', { current: currentQuestionIndex + 1, total: totalQuestions })}</span>
            {timeRemaining != null && (
              <span className={clsx('flex items-center gap-1 font-mono', timeRemaining <= 5 && 'text-red-400')}>
                <Clock size={14} />
                {timeRemaining}s
              </span>
            )}
          </div>
          <div className="w-full h-1.5 bg-dark-border rounded-full mb-4">
            <div
              className="h-full bg-theatarr-500 rounded-full transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>

          {/* Question */}
          <h2 className="text-lg font-semibold text-dark-text mb-4 text-center">
            {currentQuestion.text}
          </h2>

          {currentQuestion.hint && (
            <p className="text-sm text-yellow-400/80 text-center mb-3 italic">
              {t('portal:quizDetail.hint', { hint: currentQuestion.hint })}
            </p>
          )}

          {/* Choices */}
          <div className="space-y-2 mb-6">
            {currentQuestion.choices.map((choice, idx) => {
              const isSelected = selectedIndices.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleChoice(idx)}
                  disabled={hasAnswered}
                  className={clsx(
                    'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                    isSelected
                      ? 'border-theatarr-500 bg-theatarr-500/20 text-dark-text'
                      : 'border-dark-border bg-dark-surface text-dark-muted hover:border-dark-muted'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold',
                      isSelected ? 'border-theatarr-500 bg-theatarr-500 text-white' : 'border-dark-border text-dark-muted'
                    )}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{choice}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedIndices.length === 0 || hasAnswered || answerMutation.isPending}
            className={clsx(
              'w-full py-4 rounded-xl font-medium text-lg transition-all',
              selectedIndices.length > 0
                ? 'bg-theatarr-500 text-white hover:bg-theatarr-600'
                : 'bg-dark-surface text-dark-muted border border-dark-border cursor-not-allowed'
            )}
          >
            {answerMutation.isPending ? t('portal:quizDetail.sending') : t('portal:quizDetail.validate')}
          </button>
        </div>
      )}

      {/* FEEDBACK SCREEN */}
      {screen === 'feedback' && answerResult && currentQuestion && (
        <div className="text-center py-6">
          {answerResult.is_correct ? (
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check size={32} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-green-400">{t('portal:quizDetail.correct')}</h2>
            </div>
          ) : (
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-red-500/20 rounded-full flex items-center justify-center">
                <X size={32} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-red-400">{t('portal:quizDetail.incorrect')}</h2>
            </div>
          )}

          <div className="space-y-2 mb-4 max-w-md mx-auto">
            {currentQuestion.choices.map((choice, idx) => {
              const isCorrect = answerResult.correct_indices.includes(idx);
              const wasSelected = selectedIndices.includes(idx);
              return (
                <div
                  key={idx}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                    isCorrect ? 'bg-green-500/20 border border-green-500/30' :
                    wasSelected ? 'bg-red-500/20 border border-red-500/30' :
                    'bg-dark-surface border border-dark-border'
                  )}
                >
                  {isCorrect ? <Check size={14} className="text-green-400 flex-shrink-0" /> :
                   wasSelected ? <X size={14} className="text-red-400 flex-shrink-0" /> :
                   <div className="w-3.5 flex-shrink-0" />}
                  <span className={isCorrect ? 'text-green-300' : wasSelected ? 'text-red-300' : 'text-dark-muted'}>
                    {choice}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2">
            <Trophy size={18} className="text-yellow-400" />
            <span className="text-dark-text font-bold">{t('portal:quizDetail.score', { score: answerResult.score })}</span>
          </div>

          <p className="text-dark-muted text-sm mt-4">{t('portal:quizDetail.waitingNextQuestion')}</p>
        </div>
      )}

      {/* RESULTS SCREEN */}
      {screen === 'results' && (
        <div className="py-4 space-y-6">
          {/* Score summary */}
          <div className="bg-dark-surface rounded-xl border border-dark-border p-5 text-center">
            <Trophy size={36} className="mx-auto text-yellow-400 mb-2" />
            <h2 className="text-xl font-bold text-dark-text">{t('portal:quizDetail.results.title')}</h2>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div>
                <p className="text-2xl font-bold text-yellow-400">{myScore}<span className="text-base text-dark-muted">/{totalQuestions}</span></p>
                <p className="text-[11px] text-dark-muted">{t('portal:quizDetail.results.score')}</p>
              </div>
              {quiz?.my_rank && (
                <div>
                  <p className="text-2xl font-bold text-theatarr-400">{quiz.my_rank}<span className="text-base text-dark-muted">e</span></p>
                  <p className="text-[11px] text-dark-muted">{t('portal:quizDetail.results.position')}</p>
                </div>
              )}
              {scoreboard.length > 0 && (
                <div>
                  <p className="text-2xl font-bold text-dark-text">{scoreboard.length}</p>
                  <p className="text-[11px] text-dark-muted">{t('portal:quizDetail.results.participants')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Scoreboard */}
          {scoreboard.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-dark-muted mb-2">{t('portal:quizDetail.results.leaderboard')}</h3>
              <div className="space-y-1.5">
                {scoreboard.map((entry, idx) => {
                  const isMe = entry.token_id === quiz?.my_token_id;
                  return (
                    <div
                      key={entry.token_id}
                      className={clsx(
                        'flex items-center justify-between px-3 py-2 rounded-lg border',
                        isMe ? 'bg-theatarr-500/10 border-theatarr-500/30' :
                        idx === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-dark-surface border-dark-border'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={clsx(
                          'text-sm font-bold w-5 text-center',
                          idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-dark-muted'
                        )}>
                          {idx + 1}
                        </span>
                        <span className={clsx('text-sm', isMe ? 'text-theatarr-400 font-semibold' : 'text-dark-text')}>
                          {entry.participant_name}{isMe ? ` ${t('portal:quizDetail.results.you')}` : ''}
                        </span>
                      </div>
                      <span className="text-sm text-dark-text font-bold">
                        {entry.score}/{entry.total_answered}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question review */}
          {quiz?.review && quiz.review.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-dark-muted mb-2">{t('portal:quizDetail.results.questionReview')}</h3>
              <div className="space-y-3">
                {quiz.review.map((item) => (
                  <div
                    key={item.question_index}
                    className={clsx(
                      'bg-dark-surface rounded-xl border p-3',
                      item.is_correct ? 'border-green-500/30' :
                      !item.answered ? 'border-dark-border' :
                      'border-red-500/30'
                    )}
                  >
                    {/* Question header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-dark-text">
                        <span className="text-dark-muted mr-1.5">{item.question_index + 1}.</span>
                        {item.text}
                      </p>
                      <span className={clsx(
                        'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                        item.is_correct ? 'bg-green-500/20' :
                        !item.answered ? 'bg-dark-border' :
                        'bg-red-500/20'
                      )}>
                        {item.is_correct ? (
                          <Check size={14} className="text-green-400" />
                        ) : !item.answered ? (
                          <span className="text-dark-muted text-xs">-</span>
                        ) : (
                          <X size={14} className="text-red-400" />
                        )}
                      </span>
                    </div>

                    {/* Choices */}
                    <div className="space-y-1">
                      {item.choices.map((choice, ci) => {
                        const isCorrect = item.correct_indices.includes(ci);
                        const isSelected = item.selected_indices?.includes(ci) ?? false;
                        return (
                          <div
                            key={ci}
                            className={clsx(
                              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs',
                              isCorrect ? 'bg-green-500/15 text-green-300' :
                              isSelected ? 'bg-red-500/15 text-red-300' :
                              'text-dark-muted'
                            )}
                          >
                            {isCorrect ? (
                              <Check size={12} className="text-green-400 flex-shrink-0" />
                            ) : isSelected ? (
                              <X size={12} className="text-red-400 flex-shrink-0" />
                            ) : (
                              <span className="w-3 flex-shrink-0" />
                            )}
                            <span>{choice}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Response time */}
                    {item.answered && item.response_time_ms != null && (
                      <p className="text-[10px] text-dark-muted mt-1.5 flex items-center gap-1">
                        <Clock size={10} />
                        {(item.response_time_ms / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
