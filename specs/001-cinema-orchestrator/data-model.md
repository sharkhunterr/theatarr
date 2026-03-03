# Data Model: Theatarr

**Feature**: 001-cinema-orchestrator
**Date**: 2026-02-05

## Entity Relationship Diagram (Conceptual)

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Session   │1─────N│  Sequence   │N─────1│   Service   │
└─────────────┘       └─────────────┘       └─────────────┘
      │1                    │N                    │1
      │                     │                     │
      │N                    │1                    │N
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ VoteSession │       │   Action    │       │  Capability │
└─────────────┘       └─────────────┘       └─────────────┘
      │1
      │
      │N
┌─────────────┐
│    Vote     │
└─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Movie     │1─────1│ColorPalette │       │   Trailer   │
└─────────────┘       └─────────────┘       └─────────────┘
      │1                                          │N
      │                                           │
      │N                                          │1
┌─────────────┐                             ┌─────────────┐
│  Template   │                             │ TrailerRule │
└─────────────┘                             └─────────────┘
```

---

## Entities

### Session

Le conteneur principal d'une expérience cinéma.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| name | String(255) | NOT NULL | Nom de la session |
| movie_id | UUID | FK → Movie, NULL | Film associé (optionnel) |
| status | Enum | NOT NULL, default='draft' | draft, scheduled, running, paused, completed, interrupted |
| scheduled_at | DateTime | NULL | Date/heure de démarrage programmé |
| started_at | DateTime | NULL | Timestamp de démarrage effectif |
| completed_at | DateTime | NULL | Timestamp de fin |
| current_sequence_index | Integer | default=0 | Index de la séquence en cours |
| current_sequence_elapsed_ms | Integer | default=0 | Temps écoulé dans la séquence courante (pour reprise) |
| auto_resume_enabled | Boolean | default=true | Reprise auto après redémarrage |
| created_at | DateTime | NOT NULL | Timestamp création |
| updated_at | DateTime | NOT NULL | Timestamp dernière modification |

**State Transitions**:
```
draft → scheduled (quand scheduled_at défini)
scheduled → running (au démarrage manuel ou à l'heure programmée)
running → paused (action utilisateur)
paused → running (action utilisateur)
running → completed (toutes séquences terminées)
running → interrupted (redémarrage système, erreur critique)
interrupted → running (reprise auto si enabled)
* → draft (reset session)
```

**Validation Rules**:
- `scheduled_at` doit être dans le futur si status = 'scheduled'
- `current_sequence_index` < nombre de séquences

---

### Sequence

Bloc atomique d'orchestration définissant un état environnemental complet.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| session_id | UUID | FK → Session, NOT NULL | Session parente |
| name | String(255) | NOT NULL | Nom de la séquence |
| order_index | Integer | NOT NULL | Position dans la session (0-based) |
| duration_type | Enum | NOT NULL | fixed, dynamic, manual |
| duration_ms | Integer | NULL | Durée fixe en ms (si type=fixed) |
| duration_fallback_ms | Integer | default=60000 | Durée fallback si dynamic échoue |
| transition_ms | Integer | default=1000 | Durée de la transition d'entrée |
| node_editor_data | JSON | NULL | Données React Flow (mode graphique) |
| created_at | DateTime | NOT NULL | |
| updated_at | DateTime | NOT NULL | |

**Unique Constraint**: (session_id, order_index)

---

### Action

Une action atomique au sein d'une séquence (éclairage, audio, etc.).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| sequence_id | UUID | FK → Sequence, NOT NULL | Séquence parente |
| service_id | UUID | FK → Service, NULL | Service cible (NULL = mock) |
| action_type | Enum | NOT NULL | lighting, audio, display, media, actuator |
| command | String(100) | NOT NULL | Commande (set_color, play, stop, etc.) |
| parameters | JSON | NOT NULL | Paramètres de la commande |
| delay_ms | Integer | default=0 | Délai avant exécution |
| on_failure | Enum | default='warn' | warn, skip, abort |
| created_at | DateTime | NOT NULL | |

**Parameter schemas by action_type**:

```json
// lighting
{
  "color": "#FF5500",
  "intensity": 75,
  "effect": "fade",
  "transition_ms": 2000,
  "targets": ["group:living-room", "light:lamp-1"]
}

// audio
{
  "source": "local",
  "path": "/trailers/ambient-01.mp3",
  "volume": 30,
  "fade_in_ms": 1000,
  "loop": true
}

// display
{
  "mode": "wallmount",
  "template_id": "uuid",
  "content": "movie_info"
}

// media
{
  "action": "play",
  "media_id": "plex://movie/12345",
  "position_ms": 0
}

// actuator
{
  "device": "projector",
  "command": "power_on"
}
```

---

### Service

Représentation d'un service externe connecté.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| name | String(255) | NOT NULL | Nom affiché |
| adapter_type | String(100) | NOT NULL | Type d'adaptateur (hue, plex, androidtv...) |
| category | Enum | NOT NULL | lighting, player, media_source, actuator, metadata |
| config | JSON | NOT NULL | Configuration spécifique à l'adaptateur (encrypted sensibles) |
| is_enabled | Boolean | default=true | Activé/désactivé |
| connection_status | Enum | default='unknown' | connected, disconnected, error, unknown |
| last_seen_at | DateTime | NULL | Dernier contact réussi |
| capabilities | JSON | NULL | Capacités découvertes (cache) |
| created_at | DateTime | NOT NULL | |
| updated_at | DateTime | NOT NULL | |

**Config schemas by adapter_type**:

```json
// hue
{
  "bridge_ip": "192.168.1.10",
  "api_key": "encrypted:...",
  "groups": ["Living Room", "Cinema"]
}

// plex
{
  "server_url": "http://192.168.1.5:32400",
  "token": "encrypted:...",
  "library_sections": [1, 2]
}

// androidtv
{
  "host": "192.168.1.20",
  "adb_key_path": "/config/adbkey"
}
```

---

### Template

Définition d'affichage wallmount.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| name | String(255) | NOT NULL | Nom du template |
| description | Text | NULL | Description |
| layout | JSON | NOT NULL | Structure du layout |
| styles | JSON | NOT NULL | Styles CSS/animations |
| variables | JSON | NOT NULL | Variables disponibles |
| is_default | Boolean | default=false | Template par défaut |
| is_builtin | Boolean | default=false | Fourni par Theatarr (non supprimable) |
| created_at | DateTime | NOT NULL | |
| updated_at | DateTime | NOT NULL | |

---

### Movie

Entité film avec métadonnées.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| title | String(500) | NOT NULL | Titre |
| original_title | String(500) | NULL | Titre original |
| year | Integer | NULL | Année de sortie |
| synopsis | Text | NULL | Synopsis |
| genres | JSON | default=[] | Liste des genres |
| rating | Float | NULL | Note (0-10) |
| runtime_minutes | Integer | NULL | Durée en minutes |
| poster_url | String(1000) | NULL | URL affiche principale |
| backdrop_url | String(1000) | NULL | URL backdrop |
| poster_local_path | String(500) | NULL | Chemin local si téléchargé |
| tmdb_id | Integer | NULL, UNIQUE | ID TMDB |
| plex_key | String(100) | NULL | Clé Plex |
| jellyfin_id | String(100) | NULL | ID Jellyfin |
| trailer_url | String(1000) | NULL | URL trailer YouTube |
| source | Enum | NOT NULL | plex, jellyfin, tmdb, manual |
| metadata_updated_at | DateTime | NULL | Dernier refresh métadonnées |
| created_at | DateTime | NOT NULL | |

---

### ColorPalette

Palette de couleurs extraite d'une affiche.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| movie_id | UUID | FK → Movie, NOT NULL, UNIQUE | Film associé |
| source_image | Enum | NOT NULL | poster, backdrop |
| dominant | String(7) | NOT NULL | Couleur dominante (#RRGGBB) |
| vibrant | String(7) | NULL | Couleur vibrante |
| muted | String(7) | NULL | Couleur atténuée |
| dark_vibrant | String(7) | NULL | Vibrant sombre |
| dark_muted | String(7) | NULL | Atténué sombre |
| light_vibrant | String(7) | NULL | Vibrant clair |
| light_muted | String(7) | NULL | Atténué clair |
| is_manual_override | Boolean | default=false | Modifié manuellement |
| created_at | DateTime | NOT NULL | |

---

### VoteSession

Session de vote pour sélection de film.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| session_id | UUID | FK → Session, NULL | Session cinéma associée |
| name | String(255) | NOT NULL | Nom de la session de vote |
| status | Enum | NOT NULL | open, closed |
| candidate_movie_ids | JSON | NOT NULL | Liste UUIDs des films candidats (2-6) |
| winner_movie_id | UUID | FK → Movie, NULL | Film gagnant |
| expires_at | DateTime | NOT NULL | Date d'expiration |
| created_at | DateTime | NOT NULL | |
| closed_at | DateTime | NULL | Date de clôture |

**Validation Rules**:
- 2 ≤ len(candidate_movie_ids) ≤ 6
- expires_at > created_at

---

### Vote

Un vote individuel.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| vote_session_id | UUID | FK → VoteSession, NOT NULL | Session de vote |
| movie_id | UUID | FK → Movie, NOT NULL | Film voté |
| token_hash | String(64) | NOT NULL | Hash du token (SHA-256) |
| voted_at | DateTime | NOT NULL | Timestamp du vote |
| ip_address | String(45) | NULL | IP (pour analytics, pas validation) |

**Unique Constraint**: (vote_session_id, token_hash)

---

### VoteToken

Token d'accès au vote.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| vote_session_id | UUID | FK → VoteSession, NOT NULL | Session de vote |
| token_hash | String(64) | NOT NULL, UNIQUE | Hash du token |
| is_used | Boolean | default=false | Token utilisé |
| expires_at | DateTime | NOT NULL | Expiration |
| created_at | DateTime | NOT NULL | |

---

### Trailer

Bande-annonce téléchargée.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| title | String(500) | NOT NULL | Titre du film |
| movie_tmdb_id | Integer | NULL | ID TMDB du film |
| genres | JSON | default=[] | Genres |
| year | Integer | NULL | Année |
| quality | String(20) | NOT NULL | 720p, 1080p, 4k |
| file_path | String(500) | NOT NULL, UNIQUE | Chemin fichier local |
| file_size_bytes | BigInteger | NOT NULL | Taille fichier |
| duration_seconds | Integer | NULL | Durée |
| source_url | String(1000) | NOT NULL | URL source (YouTube) |
| downloaded_at | DateTime | NOT NULL | Date téléchargement |
| last_played_at | DateTime | NULL | Dernière lecture |
| play_count | Integer | default=0 | Nombre de lectures |
| is_excluded | Boolean | default=false | Exclus des sélections auto |

---

### TrailerRule

Règle de téléchargement automatique.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| name | String(255) | NOT NULL | Nom de la règle |
| is_enabled | Boolean | default=true | Règle active |
| genres | JSON | NULL | Filtrer par genres (NULL = tous) |
| year_min | Integer | NULL | Année minimum |
| year_max | Integer | NULL | Année maximum |
| popularity_min | Float | NULL | Popularité TMDB minimum |
| language | String(10) | NULL | Langue (fr, en, etc.) |
| quality_preference | JSON | default=["1080p","720p"] | Ordre de préférence qualité |
| max_count | Integer | NULL | Nombre max de trailers pour cette règle |
| storage_limit_gb | Float | NULL | Limite stockage en GB |
| exclude_library_movies | Boolean | default=true | Exclure films déjà en bibliothèque |
| schedule_cron | String(100) | default="0 3 * * *" | Cron expression |
| last_run_at | DateTime | NULL | Dernière exécution |
| created_at | DateTime | NOT NULL | |
| updated_at | DateTime | NOT NULL | |

---

### User (Admin)

Utilisateur administrateur.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Identifiant unique |
| username | String(100) | NOT NULL, UNIQUE | Nom d'utilisateur |
| password_hash | String(255) | NOT NULL | Hash bcrypt |
| is_active | Boolean | default=true | Compte actif |
| last_login_at | DateTime | NULL | Dernière connexion |
| created_at | DateTime | NOT NULL | |

---

### Settings

Configuration globale de l'application.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| key | String(100) | PK | Clé de configuration |
| value | JSON | NOT NULL | Valeur |
| updated_at | DateTime | NOT NULL | |

**Keys prédéfinies**:
- `vote_token_expiry_hours`: 24
- `wallmount_requires_token`: false
- `tmdb_api_key`: "encrypted:..."
- `tmdb_cache_ttl_hours`: 168 (7 jours)
- `trailer_storage_path`: "/data/trailers"
- `auto_resume_sessions`: true
- `default_template_id`: "uuid"

---

## Indexes

```sql
-- Performance queries
CREATE INDEX idx_session_status ON sessions(status);
CREATE INDEX idx_session_scheduled ON sessions(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_sequence_session_order ON sequences(session_id, order_index);
CREATE INDEX idx_action_sequence ON actions(sequence_id);
CREATE INDEX idx_service_category ON services(category, is_enabled);
CREATE INDEX idx_trailer_genres ON trailers USING GIN(genres);
CREATE INDEX idx_movie_tmdb ON movies(tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX idx_vote_session_token ON votes(vote_session_id, token_hash);
```

---

*Modèle aligné avec la constitution. Toutes les entités Key Entities de la spec sont couvertes.*
