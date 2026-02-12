/**
 * Quiz detail page for portal - participate in quiz via authenticated access.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock, Trophy, X } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
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
  scoreboard: ScoreboardEntry[] | null;
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
        <p className="text-dark-muted">Quiz non trouve</p>
        <Link to="/portal/quiz" className="text-theatarr-500 hover:underline mt-2 inline-block">
          Retour aux quiz
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
        <span>Retour</span>
      </Link>

      {/* Header */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h1 className="text-xl font-bold text-dark-text">{quiz.name}</h1>
        {quiz.description && (
          <p className="text-dark-muted mt-1 text-sm">{quiz.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <span className="text-dark-muted">{quiz.question_count} questions</span>
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
          {joinMutation.isPending ? 'Connexion...' : 'Rejoindre le quiz'}
        </button>
      )}

      {/* WAITING SCREEN */}
      {screen === 'waiting' && quiz.has_joined && (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-theatarr-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-dark-text font-medium">En attente du demarrage...</p>
          <p className="text-dark-muted text-sm mt-1">
            Le quiz commencera lorsque l'administrateur le demarrera.
          </p>
        </div>
      )}

      {/* QUESTION SCREEN */}
      {screen === 'question' && currentQuestion && (
        <div>
          {/* Progress */}
          <div className="flex items-center justify-between mb-3 text-sm text-dark-muted">
            <span>Question {currentQuestionIndex + 1}/{totalQuestions}</span>
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
              Indice : {currentQuestion.hint}
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
            {answerMutation.isPending ? 'Envoi...' : 'Valider'}
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
              <h2 className="text-xl font-bold text-green-400">Correct !</h2>
            </div>
          ) : (
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-red-500/20 rounded-full flex items-center justify-center">
                <X size={32} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-red-400">Incorrect</h2>
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
            <span className="text-dark-text font-bold">Score : {answerResult.score}</span>
          </div>

          <p className="text-dark-muted text-sm mt-4">En attente de la prochaine question...</p>
        </div>
      )}

      {/* RESULTS SCREEN */}
      {screen === 'results' && (
        <div className="py-4">
          <div className="text-center mb-6">
            <Trophy size={40} className="mx-auto text-yellow-400 mb-3" />
            <h2 className="text-xl font-bold text-dark-text mb-1">Quiz termine !</h2>
            <p className="text-dark-muted">
              Score : <span className="text-yellow-400 font-bold">{myScore}</span>/{totalQuestions}
            </p>
          </div>

          {scoreboard.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-dark-muted mb-2">Classement</h3>
              {scoreboard.map((entry, idx) => (
                <div
                  key={entry.token_id}
                  className={clsx(
                    'flex items-center justify-between p-3 rounded-xl border',
                    idx === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                    idx === 1 ? 'bg-gray-400/10 border-gray-400/30' :
                    idx === 2 ? 'bg-amber-700/10 border-amber-700/30' :
                    'bg-dark-surface border-dark-border'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'text-lg font-bold w-6',
                      idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-dark-muted'
                    )}>
                      {idx + 1}
                    </span>
                    <span className="text-dark-text font-medium">{entry.participant_name}</span>
                  </div>
                  <span className="text-dark-text font-bold text-sm">
                    {entry.score}/{entry.total_answered}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
