# WebSocket API: Theatarr

**Feature**: 001-cinema-orchestrator
**Date**: 2026-02-05

## Overview

WebSocket est utilisé pour la communication temps réel bidirectionnelle :
- Contrôle session (play/pause/skip/stop) avec latence <200ms
- Mise à jour wallmount en temps réel
- Résultats de vote live
- Notifications état services

## Connection

**Endpoint**: `ws://localhost:8080/api/v1/ws`

**Authentication**:
- Admin: JWT token dans query param `?token=<jwt>`
- Wallmount public: `?wallmount=true` (si pas de token requis)
- Vote: `?vote_token=<token>`

```javascript
// Admin connection
const ws = new WebSocket('ws://localhost:8080/api/v1/ws?token=eyJ...');

// Wallmount public
const ws = new WebSocket('ws://localhost:8080/api/v1/ws?wallmount=true');

// Vote page
const ws = new WebSocket('ws://localhost:8080/api/v1/ws?vote_token=abc123');
```

## Message Format

Tous les messages sont en JSON avec structure commune :

```typescript
interface Message {
  type: string;           // Type de message
  payload: object;        // Données spécifiques
  timestamp: string;      // ISO 8601
  request_id?: string;    // Pour corrélation request/response
}
```

## Client → Server Messages

### Subscribe to Channel

S'abonner à un canal pour recevoir les mises à jour.

```json
{
  "type": "subscribe",
  "payload": {
    "channel": "session:uuid-here"
  }
}
```

**Channels disponibles**:
- `session:{session_id}` - État session et séquences
- `wallmount` - Mises à jour wallmount (session courante)
- `vote:{vote_session_id}` - Résultats vote en direct
- `services` - Statut services (admin only)

### Unsubscribe

```json
{
  "type": "unsubscribe",
  "payload": {
    "channel": "session:uuid-here"
  }
}
```

### Session Control (Admin only)

```json
{
  "type": "session_control",
  "payload": {
    "session_id": "uuid-here",
    "action": "play"  // play | pause | skip | stop | restart
  },
  "request_id": "req-123"
}
```

### Ping

Keep-alive ping (recommandé toutes les 30s).

```json
{
  "type": "ping"
}
```

## Server → Client Messages

### Subscription Confirmed

```json
{
  "type": "subscribed",
  "payload": {
    "channel": "session:uuid-here"
  }
}
```

### Session State Update

Envoyé sur le canal `session:{id}` à chaque changement d'état.

```json
{
  "type": "session_state",
  "payload": {
    "session_id": "uuid-here",
    "status": "running",
    "current_sequence_index": 2,
    "current_sequence_elapsed_ms": 15000,
    "total_sequences": 5,
    "current_sequence": {
      "id": "uuid",
      "name": "Pre-show",
      "duration_type": "fixed",
      "duration_ms": 60000,
      "remaining_ms": 45000
    }
  },
  "timestamp": "2026-02-05T20:30:00.000Z"
}
```

### Sequence Transition

Envoyé quand une séquence se termine et la suivante commence.

```json
{
  "type": "sequence_transition",
  "payload": {
    "session_id": "uuid-here",
    "from_sequence": {
      "id": "uuid",
      "name": "Pre-show",
      "index": 1
    },
    "to_sequence": {
      "id": "uuid",
      "name": "Movie",
      "index": 2
    },
    "transition_ms": 2000
  },
  "timestamp": "2026-02-05T20:31:00.000Z"
}
```

### Action Executed

Notification qu'une action a été exécutée (debug/logs).

```json
{
  "type": "action_executed",
  "payload": {
    "session_id": "uuid",
    "sequence_id": "uuid",
    "action_id": "uuid",
    "action_type": "lighting",
    "command": "set_color",
    "service_id": "uuid",
    "success": true,
    "duration_ms": 45
  },
  "timestamp": "2026-02-05T20:30:00.100Z"
}
```

### Action Failed

Notification d'échec d'action.

```json
{
  "type": "action_failed",
  "payload": {
    "session_id": "uuid",
    "sequence_id": "uuid",
    "action_id": "uuid",
    "action_type": "lighting",
    "command": "set_color",
    "service_id": "uuid",
    "error": "Connection timeout",
    "on_failure": "warn",
    "continued": true
  },
  "timestamp": "2026-02-05T20:30:00.500Z"
}
```

### Wallmount Update

Envoyé sur le canal `wallmount` à chaque changement pertinent.

```json
{
  "type": "wallmount_update",
  "payload": {
    "session": {
      "id": "uuid",
      "name": "Movie Night",
      "status": "running"
    },
    "movie": {
      "id": "uuid",
      "title": "Interstellar",
      "year": 2014,
      "poster_url": "https://...",
      "synopsis": "...",
      "runtime_minutes": 169,
      "genres": ["Sci-Fi", "Drama"]
    },
    "current_sequence": {
      "id": "uuid",
      "name": "Pre-show",
      "index": 1,
      "total": 4
    },
    "countdown_seconds": 300,
    "palette": {
      "dominant": "#1a1a2e",
      "vibrant": "#e94560",
      "muted": "#0f3460"
    },
    "template_id": "uuid"
  },
  "timestamp": "2026-02-05T20:25:00.000Z"
}
```

### Vote Update

Envoyé sur le canal `vote:{id}` à chaque nouveau vote.

```json
{
  "type": "vote_update",
  "payload": {
    "vote_session_id": "uuid",
    "total_votes": 8,
    "results": [
      {
        "movie_id": "uuid",
        "title": "Interstellar",
        "votes": 5,
        "percentage": 62.5
      },
      {
        "movie_id": "uuid",
        "title": "The Dark Knight",
        "votes": 3,
        "percentage": 37.5
      }
    ]
  },
  "timestamp": "2026-02-05T19:45:00.000Z"
}
```

### Vote Closed

```json
{
  "type": "vote_closed",
  "payload": {
    "vote_session_id": "uuid",
    "winner": {
      "movie_id": "uuid",
      "title": "Interstellar",
      "votes": 5
    },
    "final_results": [...]
  },
  "timestamp": "2026-02-05T20:00:00.000Z"
}
```

### Service Status Update

Envoyé sur le canal `services` (admin) quand un service change d'état.

```json
{
  "type": "service_status",
  "payload": {
    "service_id": "uuid",
    "name": "Living Room Hue",
    "previous_status": "connected",
    "new_status": "disconnected",
    "reason": "Connection timeout"
  },
  "timestamp": "2026-02-05T20:30:00.000Z"
}
```

### Control Response

Réponse à une commande de contrôle.

```json
{
  "type": "control_response",
  "payload": {
    "success": true,
    "action": "play",
    "session_id": "uuid",
    "new_state": {
      "status": "running",
      "current_sequence_index": 0
    }
  },
  "request_id": "req-123",
  "timestamp": "2026-02-05T20:30:00.050Z"
}
```

### Error

```json
{
  "type": "error",
  "payload": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  },
  "request_id": "req-123",
  "timestamp": "2026-02-05T20:30:00.000Z"
}
```

**Error codes**:
- `UNAUTHORIZED` - Token invalide ou expiré
- `FORBIDDEN` - Permission insuffisante
- `NOT_FOUND` - Ressource introuvable
- `INVALID_MESSAGE` - Format message invalide
- `CHANNEL_NOT_FOUND` - Canal inexistant
- `SESSION_NOT_RUNNING` - Session pas en cours

### Pong

Réponse au ping.

```json
{
  "type": "pong",
  "timestamp": "2026-02-05T20:30:00.000Z"
}
```

## Connection Lifecycle

1. **Connect**: Client ouvre WebSocket avec token approprié
2. **Authenticate**: Server valide token, répond avec `connected` ou `error`
3. **Subscribe**: Client s'abonne aux canaux souhaités
4. **Receive**: Client reçoit les mises à jour des canaux abonnés
5. **Send**: Client peut envoyer des commandes (si autorisé)
6. **Ping/Pong**: Maintenir la connexion active
7. **Disconnect**: Graceful close ou timeout

## Reconnection Strategy

Le client doit implémenter une stratégie de reconnexion :

```javascript
class ReconnectingWebSocket {
  maxRetries = 5;
  baseDelay = 1000;  // 1s
  maxDelay = 30000;  // 30s

  connect() {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay
    );
  }
}
```

## Rate Limiting

- Max 10 messages/seconde par connexion
- Max 100 connexions simultanées par IP
- Ping obligatoire toutes les 60s sinon déconnexion

---

*API WebSocket alignée avec FR-002 (200ms latence) et FR-018 (vote temps réel).*
