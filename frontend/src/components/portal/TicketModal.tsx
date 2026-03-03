/**
 * Modal displaying a QR code ticket for a session.
 */

import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Film, QrCode, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

interface TicketSession {
  id: string;
  name: string;
  movie_title: string | null;
  movie_poster_url: string | null;
  scheduled_at: string | null;
  ticket_token: string | null;
  checked_in: boolean;
}

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TicketSession;
  userName?: string | null;
}

export function TicketModal({ isOpen, onClose, session, userName }: TicketModalProps) {
  const { t } = useTranslation(['portal', 'common']);
  const { formatDate: fmtDate, formatTime: fmtTime } = useLocaleFormat();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !session.ticket_token) return null;

  const formatDate = (dateStr: string) => {
    return fmtDate(dateStr, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return fmtTime(dateStr, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToken = () => {
    if (session.ticket_token) {
      navigator.clipboard.writeText(session.ticket_token).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-dark-surface border border-dark-border rounded-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-dark-border/50 text-dark-muted transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="p-5 pb-3 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-theatarr-500/10 text-theatarr-500 text-xs font-medium mb-3">
            <QrCode size={14} />
            {t('portal:ticket.title')}
          </div>
          {userName && (
            <p className="text-base font-semibold text-dark-text">{userName}</p>
          )}
          <h2 className="text-lg font-bold text-dark-text mt-1">{session.name}</h2>
        </div>

        {/* Movie info + date/time */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-3 p-3 bg-dark-bg rounded-lg">
            {session.movie_poster_url ? (
              <img
                src={session.movie_poster_url}
                alt={session.movie_title || session.name}
                className="w-12 h-[72px] rounded object-cover flex-shrink-0"
              />
            ) : session.movie_title ? (
              <div className="w-12 h-[72px] rounded bg-dark-border flex items-center justify-center flex-shrink-0">
                <Film size={18} className="text-dark-muted" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              {session.movie_title && (
                <p className="text-sm font-medium text-dark-text truncate">{session.movie_title}</p>
              )}
              {session.scheduled_at && (
                <>
                  <p className="text-xs text-dark-muted mt-1 capitalize">
                    {formatDate(session.scheduled_at)}
                  </p>
                  <p className="text-sm font-semibold text-theatarr-400">
                    {formatTime(session.scheduled_at)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex justify-center px-5 py-4">
          <div className="p-4 bg-white rounded-xl">
            <QRCodeSVG
              value={session.ticket_token}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Token display (for manual input fallback) */}
        <div className="px-5 pb-2">
          <button
            onClick={copyToken}
            className="w-full flex items-center justify-center gap-2 py-1.5 text-[10px] text-dark-muted hover:text-dark-text transition-colors font-mono"
            title={t('portal:ticket.copyCode')}
          >
            {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
            <span className="truncate">{session.ticket_token}</span>
          </button>
        </div>

        {/* Check-in status */}
        <div className="px-5 pb-5">
          {session.checked_in ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium">
              <Check size={16} />
              {t('portal:ticket.checkedIn')}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 p-3 bg-dark-bg border border-dark-border rounded-lg text-dark-muted text-sm">
              <QrCode size={16} />
              {t('portal:ticket.showQr')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
