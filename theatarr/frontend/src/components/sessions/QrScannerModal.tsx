/**
 * Modal for scanning QR ticket codes (admin side).
 * Supports camera scanning + manual token input fallback (for HTTP/no camera).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Check, AlertCircle, QrCode, RotateCcw, X, Keyboard, Camera } from 'lucide-react';
import { apiClient } from '../../api/client';

interface CheckInResult {
  success: boolean;
  already_checked_in: boolean;
  participant_name: string;
  session_name: string;
  checked_in_at: string | null;
}

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScanMode = 'camera' | 'manual';

export function QrScannerModal({ isOpen, onClose }: QrScannerModalProps) {
  const [mode, setMode] = useState<ScanMode>('camera');
  const [scanning, setScanning] = useState(true);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const processedTokenRef = useRef<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
  }, []);

  const checkIn = useCallback(async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed || processing) return;
    if (processedTokenRef.current === trimmed) return;
    processedTokenRef.current = trimmed;
    setProcessing(true);
    setScanning(false);

    await stopScanner();

    try {
      const res = await apiClient.post<CheckInResult>(`/sessions/check-in/${trimmed}`, {});
      setResult(res);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ticket invalide ou introuvable';
      setError(message);
      setResult(null);
    } finally {
      setProcessing(false);
    }
  }, [processing, stopScanner]);

  useEffect(() => {
    if (!isOpen || !scanning || mode !== 'camera') return;

    let html5Qrcode: Html5Qrcode | null = null;

    const startScanner = async () => {
      await new Promise((r) => setTimeout(r, 300));

      if (!document.getElementById('qr-reader')) return;

      html5Qrcode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5Qrcode;

      try {
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => checkIn(decodedText),
          () => {},
        );
      } catch (err) {
        console.error('Camera error:', err);
        setCameraFailed(true);
        setMode('manual');
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      if (html5Qrcode) {
        try {
          const state = html5Qrcode.getState();
          if (state === 2) {
            html5Qrcode.stop().catch(() => {});
          }
        } catch {
          // Ignore
        }
      }
    };
  }, [isOpen, scanning, mode, checkIn]);

  const handleClose = useCallback(async () => {
    await stopScanner();
    setMode(cameraFailed ? 'manual' : 'camera');
    setScanning(true);
    setResult(null);
    setError(null);
    setManualToken('');
    processedTokenRef.current = null;
    onClose();
  }, [stopScanner, onClose, cameraFailed]);

  const handleScanAnother = useCallback(() => {
    setResult(null);
    setError(null);
    setManualToken('');
    processedTokenRef.current = null;
    if (mode === 'camera' && !cameraFailed) {
      setScanning(true);
    }
  }, [mode, cameraFailed]);

  const handleManualSubmit = useCallback(() => {
    checkIn(manualToken);
  }, [manualToken, checkIn]);

  const switchMode = useCallback(async (newMode: ScanMode) => {
    if (newMode === mode) return;
    await stopScanner();
    setMode(newMode);
    setError(null);
    setResult(null);
    setManualToken('');
    processedTokenRef.current = null;
    if (newMode === 'camera') {
      setScanning(true);
    }
  }, [mode, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-dark-surface border border-dark-border rounded-2xl w-full max-w-sm overflow-hidden animate-slide-up">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-dark-border/50 text-dark-muted transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="p-5 pb-3 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium mb-3">
            <QrCode size={14} />
            Scanner un ticket
          </div>

          {/* Mode toggle */}
          {!processing && !result && (
            <div className="flex gap-1 bg-dark-bg rounded-lg p-1 mt-2">
              <button
                onClick={() => switchMode('camera')}
                disabled={cameraFailed}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  mode === 'camera'
                    ? 'bg-dark-surface text-dark-text shadow-sm'
                    : cameraFailed
                      ? 'text-dark-muted/40 cursor-not-allowed'
                      : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                <Camera size={12} />
                Camera
              </button>
              <button
                onClick={() => switchMode('manual')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  mode === 'manual'
                    ? 'bg-dark-surface text-dark-text shadow-sm'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                <Keyboard size={12} />
                Saisie manuelle
              </button>
            </div>
          )}
        </div>

        {/* Camera scanner */}
        {mode === 'camera' && scanning && !cameraFailed && (
          <div className="px-5 pb-5">
            <div
              ref={containerRef}
              id="qr-reader"
              className="rounded-lg overflow-hidden bg-black"
              style={{ minHeight: 280 }}
            />
            <p className="text-center text-xs text-dark-muted mt-3">
              Pointez la camera vers le QR code du ticket
            </p>
          </div>
        )}

        {/* Manual input */}
        {mode === 'manual' && !processing && !result && !error && (
          <div className="px-5 pb-5">
            {cameraFailed && (
              <p className="text-xs text-yellow-400/80 text-center mb-3">
                Camera indisponible (HTTPS requis). Saisissez le code du ticket.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Code du ticket (UUID)"
                autoFocus
                className="flex-1 px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted/50 focus:outline-none focus:ring-1 focus:ring-theatarr-500 focus:border-theatarr-500"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualToken.trim()}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Valider
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {processing && (
          <div className="px-5 pb-5 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-dark-border flex items-center justify-center animate-pulse">
              <QrCode size={24} className="text-dark-muted" />
            </div>
            <p className="text-dark-muted text-sm">Verification en cours...</p>
          </div>
        )}

        {/* Success result */}
        {result && !processing && (
          <div className="px-5 pb-5 text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              result.already_checked_in
                ? 'bg-yellow-500/20'
                : 'bg-green-500/20'
            }`}>
              <Check size={32} className={result.already_checked_in ? 'text-yellow-400' : 'text-green-400'} />
            </div>
            <h3 className="text-lg font-bold text-dark-text mb-1">
              {result.participant_name}
            </h3>
            <p className="text-sm text-dark-muted mb-1">
              {result.session_name}
            </p>
            {result.already_checked_in ? (
              <p className="text-xs text-yellow-400 font-medium">
                Deja scanne
              </p>
            ) : (
              <p className="text-xs text-green-400 font-medium">
                Check-in effectue
              </p>
            )}

            <button
              onClick={handleScanAnother}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-dark-border text-dark-text rounded-lg text-sm font-medium hover:bg-dark-muted/30 transition-colors"
            >
              <RotateCcw size={14} />
              Verifier un autre ticket
            </button>
          </div>
        )}

        {/* Error result */}
        {error && !processing && (
          <div className="px-5 pb-5 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-dark-text mb-1">
              Erreur
            </h3>
            <p className="text-sm text-red-400 mb-4">
              {error}
            </p>

            <button
              onClick={handleScanAnother}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-dark-border text-dark-text rounded-lg text-sm font-medium hover:bg-dark-muted/30 transition-colors"
            >
              <RotateCcw size={14} />
              Reessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
