import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string | Date;
  onComplete?: () => void;
  palette?: {
    primary?: string;
    accent?: string;
    text?: string;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSeconds?: boolean;
  showLabels?: boolean;
  animate?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({
  targetDate,
  onComplete,
  palette,
  size = 'lg',
  showSeconds = true,
  showLabels = true,
  animate = true,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [prevSeconds, setPrevSeconds] = useState(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
      const now = new Date();
      const difference = target.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        onComplete?.();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / (1000 * 60)) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, total: difference });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onComplete]);

  useEffect(() => {
    setPrevSeconds(timeLeft.seconds);
  }, [timeLeft.seconds]);

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
    xl: 'text-8xl',
  };

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  const padNumber = (num: number) => num.toString().padStart(2, '0');

  const renderDigit = (value: number, label: string) => {
    const isChanging = animate && label === 'sec' && value !== prevSeconds;

    return (
      <div className="flex flex-col items-center">
        <div
          className={`font-mono font-bold ${sizeClasses[size]} ${
            isChanging ? 'animate-pulse' : ''
          }`}
          style={{ color: palette?.text || '#ffffff' }}
        >
          {padNumber(value)}
        </div>
        {showLabels && (
          <div
            className={`${labelSizeClasses[size]} uppercase tracking-wider opacity-60`}
            style={{ color: palette?.text || '#ffffff' }}
          >
            {label}
          </div>
        )}
      </div>
    );
  };

  const renderSeparator = () => (
    <div
      className={`${sizeClasses[size]} font-bold opacity-50 mx-2`}
      style={{ color: palette?.accent || palette?.text || '#ffffff' }}
    >
      :
    </div>
  );

  if (timeLeft.total <= 0) {
    return (
      <div
        className={`${sizeClasses[size]} font-bold animate-pulse`}
        style={{ color: palette?.accent || '#22c55e' }}
      >
        Starting...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      {timeLeft.days > 0 && (
        <>
          {renderDigit(timeLeft.days, 'days')}
          {renderSeparator()}
        </>
      )}
      {renderDigit(timeLeft.hours, 'hrs')}
      {renderSeparator()}
      {renderDigit(timeLeft.minutes, 'min')}
      {showSeconds && (
        <>
          {renderSeparator()}
          {renderDigit(timeLeft.seconds, 'sec')}
        </>
      )}
    </div>
  );
}
