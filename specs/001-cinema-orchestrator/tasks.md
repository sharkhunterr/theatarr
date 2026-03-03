# Tasks: Theatarr - Home Cinema Orchestration System

**Input**: Design documents from `/specs/001-cinema-orchestrator/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/

**Tests**: Tests are included per Constitution VII (Test-First & Quality - 80% coverage on core)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/theatarr/`
- **Frontend**: `frontend/src/`
- **Backend Tests**: `backend/tests/`
- **Frontend Tests**: `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project directory structure per plan.md in repository root
- [x] T002 Initialize Python backend with pyproject.toml in backend/
- [x] T003 [P] Initialize React/Vite frontend with package.json in frontend/
- [x] T004 [P] Create docker-compose.yml at repository root
- [x] T005 [P] Create .env.example with all required environment variables
- [x] T006 [P] Configure backend linting (ruff) in backend/pyproject.toml
- [x] T007 [P] Configure frontend linting (ESLint/Prettier) in frontend/
- [x] T008 [P] Create backend Dockerfile in backend/Dockerfile
- [x] T009 [P] Create frontend Dockerfile in frontend/Dockerfile

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Models Foundation

- [x] T010 Setup SQLAlchemy and database connection in backend/src/theatarr/database.py
- [x] T011 Configure Alembic migrations in backend/src/alembic/
- [x] T012 [P] Create base model mixins (timestamps, UUID) in backend/src/theatarr/models/base.py
- [x] T013 [P] Create Settings model in backend/src/theatarr/models/settings.py
- [x] T014 [P] Create User model in backend/src/theatarr/models/user.py
- [x] T015 Generate initial migration with all base models in backend/src/alembic/versions/

### Authentication & Security

- [x] T016 Create config module with environment variables in backend/src/theatarr/config.py
- [x] T017 Implement JWT authentication service in backend/src/theatarr/services/auth.py
- [x] T018 Create auth middleware in backend/src/theatarr/api/deps.py
- [x] T019 Create auth router (login, refresh) in backend/src/theatarr/api/auth.py

### API Foundation

- [x] T020 Setup FastAPI app with CORS, middleware in backend/src/theatarr/main.py
- [x] T021 [P] Create base Pydantic schemas in backend/src/theatarr/schemas/base.py
- [x] T022 [P] Create error handling utilities in backend/src/theatarr/api/errors.py
- [x] T023 Setup WebSocket manager in backend/src/theatarr/api/ws.py

### Adapter Framework

- [x] T024 Create ServiceAdapter base interface in backend/src/theatarr/adapters/base.py
- [x] T025 Create adapter registry with discovery in backend/src/theatarr/adapters/registry.py
- [x] T026 Create mock adapter for testing in backend/src/theatarr/adapters/mock.py

### Frontend Foundation

- [x] T027 Setup React Router with route definitions in frontend/src/App.tsx
- [x] T028 [P] Create API client base with auth interceptors in frontend/src/api/client.ts
- [x] T029 [P] Create WebSocket hook in frontend/src/hooks/useWebSocket.ts
- [x] T030 [P] Setup Zustand store structure in frontend/src/stores/
- [x] T031 [P] Create common UI components (Button, Card, Modal) in frontend/src/components/common/
- [x] T032 Create Login page in frontend/src/pages/Login.tsx
- [x] T033 Setup TailwindCSS configuration in frontend/tailwind.config.js

### Test Infrastructure

- [x] T034 Configure pytest with fixtures in backend/tests/conftest.py
- [x] T035 [P] Create mock adapter fixtures in backend/tests/fixtures/adapters.py
- [x] T036 [P] Configure Vitest in frontend/vite.config.ts
- [x] T037 [P] Configure Playwright in frontend/playwright.config.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Execute a Cinema Session (Priority: P1) 🎯 MVP

**Goal**: Start a pre-configured session that orchestrates lighting, audio, and media automatically

**Independent Test**: Create session with 3 sequences, start session, verify sequences execute in order with transitions

### Tests for User Story 1

- [x] T038 [P] [US1] Unit test for sequence engine in backend/tests/unit/test_engine.py
- [x] T039 [P] [US1] Integration test for session flow in backend/tests/integration/test_session_flow.py
- [x] T040 [P] [US1] Contract test for session API in backend/tests/contract/test_sessions_api.py

### Backend Implementation US1

- [x] T041 [P] [US1] Create Session model in backend/src/theatarr/models/session.py
- [x] T042 [P] [US1] Create Sequence model in backend/src/theatarr/models/sequence.py
- [x] T043 [P] [US1] Create Action model in backend/src/theatarr/models/action.py
- [x] T044 [US1] Create Session Pydantic schemas in backend/src/theatarr/schemas/session.py
- [x] T045 [US1] Create Sequence Pydantic schemas in backend/src/theatarr/schemas/sequence.py
- [x] T046 [US1] Implement sequence execution engine in backend/src/theatarr/services/engine.py
- [x] T047 [US1] Implement session scheduler service in backend/src/theatarr/services/scheduler.py
- [x] T048 [US1] Implement session state persistence for auto-resume in backend/src/theatarr/services/engine.py
- [x] T049 [US1] Create sessions API router (CRUD, control) in backend/src/theatarr/api/sessions.py
- [x] T050 [US1] Create sequences API router in backend/src/theatarr/api/sequences.py
- [x] T051 [US1] Implement WebSocket session state broadcasting in backend/src/theatarr/api/ws.py
- [x] T052 [US1] Generate migration for Session, Sequence, Action in backend/src/alembic/versions/

### Frontend Implementation US1

- [x] T053 [P] [US1] Create session store with WebSocket sync in frontend/src/stores/sessionStore.ts
- [x] T054 [P] [US1] Create useSession hook in frontend/src/hooks/useSession.ts
- [x] T055 [US1] Create SessionList component in frontend/src/components/sessions/SessionList.tsx
- [x] T056 [US1] Create SessionCard component in frontend/src/components/sessions/SessionCard.tsx
- [x] T057 [US1] Create SessionControls component (play/pause/skip/stop) in frontend/src/components/sessions/SessionControls.tsx
- [x] T058 [US1] Create SessionPage with controls in frontend/src/pages/SessionPage.tsx
- [x] T059 [US1] Create Dashboard with session status in frontend/src/pages/Dashboard.tsx

**Checkpoint**: User Story 1 functional - sessions can be executed with real-time control

---

## Phase 4: User Story 2 - Create and Edit Sequences (Priority: P2)

**Goal**: Design sequences with lighting, audio, display, and media configuration

**Independent Test**: Create sequence, configure lighting (blue, 50%), audio (ambient, 30%), save, verify persistence

### Tests for User Story 2

- [x] T060 [P] [US2] Unit test for sequence validation in backend/tests/unit/test_sequence_validation.py
- [x] T061 [P] [US2] Frontend component test for editors in frontend/tests/components/SequenceEditor.test.tsx

### Backend Implementation US2

- [x] T062 [US2] Add sequence duplication endpoint in backend/src/theatarr/api/sequences.py
- [x] T063 [US2] Add sequence reordering endpoint in backend/src/theatarr/api/sequences.py
- [x] T064 [US2] Add action CRUD endpoints in backend/src/theatarr/api/sequences.py
- [x] T065 [US2] Implement action parameter validation in backend/src/theatarr/schemas/action.py

### Frontend Implementation US2

- [x] T066 [US2] Create SequenceEditor component in frontend/src/components/sequences/SequenceEditor.tsx
- [x] T067 [US2] Create LinearEditor (drag & drop) in frontend/src/components/sequences/LinearEditor.tsx
- [x] T068 [US2] Create NodeEditor (React Flow) in frontend/src/components/sequences/NodeEditor.tsx
- [x] T069 [US2] Create ActionEditor component in frontend/src/components/sequences/ActionEditor.tsx
- [x] T070 [US2] Create LightingActionForm in frontend/src/components/sequences/actions/LightingActionForm.tsx
- [x] T071 [US2] Create AudioActionForm in frontend/src/components/sequences/actions/AudioActionForm.tsx
- [x] T072 [US2] Create MediaActionForm in frontend/src/components/sequences/actions/MediaActionForm.tsx
- [x] T073 [US2] Create DisplayActionForm in frontend/src/components/sequences/actions/DisplayActionForm.tsx
- [x] T074 [US2] Implement sequence preview in SequenceEditor in frontend/src/components/sequences/SequencePreview.tsx
- [x] T075 [US2] Create SessionEditor page with sequence management in frontend/src/pages/SessionEditor.tsx

**Checkpoint**: User Story 2 functional - sequences can be created and edited with both modes

---

## Phase 5: User Story 3 - Connect and Configure Services (Priority: P3)

**Goal**: Connect external services (Hue, Plex, Android TV) with configuration and testing

**Independent Test**: Add Philips Hue, enter credentials, test connection, verify light groups listed

### Tests for User Story 3

- [x] T076 [P] [US3] Unit test for adapter registry in backend/tests/unit/test_adapter_registry.py
- [x] T077 [P] [US3] Unit test for Hue adapter (mocked) in backend/tests/unit/test_adapters/test_hue.py
- [x] T078 [P] [US3] Unit test for Plex adapter (mocked) in backend/tests/unit/test_adapters/test_plex.py

### Backend Implementation US3

- [x] T079 [P] [US3] Create Service model in backend/src/theatarr/models/service.py
- [x] T080 [US3] Create Service Pydantic schemas in backend/src/theatarr/schemas/service.py
- [x] T081 [US3] Create services API router in backend/src/theatarr/api/services.py
- [x] T082 [US3] Implement service connection test endpoint in backend/src/theatarr/api/services.py
- [x] T083 [US3] Implement capabilities discovery endpoint in backend/src/theatarr/api/services.py
- [x] T084 [P] [US3] Implement Hue adapter in backend/src/theatarr/adapters/lighting/hue.py
- [x] T085 [P] [US3] Implement Home Assistant adapter in backend/src/theatarr/adapters/lighting/homeassistant.py
- [x] T086 [P] [US3] Implement ESPHome adapter in backend/src/theatarr/adapters/lighting/esphome.py
- [x] T087 [P] [US3] Implement Plex adapter in backend/src/theatarr/adapters/media/plex.py
- [x] T088 [P] [US3] Implement Jellyfin adapter in backend/src/theatarr/adapters/media/jellyfin.py
- [x] T089 [P] [US3] Implement Android TV adapter in backend/src/theatarr/adapters/players/androidtv.py
- [x] T090 [P] [US3] Implement Apple TV adapter in backend/src/theatarr/adapters/players/appletv.py
- [x] T091 [P] [US3] Implement Chromecast adapter in backend/src/theatarr/adapters/players/chromecast.py
- [x] T092 [US3] Generate migration for Service model in backend/src/alembic/versions/

### Frontend Implementation US3

- [x] T093 [US3] Create ServicesConfig page in frontend/src/pages/ServicesConfig.tsx
- [x] T094 [US3] Create ServiceCard component in frontend/src/components/services/ServiceCard.tsx
- [x] T095 [US3] Create ServiceForm component in frontend/src/components/services/ServiceForm.tsx
- [x] T096 [US3] Create ConnectionTestButton component in frontend/src/components/services/ConnectionTestButton.tsx
- [x] T097 [US3] Create CapabilitiesDisplay component in frontend/src/components/services/CapabilitiesDisplay.tsx
- [x] T098 [US3] Add services status to Dashboard in frontend/src/pages/Dashboard.tsx

**Checkpoint**: User Story 3 functional - services can be configured and tested

---

## Phase 6: User Story 4 - Display Wallmount Screen (Priority: P4)

**Goal**: Public display page showing movie info, countdown, with dynamic theming

**Independent Test**: Open /wallmount during session, verify poster, title, countdown, real-time updates

### Tests for User Story 4

- [x] T099 [P] [US4] Unit test for palette extraction in backend/tests/unit/test_palette.py
- [x] T100 [P] [US4] Integration test for wallmount WebSocket in backend/tests/integration/test_wallmount_ws.py

### Backend Implementation US4

- [x] T101 [P] [US4] Create Movie model in backend/src/theatarr/models/movie.py
- [x] T102 [P] [US4] Create ColorPalette model in backend/src/theatarr/models/palette.py
- [x] T103 [P] [US4] Create Template model in backend/src/theatarr/models/template.py
- [x] T104 [US4] Implement palette extraction service in backend/src/theatarr/services/palette.py
- [x] T105 [US4] Create wallmount API router in backend/src/theatarr/api/wallmount.py
- [x] T106 [US4] Create templates API router in backend/src/theatarr/api/templates.py
- [x] T107 [US4] Add wallmount WebSocket channel in backend/src/theatarr/api/ws.py
- [x] T108 [US4] Create default builtin templates in backend/src/theatarr/data/templates/
- [x] T109 [US4] Generate migration for Movie, ColorPalette, Template in backend/src/alembic/versions/

### Frontend Implementation US4

- [x] T110 [US4] Create WallmountPage (public) in frontend/src/pages/WallmountPage.tsx
- [x] T111 [US4] Create MovieInfo component in frontend/src/components/wallmount/MovieInfo.tsx
- [x] T112 [US4] Create CountdownTimer component in frontend/src/components/wallmount/CountdownTimer.tsx
- [x] T113 [US4] Create TemplateRenderer component in frontend/src/components/wallmount/TemplateRenderer.tsx
- [x] T114 [US4] Implement Vibrant.js palette extraction in frontend/src/utils/palette.ts
- [x] T115 [US4] Create TemplateManager page in frontend/src/pages/TemplateManager.tsx
- [x] T116 [US4] Create TemplateEditor component in frontend/src/components/templates/TemplateEditor.tsx
- [x] T117 [US4] Create TemplatePreview component in frontend/src/components/templates/TemplatePreview.tsx

**Checkpoint**: User Story 4 functional - wallmount displays session with dynamic theming

---

## Phase 7: User Story 5 - Vote for Movie Selection (Priority: P5)

**Goal**: Create vote sessions, share link, collect votes, auto-assign winner

**Independent Test**: Create vote with 3 movies, open link (no login), vote, verify count updates

### Tests for User Story 5

- [x] T118 [P] [US5] Unit test for vote token validation in backend/tests/unit/test_vote_tokens.py
- [x] T119 [P] [US5] Integration test for vote flow in backend/tests/integration/test_vote_flow.py

### Backend Implementation US5

- [x] T120 [P] [US5] Create VoteSession model in backend/src/theatarr/models/vote.py
- [x] T121 [P] [US5] Create Vote model in backend/src/theatarr/models/vote.py
- [x] T122 [P] [US5] Create VoteToken model in backend/src/theatarr/models/vote.py
- [x] T123 [US5] Create Vote Pydantic schemas in backend/src/theatarr/schemas/vote.py
- [x] T124 [US5] Implement vote token generation service in backend/src/theatarr/services/vote.py
- [x] T125 [US5] Create vote-sessions API router (admin) in backend/src/theatarr/api/vote.py
- [x] T126 [US5] Create public vote API router in backend/src/theatarr/api/vote.py
- [x] T127 [US5] Add vote WebSocket channel for real-time results in backend/src/theatarr/api/ws.py
- [x] T128 [US5] Implement vote closing and winner assignment in backend/src/theatarr/services/vote.py
- [x] T129 [US5] Generate migration for VoteSession, Vote, VoteToken in backend/src/alembic/versions/

### Frontend Implementation US5

- [x] T130 [US5] Create VotePage (public, token-based) in frontend/src/pages/VotePage.tsx
- [x] T131 [US5] Create MovieVoteCard component in frontend/src/components/vote/MovieVoteCard.tsx
- [x] T132 [US5] Create VoteResults component in frontend/src/components/vote/VoteResults.tsx
- [x] T133 [US5] Create VoteSessionManager page (admin) in frontend/src/pages/VoteSessionManager.tsx
- [x] T134 [US5] Create VoteSessionForm component in frontend/src/components/vote/VoteSessionForm.tsx
- [x] T135 [US5] Create MovieSelector component in frontend/src/components/vote/MovieSelector.tsx

**Checkpoint**: User Story 5 functional - voting works with real-time results

---

## Phase 8: User Story 6 - Manage Trailers Library (Priority: P6)

**Goal**: Auto-download trailers with rules, rotation, contextual selection

**Independent Test**: Configure rule (Action, 1080p, 10GB), trigger download, verify trailer in library

### Tests for User Story 6

- [x] T136 [P] [US6] Unit test for trailer manager in backend/tests/unit/test_trailer_manager.py
- [x] T137 [P] [US6] Unit test for TMDB adapter in backend/tests/unit/test_adapters/test_tmdb.py

### Backend Implementation US6

- [x] T138 [P] [US6] Create Trailer model in backend/src/theatarr/models/trailer.py
- [x] T139 [P] [US6] Create TrailerRule model in backend/src/theatarr/models/trailer.py
- [x] T140 [US6] Create Trailer Pydantic schemas in backend/src/theatarr/schemas/trailer.py
- [x] T141 [US6] Implement TMDB adapter in backend/src/theatarr/adapters/metadata/tmdb.py
- [x] T142 [US6] Implement trailer download service (yt-dlp) in backend/src/theatarr/services/trailer_manager.py
- [x] T143 [US6] Implement storage rotation logic in backend/src/theatarr/services/trailer_manager.py
- [x] T144 [US6] Implement contextual trailer selection in backend/src/theatarr/services/trailer_manager.py
- [x] T145 [US6] Create trailers API router in backend/src/theatarr/api/trailers.py
- [x] T146 [US6] Create trailer-rules API router in backend/src/theatarr/api/trailers.py
- [x] T147 [US6] Setup scheduled task runner for trailer rules in backend/src/theatarr/services/scheduler.py
- [x] T148 [US6] Generate migration for Trailer, TrailerRule in backend/src/alembic/versions/

### Frontend Implementation US6

- [x] T149 [US6] Create TrailersManager page in frontend/src/pages/TrailersManager.tsx
- [x] T150 [US6] Create TrailerCard component in frontend/src/components/trailers/TrailerCard.tsx
- [x] T151 [US6] Create TrailerRuleForm component in frontend/src/components/trailers/TrailerRuleForm.tsx
- [x] T152 [US6] Create StorageStats component in frontend/src/components/trailers/StorageStats.tsx
- [x] T153 [US6] Add trailer stats to Dashboard in frontend/src/pages/Dashboard.tsx

**Checkpoint**: User Story 6 functional - trailers auto-download and manage

---

## Phase 9: User Story 7 - Import/Export Configuration (Priority: P7)

**Goal**: Export/import complete configuration with conflict resolution

**Independent Test**: Export JSON, change setting, import backup, verify reverted

### Tests for User Story 7

- [x] T154 [P] [US7] Unit test for config manager in backend/tests/unit/test_config_manager.py
- [x] T155 [P] [US7] Integration test for import/export flow in backend/tests/integration/test_config_import_export.py

### Backend Implementation US7

- [x] T156 [US7] Implement config export service in backend/src/theatarr/services/config_manager.py
- [x] T157 [US7] Implement config import service in backend/src/theatarr/services/config_manager.py
- [x] T158 [US7] Implement conflict detection in backend/src/theatarr/services/config_manager.py
- [x] T159 [US7] Implement secret encryption for exports in backend/src/theatarr/services/config_manager.py
- [x] T160 [US7] Create config API router (export, import, preview) in backend/src/theatarr/api/config.py
- [x] T161 [US7] Create settings API router in backend/src/theatarr/api/config.py

### Frontend Implementation US7

- [x] T162 [US7] Create ConfigPage in frontend/src/pages/ConfigPage.tsx
- [x] T163 [US7] Create ExportButton component in frontend/src/components/config/ExportButton.tsx
- [x] T164 [US7] Create ImportWizard component in frontend/src/components/config/ImportWizard.tsx
- [x] T165 [US7] Create ConflictResolver component in frontend/src/components/config/ConflictResolver.tsx
- [x] T166 [US7] Create SettingsForm component in frontend/src/components/config/SettingsForm.tsx

**Checkpoint**: User Story 7 functional - config can be exported and imported

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T167 [P] Add session history and logs API in backend/src/theatarr/api/logs.py
- [x] T168 [P] Create SessionHistory page in frontend/src/pages/SessionHistory.tsx
- [x] T169 [P] Implement mobile-responsive layout in frontend/src/styles/
- [x] T170 [P] Add service status WebSocket notifications in backend/src/theatarr/api/ws.py
- [x] T171 [P] Create movies API router (list from Plex/Jellyfin) in backend/src/theatarr/api/movies.py
- [x] T172 [P] Create MoviesPage in frontend/src/pages/MoviesPage.tsx
- [x] T173 Finalize Dashboard with all widgets in frontend/src/pages/Dashboard.tsx
- [x] T174 [P] Add CLI commands (create-user) in backend/src/theatarr/cli.py
- [x] T175 [P] Create README.md with setup instructions at repository root
- [x] T176 [P] Add OpenAPI documentation customization in backend/src/theatarr/main.py
- [x] T177 Run full E2E test suite in frontend/tests/e2e/
- [x] T178 Performance optimization - verify <200ms transitions in backend/src/theatarr/services/engine.py
- [x] T179 Security audit - verify token expiration and auth in backend/src/theatarr/services/auth.py
- [x] T180 Validate quickstart.md scenarios end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - **BLOCKS all user stories**
- **Phases 3-9 (User Stories)**: All depend on Phase 2
  - Can proceed in parallel OR sequentially by priority
  - US2 benefits from US1 models but is independently testable
  - US3 can run in parallel with US1/US2 (different files)
- **Phase 10 (Polish)**: Depends on all desired user stories

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|------------|---------------------|
| US1 (P1) | Foundational | US3 |
| US2 (P2) | US1 models (Session, Sequence) | US3, US4 |
| US3 (P3) | Foundational | US1, US2, US4, US5, US6 |
| US4 (P4) | US1 (session state), US3 (optional services) | US5, US6, US7 |
| US5 (P5) | Foundational | US3, US4, US6, US7 |
| US6 (P6) | US3 (TMDB adapter pattern) | US4, US5, US7 |
| US7 (P7) | All models defined | - |

### Within Each User Story

1. Tests FIRST (if included) - must FAIL before implementation
2. Models before schemas
3. Schemas before services
4. Services before API routers
5. Backend before frontend (API must exist)
6. Frontend components before pages

### Parallel Opportunities

**Phase 2**: T012, T013, T014 can run in parallel (different model files)
**Phase 3**: T038, T039, T040 (tests); T041, T042, T043 (models) can parallelize
**Phase 5**: All adapter implementations (T084-T091) can run in parallel
**Phase 6-9**: Can run in parallel if team capacity allows

---

## Parallel Execution Example: Phase 5 (US3 Services)

```bash
# All adapters can be implemented in parallel:
Task T084: "Implement Hue adapter in backend/src/theatarr/adapters/lighting/hue.py"
Task T085: "Implement Home Assistant adapter in backend/src/theatarr/adapters/lighting/homeassistant.py"
Task T086: "Implement ESPHome adapter in backend/src/theatarr/adapters/lighting/esphome.py"
Task T087: "Implement Plex adapter in backend/src/theatarr/adapters/media/plex.py"
Task T088: "Implement Jellyfin adapter in backend/src/theatarr/adapters/media/jellyfin.py"
Task T089: "Implement Android TV adapter in backend/src/theatarr/adapters/players/androidtv.py"
Task T090: "Implement Apple TV adapter in backend/src/theatarr/adapters/players/appletv.py"
Task T091: "Implement Chromecast adapter in backend/src/theatarr/adapters/players/chromecast.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Execute Session)
4. **STOP and VALIDATE**: Session execution works with mock adapter
5. Deploy/demo MVP

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 → Sessions execute
2. **v0.2**: Add US2 → Sequences can be created/edited
3. **v0.3**: Add US3 → Real services connected
4. **v0.4**: Add US4 → Wallmount display
5. **v0.5**: Add US5 → Voting system
6. **v0.6**: Add US6 → Trailer management
7. **v1.0**: Add US7 + Polish → Production ready

### Suggested MVP Scope

**Phase 1 + Phase 2 + Phase 3 (User Story 1)**
- Total tasks for MVP: 59 tasks
- Delivers: Session execution with play/pause/skip/stop
- Uses: Mock adapter (no real hardware needed for testing)

---

## Task Summary

| Phase | User Story | Tasks | Parallel Tasks |
|-------|------------|-------|----------------|
| Phase 1 | Setup | 9 | 7 |
| Phase 2 | Foundational | 28 | 12 |
| Phase 3 | US1 - Execute Session | 22 | 9 |
| Phase 4 | US2 - Edit Sequences | 16 | 2 |
| Phase 5 | US3 - Configure Services | 23 | 13 |
| Phase 6 | US4 - Wallmount Display | 19 | 5 |
| Phase 7 | US5 - Vote System | 18 | 5 |
| Phase 8 | US6 - Trailers | 18 | 4 |
| Phase 9 | US7 - Import/Export | 13 | 2 |
| Phase 10 | Polish | 14 | 9 |
| **Total** | | **180** | **68** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USx] label maps task to specific user story
- Each user story is independently testable after completion
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All adapters follow the same interface - can be implemented in any order
