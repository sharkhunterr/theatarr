/**
 * WebSocket hook for real-time communication.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

function getWsUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  // No URL or mixed content (HTTPS page + HTTP API) → use page origin via proxy
  if (!envUrl || (typeof window !== 'undefined' && window.location.protocol === 'https:' && envUrl.startsWith('http://'))) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return envUrl.replace('http://', 'ws://').replace('https://', 'wss://');
}

const WS_URL = getWsUrl();

interface WebSocketMessage {
  type: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
  request_id?: string;
}

interface UseWebSocketOptions {
  token?: string | null;
  wallmount?: boolean;
  voteToken?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: WebSocketMessage) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  lastMessage: WebSocketMessage | null;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    token,
    wallmount = false,
    voteToken,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs for callbacks to avoid triggering reconnects when they change
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  onErrorRef.current = onError;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (wallmount) params.set('wallmount', 'true');
    if (voteToken) params.set('vote_token', voteToken);

    const queryString = params.toString();
    return `${WS_URL}/api/v1/ws${queryString ? `?${queryString}` : ''}`;
  }, [token, wallmount, voteToken]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    const ws = new WebSocket(buildUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      reconnectCountRef.current = 0;
      onConnectRef.current?.();

      // Start ping interval (every 30 seconds)
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      onDisconnectRef.current?.();

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Attempt reconnect with exponential backoff
      if (reconnectCountRef.current < reconnectAttempts) {
        const delay = Math.min(
          reconnectInterval * Math.pow(2, reconnectCountRef.current),
          30000
        );
        reconnectCountRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (event) => {
      onErrorRef.current?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(message);
        onMessageRef.current?.(message);
      } catch {
        console.error('Failed to parse WebSocket message:', event.data);
      }
    };
  }, [
    buildUrl,
    reconnectAttempts,
    reconnectInterval,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    reconnectCountRef.current = reconnectAttempts; // Prevent reconnect

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [reconnectAttempts]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback(
    (channel: string) => {
      send({ type: 'subscribe', payload: { channel } });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      send({ type: 'unsubscribe', payload: { channel } });
    },
    [send]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    lastMessage,
  };
}
