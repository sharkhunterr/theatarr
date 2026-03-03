# Feature Specification: Theatarr - Home Cinema Orchestration System

**Feature Branch**: `001-cinema-orchestrator`
**Created**: 2026-02-05
**Status**: Draft
**Input**: User description: "Theatarr - Orchestrateur de sessions cinéma maison pour l'écosystème Xenocloud"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execute a Cinema Session (Priority: P1)

As a home cinema enthusiast, I want to start a pre-configured cinema session that automatically orchestrates my lighting, audio ambiance, and media player so that I can enjoy a seamless movie experience without manual interventions.

**Why this priority**: This is the core value proposition of Theatarr. Without session execution, the product has no purpose. A working session with basic sequence playback delivers immediate, tangible value.

**Independent Test**: Can be fully tested by creating a session with 3 sequences (welcome, pre-show, movie), starting the session, and verifying each sequence transitions correctly with observable state changes (lights dim, audio plays, media starts).

**Acceptance Scenarios**:

1. **Given** a session with 3 sequences configured, **When** I start the session, **Then** sequences execute in order with correct timing between transitions
2. **Given** a running session, **When** I pause the session, **Then** all controlled devices hold their current state and the countdown timer pauses
3. **Given** a running session, **When** I skip to the next sequence, **Then** the current sequence ends gracefully and the next one begins
4. **Given** a sequence with lighting instructions, **When** that sequence activates, **Then** connected lights change to the specified color, intensity, and effect within the configured transition time

---

### User Story 2 - Create and Edit Sequences (Priority: P2)

As a session creator, I want to design sequences that define the complete environment state (lighting, audio, display, media) so that I can craft personalized cinema experiences.

**Why this priority**: Without the ability to create sequences, users cannot build custom experiences. This directly enables User Story 1.

**Independent Test**: Can be tested by creating a new sequence, configuring lighting (color: blue, intensity: 50%), audio (ambient playlist, volume: 30%), and display (wallmount with movie info), saving it, and verifying all settings persist correctly.

**Acceptance Scenarios**:

1. **Given** I am in the sequence editor, **When** I configure lighting parameters (color, intensity, effect, transition), **Then** the sequence saves these settings and displays a preview
2. **Given** I am editing a session, **When** I drag and drop sequences to reorder them, **Then** the execution order updates accordingly
3. **Given** I have created a sequence, **When** I duplicate it, **Then** a copy is created with all settings preserved and a unique name
4. **Given** I am in graphical mode (node editor), **When** I connect two sequence nodes, **Then** the connection defines the execution flow between them

---

### User Story 3 - Connect and Configure Services (Priority: P3)

As an administrator, I want to connect my home automation services (lights, media players, media servers) so that Theatarr can control them during sessions.

**Why this priority**: Service integration is required for sequences to have any effect. However, a mock/simulation mode can allow Stories 1 and 2 to function independently for testing.

**Independent Test**: Can be tested by adding a Philips Hue bridge, entering credentials, running the connection test, and verifying the system reports success and lists available light groups.

**Acceptance Scenarios**:

1. **Given** I am on the services configuration page, **When** I add a new Philips Hue integration and provide the bridge IP and API key, **Then** the system validates connectivity and lists available light groups
2. **Given** a service is configured, **When** I click "Test Connection", **Then** the system performs a live test and reports success or failure with details
3. **Given** I have multiple services of the same type, **When** I disable one, **Then** sequences using that service gracefully skip it without failing the entire sequence
4. **Given** a Plex server is connected, **When** I browse media for a session, **Then** I see my movie library with posters and metadata

---

### User Story 4 - Display Wallmount Screen (Priority: P4)

As a viewer, I want a dedicated display page showing the current movie information and countdown so that the physical screen in my cinema room displays relevant content during sessions.

**Why this priority**: The wallmount enhances the cinema experience visually but is not strictly required for basic session execution.

**Independent Test**: Can be tested by opening the wallmount URL in a browser, verifying the current session's movie poster, title, and countdown display, and confirming real-time updates when sequences change.

**Acceptance Scenarios**:

1. **Given** a session is running, **When** I open `/wallmount` in a browser, **Then** I see the movie poster, title, synopsis, and countdown timer
2. **Given** the wallmount is displayed, **When** the active sequence changes, **Then** the wallmount updates in real-time without page refresh
3. **Given** a template with color palette extraction enabled, **When** a movie is selected, **Then** the wallmount theme colors derive from the movie poster's dominant colors
4. **Given** no session is running, **When** I open `/wallmount`, **Then** I see a standby screen or the next scheduled session information

---

### User Story 5 - Vote for Movie Selection (Priority: P5)

As a guest, I want to vote for which movie to watch from a selection proposed by the host so that the group can collectively decide on the evening's movie.

**Why this priority**: Voting is a social feature that enhances the experience but is not required for core functionality.

**Independent Test**: Can be tested by creating a vote session with 3 movies, generating the vote link, opening it (without login), casting a vote, and verifying the vote counts update in real-time.

**Acceptance Scenarios**:

1. **Given** I am an administrator, **When** I create a vote session with 4 selected movies, **Then** a unique shareable link is generated
2. **Given** I have a vote link, **When** I open it in my browser, **Then** I see movie options with posters, synopses, and ratings without needing to log in
3. **Given** I am on the vote page, **When** I cast my vote, **Then** the vote is recorded and I cannot vote again with the same token
4. **Given** voting has ended, **When** the session is finalized, **Then** the winning movie is automatically assigned to the associated session

---

### User Story 6 - Manage Trailers Library (Priority: P6)

As an administrator, I want to automatically download and manage movie trailers so that sessions can include contextually relevant pre-show content.

**Why this priority**: Trailers enhance the cinema experience but are optional content management features.

**Independent Test**: Can be tested by configuring trailer download rules (genre: Action, quality: 1080p, max storage: 10GB), triggering a download, and verifying trailers appear in the library with correct metadata.

**Acceptance Scenarios**:

1. **Given** I configure trailer rules (genre, year, quality), **When** the system runs its scheduled task, **Then** matching trailers are downloaded automatically
2. **Given** the trailer storage limit is reached, **When** new trailers are downloaded, **Then** the oldest trailers are removed to maintain the limit
3. **Given** I am editing a session, **When** I select "auto-select trailers", **Then** the system picks trailers matching the main movie's genre
4. **Given** a movie in the trailers list exists in my Plex/Jellyfin library, **When** I enable "exclude library movies", **Then** that trailer is not shown

---

### User Story 7 - Import/Export Configuration (Priority: P7)

As an administrator, I want to export and import my complete Theatarr configuration so that I can backup, restore, or share my setup.

**Why this priority**: Configuration portability is important for backup and community sharing but is not required for daily operation.

**Independent Test**: Can be tested by exporting configuration to JSON, modifying one setting in Theatarr, importing the backup, and verifying the setting reverts to the exported value.

**Acceptance Scenarios**:

1. **Given** I click "Export Configuration", **When** I select JSON format, **Then** a file downloads containing all sessions, sequences, templates, and service configurations (excluding secrets)
2. **Given** I import a configuration file, **When** there are conflicts with existing data, **Then** the system prompts me to choose keep/overwrite/merge for each conflict
3. **Given** I export with "include secrets" option, **When** I provide a password, **Then** API keys and tokens are included but encrypted

---

### Edge Cases

- What happens when a connected service becomes unavailable mid-session? → Sequence continues, affected actions are logged as warnings, user is notified
- What happens when a sequence's duration is "dynamic" but the media source cannot report duration? → Falls back to a configurable default duration
- What happens when multiple users try to control the same session simultaneously? → Last command wins, all clients receive state updates via WebSocket
- What happens if the vote link is accessed after the vote session expires? → Display "voting closed" message with the winning movie shown
- What happens when the wallmount loses WebSocket connection? → Automatic reconnection with exponential backoff, display "reconnecting" indicator
- What happens when Theatarr restarts during a running session? → Session automatically resumes at the current sequence (if auto-resume enabled in settings); otherwise session is marked as interrupted and requires manual restart

## Requirements *(mandatory)*

### Functional Requirements

**Core Engine**
- **FR-001**: System MUST execute sequences in order within a session, respecting configured timing and transitions
- **FR-002**: System MUST support real-time session control (play, pause, skip, stop) with state updates delivered within 200ms
- **FR-003**: System MUST support two sequence creation modes: linear (ordered list) and graphical (node-based visual editor)
- **FR-004**: Sequences MUST define environment state including: lighting (color, intensity, effect, transition), audio (source, volume, fade), display content, media playback actions, and actuator commands
- **FR-005**: System MUST support three duration types per sequence: fixed (timer), dynamic (content-based), or manual (user-triggered)
- **FR-005b**: System MUST persist running session state and automatically resume at the current sequence after restart (configurable, enabled by default)

**Service Integration**
- **FR-006**: System MUST implement an adapter pattern where each external service is an independent module exposing a standardized interface
- **FR-007**: System MUST support hot-swap of services (enable, disable, replace) without restarting the application
- **FR-008**: Each adapter MUST expose its capabilities (supported commands, features) via a discovery mechanism
- **FR-009**: System MUST support these lighting services: Philips Hue (API v2), Home Assistant, ESPHome, Zigbee2MQTT, Govee
- **FR-010**: System MUST support these media players: Android TV (ADB), Apple TV (pyatv), Chromecast (Cast API)
- **FR-011**: System MUST support these media sources: Plex, Jellyfin

**Wallmount Display**
- **FR-012**: System MUST expose a public web page (`/wallmount`) that displays session information
- **FR-013**: Wallmount templates MUST be customizable via configuration files supporting layout, animations, and dynamic content
- **FR-014**: System MUST extract color palette from movie posters and apply to wallmount theming and ambient lighting

**Voting System**
- **FR-015**: Administrators MUST be able to create vote sessions with 2 to 6 movie candidates
- **FR-016**: Vote links MUST be accessible without user authentication (token-based access)
- **FR-017**: Each vote token MUST allow exactly one vote
- **FR-018**: Vote results MUST update in real-time for all viewers

**Trailer Management**
- **FR-019**: System MUST download trailers automatically based on configurable rules (genre, year, popularity, language, quality)
- **FR-020**: System MUST enforce storage limits with automatic rotation (oldest removed first)
- **FR-021**: System MUST categorize trailers by genre and support contextual selection for sessions

**Metadata & TMDB**
- **FR-022**: System MUST integrate with TMDB for movie metadata enrichment (optional but recommended)
- **FR-023**: System MUST cache TMDB metadata locally with configurable TTL
- **FR-024**: System MUST fall back to Plex/Jellyfin metadata when TMDB is unavailable

**Configuration**
- **FR-025**: System MUST support complete configuration export in JSON and YAML formats
- **FR-026**: System MUST exclude sensitive data (API keys, tokens) from exports by default
- **FR-027**: System MUST support import with conflict resolution (keep, overwrite, merge)

**Administration**
- **FR-028**: System MUST provide a dashboard showing upcoming sessions, current session status, connected services, and trailer storage usage
- **FR-029**: System MUST provide session history with logs
- **FR-030**: Administrative interface MUST be usable on mobile devices for emergency control

**Security**
- **FR-031**: Administrative access MUST require authentication via local credentials (username/password stored locally, consistent with *arr ecosystem conventions)
- **FR-032**: Vote pages MUST require time-limited tokens with configurable expiration (default: 24 hours). Wallmount page MUST be publicly accessible by default (token requirement configurable by admin).
- **FR-033**: System MUST NOT require any cloud services for core functionality

### Key Entities

- **Session**: A complete cinema experience containing ordered sequences, an associated movie, scheduled start time, and current execution state
- **Sequence**: An atomic orchestration block defining environment state (lighting, audio, display, media, actuators) with duration and transition settings
- **Service**: A connected external service (light, player, media source, actuator) with type, configuration, connection state, and discovered capabilities
- **Template**: A wallmount display definition including layout structure, animation rules, and dynamic content placeholders
- **VoteSession**: A voting event with candidate movies, associated session, expiration time, and vote records
- **Vote**: A single vote cast by a token for a specific movie within a vote session
- **Trailer**: A downloaded trailer file with metadata (title, genres, year, quality, file path, download date)
- **TrailerRule**: A set of criteria for automatic trailer downloading (genre filter, year range, quality preference, storage limit)
- **ColorPalette**: Extracted dominant colors from a movie poster, linked to a movie, used for theming
- **Movie**: A movie entity with metadata (title, synopsis, genres, rating, duration, posters, trailer URLs) sourced from Plex/Jellyfin/TMDB

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create and execute a complete cinema session (3+ sequences) with less than 10 minutes of configuration time
- **SC-002**: Session transitions between sequences complete within 200ms of the trigger (timer expiry, user action, or content end)
- **SC-003**: System supports at least 5 concurrent wallmount displays without degradation
- **SC-004**: Users can add a new service integration in under 5 minutes using the configuration interface
- **SC-005**: Vote pages load and display movie options within 2 seconds on standard connections
- **SC-006**: 95% of sequence commands reach connected services within 100ms of sequence activation
- **SC-007**: Configuration export/import preserves 100% of non-secret data without loss or corruption
- **SC-008**: System operates fully offline after initial setup (excluding TMDB enrichment and trailer downloads)
- **SC-009**: Administrative interface remains usable (all critical controls accessible) on screens as small as 375px width
- **SC-010**: Trailer storage management maintains disk usage within 5% of configured limits

## Clarifications

### Session 2026-02-05

- Q: Quelle méthode d'authentification pour l'administrateur ? → A: Credentials locaux (username/password stockés localement)
- Q: Durée de validité des tokens publics ? → A: Configurable par l'admin (défaut: 24h). Le wallmount est accessible sans token par défaut (configurable).
- Q: Comportement après redémarrage système ? → A: Reprise automatique de la session en cours (configurable, activé par défaut).

## Assumptions

- Users have existing home automation infrastructure (lights, media players) they wish to integrate
- Users have local media libraries accessible via Plex or Jellyfin
- The deployment environment is Docker-capable (Unraid, Linux server, NAS)
- Network latency between Theatarr and controlled devices is under 50ms (local network)
- Users are comfortable with basic configuration file editing (JSON/YAML) for advanced customization
- A single administrator manages the system; multi-admin with role-based access is out of scope for initial version
