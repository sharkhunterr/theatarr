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

- [ ] T001 Create project directory structure per plan.md in repository root
- [ ] T002 Initialize Python backend with pyproject.toml in backend/
- [ ] T003 [P] Initialize React/Vite frontend with package.json in frontend/
- [ ] T004 [P] Create docker-compose.yml at repository root
- [ ] T005 [P] Create .env.example with all required environment variables
- [ ] T006 [P] Configure backend linting (ruff) in backend/pyproject.toml
- [ ] T007 [P] Configure frontend linting (ESLint/Prettier) in frontend/
- [ ] T008 [P] Create backend Dockerfile in backend/Dockerfile
- [ ] T009 [P] Create frontend Dockerfile in frontend/Dockerfile

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Models Foundation

- [ ] T010 Setup SQLAlchemy and database connection in backend/src/theatarr/database.py
- [ ] T011 Configure Alembic migrations in backend/src/alembic/
- [ ] T012 [P] Create base model mixins (timestamps, UUID) in backend/src/theatarr/models/base.py
- [ ] T013 [P] Create Settings model in backend/src/theatarr/models/settings.py
- [ ] T014 [P] Create User model in backend/src/theatarr/models/user.py
- [ ] T015 Generate initial migration with all base models in backend/src/alembic/versions/

### Authentication & Security

- [ ] T016 Create config module with environment variables in backend/src/theatarr/config.py
- [ ] T017 Implement JWT authentication service in backend/src/theatarr/services/auth.py
- [ ] T018 Create auth middleware in backend/src/theatarr/api/deps.py
- [ ] T019 Create auth router (login, refresh) in backend/src/theatarr/api/auth.py

### API Foundation

- [ ] T020 Setup FastAPI app with CORS, middleware in backend/src/theatarr/main.py
- [ ] T021 [P] Create base Pydantic schemas in backend/src/theatarr/schemas/base.py
- [ ] T022 [P] Create error handling utilities in backend/src/theatarr/api/errors.py
- [ ] T023 Setup WebSocket manager in backend/src/theatarr/api/ws.py

### Adapter Framework

- [ ] T024 Create ServiceAdapter base interface in backend/src/theatarr/adapters/base.py
- [ ] T025 Create adapter registry with discovery in backend/src/theatarr/adapters/registry.py
- [ ] T026 Create mock adapter for testing in backend/src/theatarr/adapters/mock.py

### Frontend Foundation

- [ ] T027 Setup React Router with route definitions in frontend/src/App.tsx
- [ ] T028 [P] Create API client base with auth interceptors in frontend/src/api/client.ts
- [ ] T029 [P] Create WebSocket hook in frontend/src/hooks/useWebSocket.ts
- [ ] T030 [P] Setup Zustand store structure in frontend/src/stores/
- [ ] T031 [P] Create common UI components (Button, Card, Modal) in frontend/src/components/common/
- [ ] T032 Create Login page in frontend/src/pages/Login.tsx
- [ ] T033 Setup TailwindCSS configuration in frontend/tailwind.config.js

### Test Infrastructure

- [ ] T034 Configure pytest with fixtures in backend/tests/conftest.py
- [ ] T035 [P] Create mock adapter fixtures in backend/tests/fixtures/adapters.py
- [ ] T036 [P] Configure Vitest in frontend/vite.config.ts
- [ ] T037 [P] Configure Playwright in frontend/playwright.config.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Execute a Cinema Session (Priority: P1) 🎯 MVP

**Goal**: Start a pre-configured session that orchestrates lighting, audio, and media automatically

**Independent Test**: Create session with 3 sequences, start session, verify sequences execute in order with transitions

### Tests for User Story 1

- [ ] T038 [P] [US1] Unit test for sequence engine in backend/tests/unit/test_engine.py
- [ ] T039 [P] [US1] Integration test for session flow in backend/tests/integration/test_session_flow.py
- [ ] T040 [P] [US1] Contract test for session API in backend/tests/contract/test_sessions_api.py

### Backend Implementation US1

- [ ] T041 [P] [US1] Create Session model in backend/src/theatarr/models/session.py
- [ ] T042 [P] [US1] Create Sequence model in backend/src/theatarr/models/sequence.py
- [ ] T043 [P] [US1] Create Action model in backend/src/theatarr/models/action.py
- [ ] T044 [US1] Create Session Pydantic schemas in backend/src/theatarr/schemas/session.py
- [ ] T045 [US1] Create Sequence Pydantic schemas in backend/src/theatarr/schemas/sequence.py
- [ ] T046 [US1] Implement sequence execution engine in backend/src/theatarr/services/engine.py
- [ ] T047 [US1] Implement session scheduler service in backend/src/theatarr/services/scheduler.py
- [ ] T048 [US1] Implement session state persistence for auto-resume in backend/src/theatarr/services/engine.py
- [ ] T049 [US1] Create sessions API router (CRUD, control) in backend/src/theatarr/api/sessions.py
- [ ] T050 [US1] Create sequences API router in backend/src/theatarr/api/sequences.py
- [ ] T051 [US1] Implement WebSocket session state broadcasting in backend/src/theatarr/api/ws.py
- [ ] T052 [US1] Generate migration for Session, Sequence, Action in backend/src/alembic/versions/

### Frontend Implementation US1

- [ ] T053 [P] [US1] Create session store with WebSocket sync in frontend/src/stores/sessionStore.ts
- [ ] T054 [P] [US1] Create useSession hook in frontend/src/hooks/useSession.ts
- [ ] T055 [US1] Create SessionList component in frontend/src/components/sessions/SessionList.tsx
- [ ] T056 [US1] Create SessionCard component in frontend/src/components/sessions/SessionCard.tsx
- [ ] T057 [US1] Create SessionControls component (play/pause/skip/stop) in frontend/src/components/sessions/SessionControls.tsx
- [ ] T058 [US1] Create SessionPage with controls in frontend/src/pages/SessionPage.tsx
- [ ] T059 [US1] Create Dashboard with session status in frontend/src/pages/Dashboard.tsx

**Checkpoint**: User Story 1 functional - sessions can be executed with real-time control

---

## Phase 4: User Story 2 - Create and Edit Sequences (Priority: P2)

**Goal**: Design sequences with lighting, audio, display, and media configuration

**Independent Test**: Create sequence, configure lighting (blue, 50%), audio (ambient, 30%), save, verify persistence

### Tests for User Story 2

- [ ] T060 [P] [US2] Unit test for sequence validation in backend/tests/unit/test_sequence_validation.py
- [ ] T061 [P] [US2] Frontend component test for editors in frontend/tests/components/SequenceEditor.test.tsx

### Backend Implementation US2

- [ ] T062 [US2] Add sequence duplication endpoint in backend/src/theatarr/api/sequences.py
- [ ] T063 [US2] Add sequence reordering endpoint in backend/src/theatarr/api/sequences.py
- [ ] T064 [US2] Add action CRUD endpoints in backend/src/theatarr/api/sequences.py
- [ ] T065 [US2] Implement action parameter validation in backend/src/theatarr/schemas/action.py

### Frontend Implementation US2

- [ ] T066 [US2] Create SequenceEditor component in frontend/src/components/sequences/SequenceEditor.tsx
- [ ] T067 [US2] Create LinearEditor (drag & drop) in frontend/src/components/sequences/LinearEditor.tsx
- [ ] T068 [US2] Create NodeEditor (React Flow) in frontend/src/components/sequences/NodeEditor.tsx
- [ ] T069 [US2] Create ActionEditor component in frontend/src/components/sequences/ActionEditor.tsx
- [ ] T070 [US2] Create LightingActionForm in frontend/src/components/sequences/actions/LightingActionForm.tsx
- [ ] T071 [US2] Create AudioActionForm in frontend/src/components/sequences/actions/AudioActionForm.tsx
- [ ] T072 [US2] Create MediaActionForm in frontend/src/components/sequences/actions/MediaActionForm.tsx
- [ ] T073 [US2] Create DisplayActionForm in frontend/src/components/sequences/actions/DisplayActionForm.tsx
- [ ] T074 [US2] Implement sequence preview in SequenceEditor in frontend/src/components/sequences/SequencePreview.tsx
- [ ] T075 [US2] Create SessionEditor page with sequence management in frontend/src/pages/SessionEditor.tsx

**Checkpoint**: User Story 2 functional - sequences can be created and edited with both modes

---

## Phase 5: User Story 3 - Connect and Configure Services (Priority: P3)

**Goal**: Connect external services (Hue, Plex, Android TV) with configuration and testing

**Independent Test**: Add Philips Hue, enter credentials, test connection, verify light groups listed

### Tests for User Story 3

- [ ] T076 [P] [US3] Unit test for adapter registry in backend/tests/unit/test_adapter_registry.py
- [ ] T077 [P] [US3] Unit test for Hue adapter (mocked) in backend/tests/unit/test_adapters/test_hue.py
- [ ] T078 [P] [US3] Unit test for Plex adapter (mocked) in backend/tests/unit/test_adapters/test_plex.py

### Backend Implementation US3

- [ ] T079 [P] [US3] Create Service model in backend/src/theatarr/models/service.py
- [ ] T080 [US3] Create Service Pydantic schemas in backend/src/theatarr/schemas/service.py
- [ ] T081 [US3] Create services API router in backend/src/theatarr/api/services.py
- [ ] T082 [US3] Implement service connection test endpoint in backend/src/theatarr/api/services.py
- [ ] T083 [US3] Implement capabilities discovery endpoint in backend/src/theatarr/api/services.py
- [ ] T084 [P] [US3] Implement Hue adapter in backend/src/theatarr/adapters/lighting/hue.py
- [ ] T085 [P] [US3] Implement Home Assistant adapter in backend/src/theatarr/adapters/lighting/homeassistant.py
- [ ] T086 [P] [US3] Implement ESPHome adapter in backend/src/theatarr/adapters/lighting/esphome.py
- [ ] T087 [P] [US3] Implement Plex adapter in backend/src/theatarr/adapters/media/plex.py
- [ ] T088 [P] [US3] Implement Jellyfin adapter in backend/src/theatarr/adapters/media/jellyfin.py
- [ ] T089 [P] [US3] Implement Android TV adapter in backend/src/theatarr/adapters/players/androidtv.py
- [ ] T090 [P] [US3] Implement Apple TV adapter in backend/src/theatarr/adapters/players/appletv.py
- [ ] T091 [P] [US3] Implement Chromecast adapter in backend/src/theatarr/adapters/players/chromecast.py
- [ ] T092 [US3] Generate migration for Service model in backend/src/alembic/versions/

### Frontend Implementation US3

- [ ] T093 [US3] Create ServicesConfig page in frontend/src/pages/ServicesConfig.tsx
- [ ] T094 [US3] Create ServiceCard component in frontend/src/components/services/ServiceCard.tsx
- [ ] T095 [US3] Create ServiceForm component in frontend/src/components/services/ServiceForm.tsx
- [ ] T096 [US3] Create ConnectionTestButton component in frontend/src/components/services/ConnectionTestButton.tsx
- [ ] T097 [US3] Create CapabilitiesDisplay component in frontend/src/components/services/CapabilitiesDisplay.tsx
- [ ] T098 [US3] Add services status to Dashboard in frontend/src/pages/Dashboard.tsx

**Checkpoint**: User Story 3 functional - services can be configured and tested

---

## Phase 6: User Story 4 - Display Wallmount Screen (Priority: P4)

**Goal**: Public display page showing movie info, countdown, with dynamic theming

**Independent Test**: Open /wallmount during session, verify poster, title, countdown, real-time updates

### Tests for User Story 4

- [ ] T099 [P] [US4] Unit test for palette extraction in backend/tests/unit/test_palette.py
- [ ] T100 [P] [US4] Integration test for wallmount WebSocket in backend/tests/integration/test_wallmount_ws.py

### Backend Implementation US4

- [ ] T101 [P] [US4] Create Movie model in backend/src/theatarr/models/movie.py
- [ ] T102 [P] [US4] Create ColorPalette model in backend/src/theatarr/models/palette.py
- [ ] T103 [P] [US4] Create Template model in backend/src/theatarr/models/template.py
- [ ] T104 [US4] Implement palette extraction service in backend/src/theatarr/services/palette.py
- [ ] T105 [US4] Create wallmount API router in backend/src/theatarr/api/wallmount.py
- [ ] T106 [US4] Create templates API router in backend/src/theatarr/api/templates.py
- [ ] T107 [US4] Add wallmount WebSocket channel in backend/src/theatarr/api/ws.py
- [ ] T108 [US4] Create default builtin templates in backend/src/theatarr/data/templates/
- [ ] T109 [US4] Generate migration for Movie, ColorPalette, Template in backend/src/alembic/versions/

### Frontend Implementation US4

- [ ] T110 [US4] Create WallmountPage (public) in frontend/src/pages/WallmountPage.tsx
- [ ] T111 [US4] Create MovieInfo component in frontend/src/components/wallmount/MovieInfo.tsx
- [ ] T112 [US4] Create CountdownTimer component in frontend/src/components/wallmount/CountdownTimer.tsx
- [ ] T113 [US4] Create TemplateRenderer component in frontend/src/components/wallmount/TemplateRenderer.tsx
- [ ] T114 [US4] Implement Vibrant.js palette extraction in frontend/src/utils/palette.ts
- [ ] T115 [US4] Create TemplateManager page in frontend/src/pages/TemplateManager.tsx
- [ ] T116 [US4] Create TemplateEditor component in frontend/src/components/templates/TemplateEditor.tsx
- [ ] T117 [US4] Create TemplatePreview component in frontend/src/components/templates/TemplatePreview.tsx

**Checkpoint**: User Story 4 functional - wallmount displays session with dynamic theming

---

## Phase 7: User Story 5 - Vote for Movie Selection (Priority: P5)

**Goal**: Create vote sessions, share link, collect votes, auto-assign winner

**Independent Test**: Create vote with 3 movies, open link (no login), vote, verify count updates

### Tests for User Story 5

- [ ] T118 [P] [US5] Unit test for vote token validation in backend/tests/unit/test_vote_tokens.py
- [ ] T119 [P] [US5] Integration test for vote flow in backend/tests/integration/test_vote_flow.py

### Backend Implementation US5

- [ ] T120 [P] [US5] Create VoteSession model in backend/src/theatarr/models/vote.py
- [ ] T121 [P] [US5] Create Vote model in backend/src/theatarr/models/vote.py
- [ ] T122 [P] [US5] Create VoteToken model in backend/src/theatarr/models/vote.py
- [ ] T123 [US5] Create Vote Pydantic schemas in backend/src/theatarr/schemas/vote.py
- [ ] T124 [US5] Implement vote token generation service in backend/src/theatarr/services/vote.py
- [ ] T125 [US5] Create vote-sessions API router (admin) in backend/src/theatarr/api/vote.py
- [ ] T126 [US5] Create public vote API router in backend/src/theatarr/api/vote.py
- [ ] T127 [US5] Add vote WebSocket channel for real-time results in backend/src/theatarr/api/ws.py
- [ ] T128 [US5] Implement vote closing and winner assignment in backend/src/theatarr/services/vote.py
- [ ] T129 [US5] Generate migration for VoteSession, Vote, VoteToken in backend/src/alembic/versions/

### Frontend Implementation US5

- [ ] T130 [US5] Create VotePage (public, token-based) in frontend/src/pages/VotePage.tsx
- [ ] T131 [US5] Create MovieVoteCard component in frontend/src/components/vote/MovieVoteCard.tsx
- [ ] T132 [US5] Create VoteResults component in frontend/src/components/vote/VoteResults.tsx
- [ ] T133 [US5] Create VoteSessionManager page (admin) in frontend/src/pages/VoteSessionManager.tsx
- [ ] T134 [US5] Create VoteSessionForm component in frontend/src/components/vote/VoteSessionForm.tsx
- [ ] T135 [US5] Create MovieSelector component in frontend/src/components/vote/MovieSelector.tsx

**Checkpoint**: User Story 5 functional - voting works with real-time results

---

## Phase 8: User Story 6 - Manage Trailers Library (Priority: P6)

**Goal**: Auto-download trailers with rules, rotation, contextual selection

**Independent Test**: Configure rule (Action, 1080p, 10GB), trigger download, verify trailer in library

### Tests for User Story 6

- [ ] T136 [P] [US6] Unit test for trailer manager in backend/tests/unit/test_trailer_manager.py
- [ ] T137 [P] [US6] Unit test for TMDB adapter in backend/tests/unit/test_adapters/test_tmdb.py

### Backend Implementation US6

- [ ] T138 [P] [US6] Create Trailer model in backend/src/theatarr/models/trailer.py
- [ ] T139 [P] [US6] Create TrailerRule model in backend/src/theatarr/models/trailer.py
- [ ] T140 [US6] Create Trailer Pydantic schemas in backend/src/theatarr/schemas/trailer.py
- [ ] T141 [US6] Implement TMDB adapter in backend/src/theatarr/adapters/metadata/tmdb.py
- [ ] T142 [US6] Implement trailer download service (yt-dlp) in backend/src/theatarr/services/trailer_manager.py
- [ ] T143 [US6] Implement storage rotation logic in backend/src/theatarr/services/trailer_manager.py
- [ ] T144 [US6] Implement contextual trailer selection in backend/src/theatarr/services/trailer_manager.py
- [ ] T145 [US6] Create trailers API router in backend/src/theatarr/api/trailers.py
- [ ] T146 [US6] Create trailer-rules API router in backend/src/theatarr/api/trailers.py
- [ ] T147 [US6] Setup scheduled task runner for trailer rules in backend/src/theatarr/services/scheduler.py
- [ ] T148 [US6] Generate migration for Trailer, TrailerRule in backend/src/alembic/versions/

### Frontend Implementation US6

- [ ] T149 [US6] Create TrailersManager page in frontend/src/pages/TrailersManager.tsx
- [ ] T150 [US6] Create TrailerCard component in frontend/src/components/trailers/TrailerCard.tsx
- [ ] T151 [US6] Create TrailerRuleForm component in frontend/src/components/trailers/TrailerRuleForm.tsx
- [ ] T152 [US6] Create StorageStats component in frontend/src/components/trailers/StorageStats.tsx
- [ ] T153 [US6] Add trailer stats to Dashboard in frontend/src/pages/Dashboard.tsx

**Checkpoint**: User Story 6 functional - trailers auto-download and manage

---

## Phase 9: User Story 7 - Import/Export Configuration (Priority: P7)

**Goal**: Export/import complete configuration with conflict resolution

**Independent Test**: Export JSON, change setting, import backup, verify reverted

### Tests for User Story 7

- [ ] T154 [P] [US7] Unit test for config manager in backend/tests/unit/test_config_manager.py
- [ ] T155 [P] [US7] Integration test for import/export flow in backend/tests/integration/test_config_import_export.py

### Backend Implementation US7

- [ ] T156 [US7] Implement config export service in backend/src/theatarr/services/config_manager.py
- [ ] T157 [US7] Implement config import service in backend/src/theatarr/services/config_manager.py
- [ ] T158 [US7] Implement conflict detection in backend/src/theatarr/services/config_manager.py
- [ ] T159 [US7] Implement secret encryption for exports in backend/src/theatarr/services/config_manager.py
- [ ] T160 [US7] Create config API router (export, import, preview) in backend/src/theatarr/api/config.py
- [ ] T161 [US7] Create settings API router in backend/src/theatarr/api/config.py

### Frontend Implementation US7

- [ ] T162 [US7] Create ConfigPage in frontend/src/pages/ConfigPage.tsx
- [ ] T163 [US7] Create ExportButton component in frontend/src/components/config/ExportButton.tsx
- [ ] T164 [US7] Create ImportWizard component in frontend/src/components/config/ImportWizard.tsx
- [ ] T165 [US7] Create ConflictResolver component in frontend/src/components/config/ConflictResolver.tsx
- [ ] T166 [US7] Create SettingsForm component in frontend/src/components/config/SettingsForm.tsx

**Checkpoint**: User Story 7 functional - config can be exported and imported

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T167 [P] Add session history and logs API in backend/src/theatarr/api/logs.py
- [ ] T168 [P] Create SessionHistory page in frontend/src/pages/SessionHistory.tsx
- [ ] T169 [P] Implement mobile-responsive layout in frontend/src/styles/
- [ ] T170 [P] Add service status WebSocket notifications in backend/src/theatarr/api/ws.py
- [ ] T171 [P] Create movies API router (list from Plex/Jellyfin) in backend/src/theatarr/api/movies.py
- [ ] T172 [P] Create MoviesPage in frontend/src/pages/MoviesPage.tsx
- [ ] T173 Finalize Dashboard with all widgets in frontend/src/pages/Dashboard.tsx
- [ ] T174 [P] Add CLI commands (create-user) in backend/src/theatarr/cli.py
- [ ] T175 [P] Create README.md with setup instructions at repository root
- [ ] T176 [P] Add OpenAPI documentation customization in backend/src/theatarr/main.py
- [ ] T177 Run full E2E test suite in frontend/tests/e2e/
- [ ] T178 Performance optimization - verify <200ms transitions in backend/src/theatarr/services/engine.py
- [ ] T179 Security audit - verify token expiration and auth in backend/src/theatarr/services/auth.py
- [ ] T180 Validate quickstart.md scenarios end-to-end

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
