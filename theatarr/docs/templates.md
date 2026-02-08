# Guide des Templates Wallmount - Theatarr

## Table des matieres

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Creer un template](#creer-un-template)
4. [Modes de rendu](#modes-de-rendu)
5. [Styles de layout disponibles](#styles-de-layout-disponibles)
6. [Types de composants](#types-de-composants)
7. [Variables dynamiques](#variables-dynamiques)
8. [Donnees disponibles](#donnees-disponibles)
9. [Configuration (config)](#configuration-config)
10. [Palette de couleurs](#palette-de-couleurs)
11. [Animations](#animations)
12. [Badges dynamiques](#badges-dynamiques)
13. [Templates built-in](#templates-built-in)
14. [Images alternatives (fanart, backdrops)](#images-alternatives)
15. [Enrichissement TMDB + Fanart.tv](#enrichissement-tmdb--fanarttv)
16. [Exemples complets](#exemples-complets)

---

## Vue d'ensemble

Le systeme de templates de Theatarr permet de personnaliser l'affichage du **wallmount** - l'ecran de projection qui montre les informations de la session cinema en cours ou a venir. Chaque template controle le rendu visuel : disposition du poster, titre, compte a rebours, informations du film, animations, etc.

Les templates sont rendus par le composant `TemplateRenderer` dans le frontend et definis soit via l'interface d'administration (Template Manager), soit directement en base de donnees.

## Architecture

```
Backend (API)                          Frontend (React)
+---------------------------+          +---------------------------+
| GET /wallmount/state      |          | WallmountPage.tsx         |
|  - session info           |  ------> |  - WebSocket + polling    |
|  - movie data             |          |  - Appelle TemplateRenderer|
|  - palette colors         |          +---------------------------+
|  - template config        |                      |
|  - vote info              |                      v
|  - countdown_to           |          +---------------------------+
+---------------------------+          | TemplateRenderer.tsx       |
                                       |  - Rendu HTML brut        |
+---------------------------+          |  - Rendu layout structure  |
| Template (modele DB)      |          |  - Resolution variables   |
|  - layout (JSON)          |          |  - Palette CSS vars       |
|  - config (JSON)          |          |  - Animations             |
|  - content (HTML brut)    |          +---------------------------+
|  - styles (CSS)           |
|  - script (JS)            |
+---------------------------+
```

### Flux de donnees

1. Le wallmount appelle `GET /wallmount/state` (endpoint public, pas d'auth)
2. L'API resout la session active/planifiee, le film, la palette, le template et les votes
3. Le frontend recoit le tout et passe `template` + `data` au `TemplateRenderer`
4. Le renderer choisit le mode de rendu (HTML brut ou layout structure)
5. Les variables dynamiques (`{{movie.title}}`, etc.) sont resolues
6. Les couleurs de la palette sont injectees en CSS variables

---

## Creer un template

### Via l'interface (Template Manager)

1. Aller dans **Template Manager** depuis l'administration
2. Cliquer sur **Creer un template**
3. Remplir le formulaire :
   - **Nom** : identifiant unique
   - **Description** : description lisible
   - **Type** : `countdown`, `movie_info`, `session_status` ou `custom`
   - **Layout** : definition JSON du layout (voir sections suivantes)
   - **Config** : options de configuration JSON
4. Optionnellement, utiliser le mode HTML brut pour un controle total

### Via l'API

```
POST /templates
Content-Type: application/json

{
  "name": "Mon Template Custom",
  "description": "Un template personnalise",
  "template_type": "custom",
  "layout": { ... },
  "config": { ... }
}
```

### Activer un template

```
POST /templates/{id}/activate
```

Un seul template peut etre globalement actif a la fois. Cependant, chaque **session** peut avoir un `template_id` specifique qui override le template global.

---

## Modes de rendu

### 1. Mode HTML brut (`content`)

Si le template a un champ `content` rempli (HTML), il est rendu directement :

```json
{
  "name": "Mon Template HTML",
  "content": "<div class='my-template'>{{movie.title}}</div>",
  "styles": ".my-template { color: white; font-size: 4rem; }",
  "script": "// JavaScript optionnel"
}
```

- `content` : HTML rendu via `dangerouslySetInnerHTML`
- `styles` : CSS injecte dans une balise `<style>`
- `script` : JavaScript (a utiliser avec precaution)
- Les CSS variables de la palette sont disponibles

### 2. Mode layout structure (`layout`)

Mode recommande. Le template est defini par un objet JSON avec un `style` de layout et un tableau de `components` :

```json
{
  "layout": {
    "style": "split-horizontal",
    "components": [
      { "type": "backdrop", "opacity": 0.3, "blur": 20 },
      { "type": "poster", "position": "left", "size": "full-height" },
      { "type": "title", "size": "xlarge" },
      { "type": "metadata", "fields": ["year", "runtime", "rating"] },
      { "type": "countdown", "size": "large" }
    ]
  },
  "config": {
    "show_seconds": true,
    "show_rating": true,
    "use_palette_colors": true
  }
}
```

---

## Styles de layout disponibles

Le `layout.style` determine la disposition generale. Voici les styles disponibles :

| Style | Description | Orientation |
|-------|-------------|-------------|
| `poster-fullscreen` | Poster en plein ecran avec overlay en bas | Paysage |
| `split-horizontal` | Poster a gauche (40%), infos a droite (60%) | Paysage |
| `cinema-marquee` | Poster centre avec texte defilant haut/bas | Paysage |
| `minimal-center` | Compte a rebours geant centre, backdrop floute | Paysage |
| `modern-gradient` | Infos a gauche, poster a droite, degrade | Paysage |
| `responsive-badge` | Responsive avec badge anime, adaptatif | Tous |
| `neon-retro` | Style annees 80, neon, grille, scanlines | Paysage |
| `elegant-premium` | Luxueux avec accents dores, typographie serif | Paysage |
| `spotlight-dramatic` | Effet projecteur avec particules de poussiere | Paysage |
| `social-vertical` | Format vertical 9:16 (Story/TikTok) | Portrait |
| `event-board` | Panneau cinema avec lettres jaunes sur noir | Paysage |
| `glassmorphism` | Effets de verre depoli, transparence | Paysage |
| `cinema-tickets` | Design ticket de cinema vintage | Paysage |
| `minimal-focus` | Ultra-minimaliste, titre + countdown seulement | Tous |
| `dynamic-info` | Contextuel (vote/film/scheduled/running) | Paysage |
| `cinematic-immersive` | Backdrop plein ecran avec Ken Burns, logo HD, infos minimalistes | Paysage |
| `showcase-enriched` | Template premium exploitant TMDB + Fanart.tv : logo HD, casting, synopsis, studios | Paysage |
| `fanart-gallery` | Diaporama plein ecran des backdrops avec infos minimalistes en surimpression | Paysage |
| `panorama-slide` | Backdrops glissant horizontalement avec logo et infos a gauche | Paysage |
| `modern-enriched` | Design moderne avec badges animes, etoiles, genres pills, casting defilant | Paysage |
| `debug-tmdb` | Template de debug affichant toutes les donnees TMDB/Fanart explicitement | Paysage |

---

## Types de composants

Chaque composant dans `layout.components` a un `type` et des proprietes optionnelles.

### Composants de fond

| Type | Description | Props |
|------|-------------|-------|
| `backdrop` | Image de fond (backdrop ou poster du film) | `opacity`, `blur`, `gradient` |
| `gradient_overlay` | Degrade par-dessus le fond | `direction`, `opacity`, `height` |
| `grid_overlay` | Grille retro (style neon) | - |
| `color_background` | Fond de couleur unie | `color` |

**Props du backdrop :**
- `opacity` (0-1) : transparence de l'image. Defaut: 0.3
- `blur` (px) : flou gaussien. Defaut: 0
- `gradient` : `"left-to-right"`, `"right-to-left"`, ou `"bottom-to-top"` (overlay degrade)

### Composants principaux

| Type | Description | Props |
|------|-------------|-------|
| `poster` | Affiche du film | `position`, `size`, `shadow`, `frame`, `effect` |
| `title` | Titre du film (+ annee) | `size`, `weight`, `style`, `font`, `color` |
| `tagline` | Tagline/slogan du film | `style` |
| `overview` | Synopsis du film | `max_lines` |
| `metadata` | Annee, duree, note | `fields` |
| `cast` | Liste des acteurs | `limit`, `label` |
| `directors` | Liste des realisateurs | `label` |
| `genres` | Genres sous forme de pills | `limit`, `style` |
| `countdown` | Compte a rebours en temps reel | `size`, `style` |

**Props du poster :**
- `position` : `"left"`, `"right"`, `"center"`, `"background"`, `"fullscreen"`, `"ticket-left"`
- `size` : `"small"` (w-48), `"medium"` (w-64), `"large"` (w-80), `"full-height"`, `"responsive"`, `"cover"`
- `shadow` : boolean, active l'ombre avec couleur palette
- `frame` : `"gold"`, `"none"` (encadrement)
- `effect` : `"neon-border"`, `"float-shadow"`, `"spotlight"`

**Props du title :**
- `size` : `"small"` (3xl), `"medium"` (5xl), `"large"` (6xl), `"xlarge"` (7xl), `"giant"` (8xl)
- `weight` : `"bold"`, `"semibold"`
- `style` : `"neon-glow"`, `"shadow-strong"`, `"glass-text"`, `"board-letters"`, `"minimal"`, `"bold-shadow"`

**Props du metadata :**
- `fields` : tableau parmi `["year", "runtime", "rating", "votes"]`

**Props du countdown :**
- `size` : `"medium"`, `"large"`, `"xl"`, `"giant"`
- `style` : `"prominent"`, `"digital"`, `"elegant"`, `"cinematic"`, `"glass-countdown"`, `"flip-clock"`, `"modern-stack"`, `"minimal-digits"`, `"ticket"`

### Composants de session

| Type | Description | Props |
|------|-------------|-------|
| `session_info` | Nom de session et date planifiee | `position`, `fields` |
| `session_progress` | Barre de progression des sequences | - |
| `current_sequence` | Sequence en cours de lecture | - |

**Props du session_info :**
- `position` : `"top-left"`, `"top-right"`
- `fields` : `["name", "scheduled_at"]`

### Composants d'animation

| Type | Description | Props |
|------|-------------|-------|
| `marquee` | Texte defilant horizontal | `position`, `text`, `speed` |
| `blink` | Texte clignotant | `position`, `text` |
| `spotlight_effect` | Projecteur anime | `intensity` |
| `particles` | Particules flottantes | `type`, `density` |

**Props du marquee :**
- `position` : `"top"`, `"bottom"`
- `text` : `"title"` (titre du film), `"tagline"`, `"session_name"`
- `speed` : `"slow"` (30s), `"medium"` (20s), `"fast"` (10s)

**Props du blink :**
- `position` : `"corners"`, `"top-right"`, `"bottom-right"`
- `text` : `"countdown_short"` ou texte libre

### Composants decoratifs

| Type | Description | Props |
|------|-------------|-------|
| `badge` | Badge dynamique (voir section dediee) | `text`, `position`, `style` |
| `custom_text` | Texte personnalise | `text`, `position`, `style` |
| `decorative_frame` | Cadre decoratif | `style` |
| `glass_panel` | Panneau glassmorphism | `position`, `width` |
| `logo` | Logo HD du film (si disponible via TMDB) ou logo cinema | `position`, `size` |
| `rating_stars` | Etoiles de notation | `position` |
| `divider` | Separateur | `style` |

### Composants specifiques aux templates

| Type | Description | Template |
|------|-------------|----------|
| `board_background` | Fond panneau | event-board |
| `board_header` | En-tete panneau | event-board |
| `board_row` | Ligne d'info panneau | event-board |
| `ticket_shape` | Forme ticket | cinema-tickets |
| `ticket_header` | En-tete ticket | cinema-tickets |
| `ticket_info` | Info ticket | cinema-tickets |
| `ticket_barcode` | Code-barre ticket | cinema-tickets |
| `ticket_number` | Numero ticket | cinema-tickets |
| `dynamic_status` | Statut vote/session | dynamic-info |
| `participant_avatars` | Avatars votants | dynamic-info |

---

## Variables dynamiques

Les variables dynamiques sont resolues automatiquement dans les textes des composants (`badge.text`, `custom_text.text`, `board_row.value`, etc.). Syntaxe : `{{variable}}`.

### Variables du film

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{movie.title}}` | Titre du film | `Interstellar` |
| `{{movie.year}}` | Annee de sortie | `2014` |
| `{{movie.rating}}` | Note (1 decimale) | `8.7` |
| `{{runtime}}` | Duree formatee | `2h49m` |
| `{{rating}}` | Note (alias) | `8.7` |

### Variables de session

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{session.name}}` | Nom de la session | `Soiree SF` |
| `{{session.status}}` | Statut brut | `scheduled` |

### Variables temporelles

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{countdown_short}}` | Compte a rebours court | `2j 4h` |
| `{{date}}` | Date courte (fr) | `15 nov.` |
| `{{date_full}}` | Date complete (fr) | `samedi 15 novembre 2025` |
| `{{time}}` | Heure de la seance | `20:30` |

### Variables de statut

| Variable | Description | Valeurs possibles |
|----------|-------------|-------------------|
| `{{status_text}}` | Texte de statut dynamique | `Vote en cours`, `Film choisi`, `Prochainement`, `En cours`, `A venir` |

La variable `{{status_text}}` change automatiquement selon l'etat :
- Vote ouvert → `Vote en cours`
- Vote clos → `Film choisi`
- Session running → `En cours`
- Session scheduled → `Prochainement`
- Aucun vote → `A venir`

---

## Donnees disponibles

Voici la structure complete des donnees envoyees au `TemplateRenderer` via `GET /wallmount/state` :

### movie

```typescript
{
  id: string;
  title: string;
  year?: number;
  runtime_minutes?: number;
  overview?: string;           // Synopsis
  tagline?: string;            // Slogan du film
  poster_url?: string;         // URL affiche (TMDB w500 ou Plex/Jellyfin)
  backdrop_url?: string;       // URL fond d'ecran (TMDB original ou Plex/Jellyfin)
  extra_backdrops?: string[];  // URLs backdrops alternatifs (TMDB + Plex)
  extra_posters?: string[];    // URLs posters alternatifs (TMDB + Plex)
  logos?: string[];            // URLs logos HD du film (Fanart.tv HD + TMDB)
  rating?: number;             // Note /10
  genres?: string[];           // ["Science-Fiction", "Drame", ...]
  directors?: string[];        // ["Christopher Nolan"]
  cast?: string[];             // Acteurs principaux (jusqu'a 20)
  studios?: string[];          // ["Warner Bros.", "Legendary Entertainment"]
  original_title?: string;     // Titre original (si different du titre fr)
  enrichment_sources?: string[]; // Sources d'enrichissement appliquees: ["tmdb", "fanart"]
  keywords?: string[];         // Mots-cles TMDB: ["space", "survival", ...]
  vote_count?: number;         // Nombre de votes TMDB (ex: 32451)
}
```

### session

```typescript
{
  name?: string;                       // Nom de la session
  status?: string;                     // "draft", "scheduled", "running", "paused", "completed", "interrupted"
  current_sequence_index?: number;     // Index sequence en cours
  total_sequences?: number;            // Nombre total de sequences
  current_sequence_name?: string;      // Nom de la sequence en cours
  current_sequence_elapsed_ms?: number; // Temps ecoule dans la sequence
  current_sequence_duration_ms?: number; // Duree totale de la sequence
}
```

### palette

```typescript
{
  primary?: string;     // Couleur primaire extraite du poster
  secondary?: string;   // Couleur secondaire
  accent?: string;      // Couleur d'accent (highlights)
  background?: string;  // Couleur de fond suggeree
  text?: string;        // Couleur de texte suggeree
  vibrant?: string;     // Couleur la plus vive
  css_vars?: {          // Variables CSS injectables
    "--palette-primary": string;
    "--palette-secondary": string;
    "--palette-accent": string;
    "--palette-background": string;
    "--palette-text": string;
    "--palette-vibrant": string;
    "--palette-vibrant-light": string;
    "--palette-vibrant-dark": string;
  };
}
```

### vote_info

```typescript
{
  total_votes?: number;          // Nombre total de votes
  is_open?: boolean;             // Vote actuellement ouvert
  status?: string;               // "draft", "open", "closed", "cancelled"
  winning_movie_index?: number;  // Index du film gagnant dans movie_options
}
```

### countdown_to

```typescript
countdown_to?: string;  // Date ISO 8601, ex: "2025-11-15T20:30:00Z"
```

Disponible uniquement pour les sessions au statut `scheduled` avec une `scheduled_at` definie.

---

## Configuration (config)

L'objet `config` du template controle les options d'affichage. Voici toutes les proprietes :

### Affichage general

| Propriete | Type | Description | Defaut |
|-----------|------|-------------|--------|
| `show_seconds` | boolean | Afficher les secondes dans le countdown | `true` |
| `animate_numbers` | boolean | Animer les chiffres du countdown | `true` |
| `use_palette_colors` | boolean | Utiliser les couleurs de la palette | `true` |
| `show_rating` | boolean | Afficher la note | `false` |
| `show_genres` | boolean | Afficher les genres | `false` |
| `show_votes` | boolean | Afficher le nombre de votes | `false` |
| `show_director` | boolean | Afficher le realisateur | `false` |
| `show_overview` | boolean | Afficher le synopsis | `false` |
| `show_elapsed_time` | boolean | Afficher le temps ecoule de la sequence | `false` |
| `show_remaining_time` | boolean | Afficher le temps restant | `false` |
| `show_logo` | boolean | Afficher le logo | `false` |
| `show_poster` | boolean | Afficher le poster | `true` (implicite) |
| `show_metadata` | boolean | Afficher les metadonnees | `true` (implicite) |
| `show_vote_info` | boolean | Afficher les infos de vote | `false` |
| `show_participant_count` | boolean | Afficher le compteur de participants | `false` |
| `show_enrichment_sources` | boolean | Afficher les badges TMDB/Fanart.tv | `false` |
| `show_studios` | boolean | Afficher les studios de production | `false` |
| `show_original_title` | boolean | Afficher le titre original (si different) | `false` |
| `cast_scroll` | boolean | Defilement horizontal du casting (si > 4 acteurs) | `false` |

### Animations

| Propriete | Type | Description |
|-----------|------|-------------|
| `animate_entry` | boolean | Animer l'entree des elements |
| `enable_glow_effects` | boolean | Activer les effets de lueur |
| `show_particles` | boolean | Afficher les particules flottantes |
| `show_grid` | boolean | Afficher la grille retro |
| `scanlines` | boolean | Afficher les scanlines CRT |
| `blink_interval` | number (ms) | Intervalle de clignotement |
| `marquee_speed` | number (s) | Vitesse du texte defilant |

### Typographie

| Propriete | Type | Description |
|-----------|------|-------------|
| `font_style` | string | Style de police |
| `font_family` | string | Famille de police |
| `font_title` | string | Police pour les titres |
| `font_body` | string | Police pour le corps |
| `text_shadow` | boolean | Activer les ombres de texte |
| `typography` | string | `"mono"` pour monospace |

### Couleurs et style

| Propriete | Type | Description |
|-----------|------|-------------|
| `theme` | string | Theme: `dark`, `light`, `neon`, `elegant`, `retro`, `glass`, `ticket`, `minimal`, `dynamic`, `board`, `social`, `dramatic` |
| `accent_color` | string | Couleur d'accent (hex) |
| `background_color` | string | Couleur de fond |
| `text_color` | string | Couleur du texte |
| `neon_color` | string | Couleur neon primaire |
| `secondary_neon` | string | Couleur neon secondaire |
| `gradient_direction` | string | Direction du degrade |
| `gradient_opacity` | number | Opacite du degrade |
| `glass_blur` | number (px) | Intensite du flou glassmorphism |
| `glass_opacity` | number (0-1) | Opacite du verre |
| `card_style` | string | Style des cartes |
| `ticket_color` | string | Couleur du ticket |

### Badge (voir section dediee)

```json
{
  "badge": {
    "text": "{{status_text}}",
    "show_when": "always",
    "style": "pulse",
    "color": "palette.vibrant",
    "colors": { ... },
    "dynamic_texts": { ... },
    "fallback_text": "Prochainement",
    "rotation": -15
  }
}
```

### Textes personnalises

```json
{
  "custom_texts": [
    { "text": "SEANCE CINEMA", "position": "top-center", "style": "neon-subtitle" },
    { "text": "{{session.name}}", "position": "bottom-center", "style": "neon-name" }
  ]
}
```

### Animations avancees

```json
{
  "animations": {
    "title_entrance": "slide-up",
    "badge_pulse": true,
    "float_poster": true,
    "shimmer_glass": true,
    "letter_flip": true,
    "flip_duration": 300
  }
}
```

### Breakpoints responsive

```json
{
  "responsive_breakpoints": {
    "sm": 640,
    "md": 768,
    "lg": 1024,
    "xl": 1280,
    "2xl": 1536
  }
}
```

---

## Palette de couleurs

La palette est extraite automatiquement du poster du film via l'endpoint `POST /wallmount/palette/extract`. Les couleurs sont stockees dans la table `color_palettes`.

### Couleurs disponibles

| Couleur | Usage | CSS Variable |
|---------|-------|-------------|
| `primary` | Couleur dominante du poster | `--palette-primary` |
| `secondary` | Couleur secondaire | `--palette-secondary` |
| `accent` | Couleur d'accent pour les highlights | `--palette-accent` |
| `background` | Couleur de fond recommandee | `--palette-background` |
| `text` | Couleur de texte recommandee | `--palette-text` |
| `vibrant` | Couleur la plus vive/saturee | `--palette-vibrant` |
| `vibrant_light` | Version claire de vibrant | `--palette-vibrant-light` |
| `vibrant_dark` | Version sombre de vibrant | `--palette-vibrant-dark` |
| `muted` | Couleur attenuee | `--palette-muted` |

### Utilisation dans les templates

**En mode layout** : les couleurs sont automatiquement appliquees aux composants. Par exemple, l'ombre du poster utilise `palette.primary`, les etoiles de notation utilisent `palette.accent`, etc.

**En mode HTML brut** : les CSS variables sont injectees sur le conteneur root :

```css
.my-custom-template {
  color: var(--palette-text);
  background: var(--palette-background);
  border: 2px solid var(--palette-vibrant);
}
.my-accent {
  color: var(--palette-accent);
}
```

### References palette dans config

Certaines proprietes de config acceptent des references palette :

```json
{
  "badge": {
    "color": "palette.vibrant"   // Resolu en palette.vibrant
  },
  "accent_color": "palette.accent"
}
```

Valeurs supportees : `"palette.vibrant"`, `"palette.accent"`, `"palette.primary"`

---

## Animations

Les animations suivantes sont injectees automatiquement quand un template les utilise :

| Animation | Description | Usage |
|-----------|-------------|-------|
| `marquee` | Defilement horizontal | Composant `marquee` |
| `blink` | Clignotement | Composant `blink` |
| `pulse-glow` | Pulse avec lueur | Effets de lueur |
| `badge-pulse` | Pulse du badge (scale + shadow) | Badge style `pulse` |
| `badge-glow` | Lueur du badge | Badge style `glow` |
| `shimmer` | Effet de brillance | Badge, glassmorphism |
| `neon-flicker` | Scintillement neon | Titre neon |
| `neon-border-pulse` | Pulse de bordure neon | Poster/badge neon |
| `scanline` | Balayage CRT | Overlay neon |
| `float` | Flottement vertical | Poster glassmorphism |
| `flip-digit` | Rotation 3D de chiffre | Panneau cinema |
| `glass-shimmer` | Brillance de verre | Panneau glassmorphism |
| `spotlight-move` | Deplacement du projecteur | Spotlight dramatic |
| `ticket-stamp` | Animation tampon | Ticket cinema |
| `dust-particle` | Particule de poussiere | Spotlight dramatic |
| `gold-shine` | Brillance doree | Elegant premium |
| `gallery-ken-burns` | Ken Burns lent (zoom progressif) | Galerie Fanart |
| `gallery-fade-in` | Apparition avec glissement vertical | Galerie Fanart |
| `panorama-zoom` | Zoom progressif du backdrop actif | Panorama Glissant |
| `panorama-info-in` | Apparition avec glissement horizontal | Panorama Glissant |
| `modern-ken-burns` | Ken Burns avec translation subtile | Moderne Enrichi |
| `modern-fade-in` | Apparition avec glissement vertical | Moderne Enrichi |
| `gradient-border-spin` | Rotation du degrade de bordure | Badge gradient-border |
| `glow-pulse` | Lueur pulsante coloree | Badge gradient-border |
| `border-flow` | Flux de couleur dans la bordure | Badge gradient-border |
| `ken-burns-slow` | Ken Burns lent avec translation | Showcase Enrichi |
| `fade-in-up` | Apparition avec glissement vers le haut | Showcase Enrichi |
| `gradient-shift` | Defilement de degrade | Barre d'accent Showcase |
| `cast-marquee` | Defilement horizontal du casting | Showcase / Moderne Enrichi |
| `poster-fade` | Transition fondu entre posters | Showcase Enrichi |

---

## Badges dynamiques

Les badges sont des elements visuels flottants qui affichent un statut ou une information. Ils sont hautement configurables.

### Styles de badge

| Style | Effet visuel |
|-------|-------------|
| `pulse` | Scale + ombre pulsante |
| `glow` | Lueur pulsante |
| `shimmer` | Brillance defilante |
| `neon` | Neon lumineux avec bordure |
| `solid` | Couleur unie |
| `outline` | Bordure seulement |
| `gradient` | Degrade |
| `glass-pill` | Pilule glassmorphism |
| `gold-ribbon` | Ruban dore |
| `stamp` | Tampon vintage (avec rotation) |
| `status-badge` | Badge de statut dynamique |
| `pill-animated` | Pilule avec animation |
| `gradient-border` | Bordure animee en degrade avec lueur pulsante |

### Texte dynamique du badge

Le texte du badge peut inclure des variables :

```json
{
  "badge": {
    "text": "{{status_text}}"
  }
}
```

Ou utiliser des textes differents selon le contexte :

```json
{
  "badge": {
    "text": "{{status_text}}",
    "dynamic_texts": {
      "vote_open": "Vote en cours",
      "vote_closed": "Film choisi",
      "scheduled": "Prochainement",
      "running": "En cours",
      "default": "A venir"
    }
  }
}
```

### Couleurs dynamiques du badge

```json
{
  "badge": {
    "colors": {
      "vote_open": "#f59e0b",
      "vote_closed": "#22c55e",
      "scheduled": "#6366f1",
      "running": "#ef4444",
      "default": "#6b7280"
    }
  }
}
```

### Quand afficher le badge

```json
{
  "badge": {
    "show_when": "always"
  }
}
```

Valeurs : `"always"`, `"scheduled"`, `"running"`, `"countdown_under_24h"`, `"never"`

---

## Templates built-in

Theatarr inclut 21 templates pre-configures :

| Cle | Nom | Style | Description |
|-----|-----|-------|-------------|
| `poster_focus` | Affiche Plein Ecran | `poster-fullscreen` | Affiche plein ecran + countdown |
| `split_horizontal` | Ecran Divise | `split-horizontal` | Poster gauche, infos droite |
| `cinema_classic` | Cinema Classique | `cinema-marquee` | Retro avec texte defilant |
| `minimal_countdown` | Compte a Rebours Minimal | `minimal-center` | Countdown geant centre |
| `modern_gradient` | Moderne Degrade | `modern-gradient` | Degrade + typographie elegante |
| `responsive_badge` | Responsive avec Badge | `responsive-badge` | S'adapte a toutes resolutions |
| `neon_retro` | Neon Retro | `neon-retro` | Style annees 80 avec neon |
| `elegant_premium` | Elegant Premium | `elegant-premium` | Luxueux, accents dores |
| `spotlight_dramatic` | Projecteur Dramatique | `spotlight-dramatic` | Effet projecteur cinema |
| `social_vertical` | Format Vertical Social | `social-vertical` | Format Story/TikTok |
| `event_board` | Panneau Cinema | `event-board` | Panneau a lettres changantes |
| `glassmorphism` | Verre Moderne | `glassmorphism` | Effets de transparence |
| `cinema_tickets` | Ticket de Cinema | `cinema-tickets` | Design ticket vintage |
| `minimal_focus` | Focus Minimal | `minimal-focus` | Ultra-minimaliste |
| `cinematic_immersive` | Cinema Immersif | `cinematic-immersive` | Backdrop plein ecran, Ken Burns, logo HD |
| `dynamic_info` | Infos Dynamiques | `dynamic-info` | Contextuel vote/session |
| `showcase_enriched` | Showcase Enrichi | `showcase-enriched` | Premium avec TMDB + Fanart : logo HD, casting defilant, synopsis, studios |
| `fanart_gallery` | Galerie Fanart | `fanart-gallery` | Diaporama plein ecran backdrops, indicateur de progression |
| `panorama_slide` | Panorama Glissant | `panorama-slide` | Backdrops glissant horizontalement, logo, infos a gauche |
| `modern_enriched` | Moderne Enrichi | `modern-enriched` | Design moderne avec badge gradient-border, etoiles, genres, casting |
| `debug_tmdb` | Debug TMDB | `debug-tmdb` | Affiche toutes les donnees enrichies pour debug |

Pour reinitialiser les templates built-in :
```
POST /templates/init-builtins
```

---

## Images alternatives

### Sources d'images

Chaque film dispose d'images principales et d'images alternatives :

| Source | Images principales | Images alternatives |
|--------|-------------------|---------------------|
| TMDB | `poster_url` (w500), `backdrop_url` (original) | Jusqu'a 10 backdrops + 10 posters + 5 logos (tries par vote communautaire) |
| Fanart.tv | - | Logos HD transparents, backdrops HD, posters HD (ajoutes aux extra_*) |
| Plex | `thumb` (poster), `art` (backdrop) | Tous les posters/arts disponibles via `/library/metadata/{id}/posters` et `/arts` |
| Jellyfin | Primary, Backdrop | (non implemente) |

### Donnees disponibles

Les images alternatives sont exposees dans `movie` via `GET /wallmount/state` :

```typescript
{
  poster_url?: string;         // Poster principal
  backdrop_url?: string;       // Backdrop principal
  extra_backdrops?: string[];  // Backdrops alternatifs (jusqu'a 10)
  extra_posters?: string[];    // Posters alternatifs (jusqu'a 10)
  logos?: string[];            // Logos HD transparents du film (jusqu'a 5, TMDB uniquement)
}
```

### Configuration dans les templates

Les templates controlent le choix d'image via `config` :

| Propriete | Type | Description | Defaut |
|-----------|------|-------------|--------|
| `backdrop_index` | number | Index du backdrop alternatif (1 = premier alternatif, 0 = principal) | `0` |
| `poster_index` | number | Index du poster alternatif (1 = premier alternatif, 0 = principal) | `0` |
| `rotate_backdrops` | boolean | Rotation automatique entre tous les backdrops | `false` |
| `rotate_interval` | number | Intervalle de rotation en secondes | `30` |
| `rotate_posters` | boolean | Rotation automatique entre tous les posters | `false` |
| `poster_rotate_interval` | number | Intervalle de rotation des posters en secondes | `15` |
| `use_logo_image` | boolean | Utiliser le logo HD du film (composant `logo`) | `false` |

### Composant `logo`

Le composant `logo` affiche le logo HD transparent du film (si disponible via TMDB) :

```json
{
  "type": "logo",
  "position": "top-left",
  "size": "medium"
}
```

**Props du logo :**
- `position` : `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`, `"center"`
- `size` : `"small"` (150px), `"medium"` (250px), `"large"` (400px)

### Exemple : template avec rotation de backdrops et logo

```json
{
  "layout": {
    "style": "split-horizontal",
    "components": [
      { "type": "backdrop", "opacity": 0.3, "blur": 10 },
      { "type": "logo", "position": "top-left", "size": "medium" },
      { "type": "poster", "position": "left", "size": "full-height" },
      { "type": "title", "size": "xlarge" },
      { "type": "countdown", "size": "large" }
    ]
  },
  "config": {
    "rotate_backdrops": true,
    "rotate_interval": 20,
    "use_logo_image": true
  }
}
```

### Exemple : backdrop alternatif fixe

```json
{
  "config": {
    "backdrop_index": 2
  }
}
```

Utilise le 2e backdrop alternatif au lieu du backdrop principal.

### Fanart.tv (integre)

[Fanart.tv](https://fanart.tv) est integre comme source d'enrichissement pour des artworks HD : logos transparents haute definition, backdrops supplementaires et posters alternatifs. Necessite une cle API configuree dans les services (categorie Metadata, type `fanart`).

**Donnees Fanart.tv :**
- Logos HD transparents (preposes aux logos TMDB, priorite superieure)
- Backdrops supplementaires (ajoutes aux extra_backdrops)
- Posters alternatifs (ajoutes aux extra_posters)

L'enrichissement Fanart.tv necessite un TMDB ID (enrichir d'abord depuis TMDB).

### Qualite des images TMDB

TMDB propose plusieurs tailles. Les tailles utilisees :

**Posters :**
- `w500` (principal), `w780` (alternatifs)

**Backdrops :**
- `original` (principal et alternatifs)

**Logos :**
- `w500`

Pour les ecrans haute resolution (4K), il serait judicieux de proposer `w780` ou `original` pour les posters egalement.

---

## Enrichissement TMDB + Fanart.tv

### Vue d'ensemble

L'enrichissement permet d'ajouter des metadonnees supplementaires aux films depuis des sources externes. Les donnees enrichies sont disponibles dans les templates pour un affichage plus riche.

### Sources d'enrichissement

| Source | Type de donnees | Necessite |
|--------|----------------|-----------|
| **TMDB** | Synopsis, tagline, note, casting, realisateurs, genres, studios, mots-cles, logos, backdrops, posters, titre original, nombre de votes, IMDB ID | Cle API TMDB (service Metadata type `tmdb`) |
| **Fanart.tv** | Logos HD transparents, backdrops HD, posters HD | Cle API Fanart.tv + TMDB ID (enrichir d'abord depuis TMDB) |

### Donnees enrichies disponibles dans les templates

| Champ | Source | Description |
|-------|--------|-------------|
| `movie.overview` | TMDB | Synopsis du film |
| `movie.tagline` | TMDB | Slogan du film |
| `movie.rating` | TMDB | Note sur 10 |
| `movie.vote_count` | TMDB | Nombre de votes communautaires |
| `movie.genres` | TMDB | Genres (Science-Fiction, Drame, ...) |
| `movie.directors` | TMDB | Realisateurs |
| `movie.cast` | TMDB | Acteurs principaux (jusqu'a 20) |
| `movie.studios` | TMDB | Studios de production |
| `movie.keywords` | TMDB | Mots-cles thematiques |
| `movie.original_title` | TMDB | Titre original (VO) |
| `movie.logos` | Fanart.tv + TMDB | Logos HD transparents (Fanart prioritaire) |
| `movie.extra_backdrops` | TMDB + Fanart.tv | Backdrops alternatifs |
| `movie.extra_posters` | TMDB + Fanart.tv | Posters alternatifs |
| `movie.enrichment_sources` | Auto | Sources appliquees : `["tmdb", "fanart"]` |

### Config pour l'enrichissement

| Propriete | Type | Description |
|-----------|------|-------------|
| `show_enrichment_sources` | boolean | Affiche les badges TMDB/Fanart.tv |
| `show_studios` | boolean | Affiche les studios de production |
| `show_original_title` | boolean | Affiche le titre original si different |
| `show_overview` | boolean | Affiche le synopsis |
| `cast_scroll` | boolean | Defilement horizontal du casting (si > 4 acteurs) |
| `use_logo_image` | boolean | Utilise le logo HD au lieu du titre texte |

### Templates optimises pour l'enrichissement

- **Showcase Enrichi** (`showcase-enriched`) : exploite toutes les donnees enrichies dans un layout 2 colonnes avec panneau glassmorphism
- **Moderne Enrichi** (`modern-enriched`) : design moderne avec badge gradient-border, etoiles de notation, genres en pills, casting defilant
- **Galerie Fanart** (`fanart-gallery`) : diaporama plein ecran des backdrops avec indicateur de progression
- **Panorama Glissant** (`panorama-slide`) : backdrops glissant horizontalement avec infos a gauche
- **Cinema Immersif** (`cinematic-immersive`) : backdrop plein ecran Ken Burns avec logo HD
- **Debug TMDB** (`debug-tmdb`) : affiche toutes les donnees brutes pour verification

### API d'enrichissement

```
# Verifier les services d'enrichissement disponibles
GET /movies/enrichment-status

# Enrichir un film
POST /movies/{movie_id}/enrich?sources=tmdb
POST /movies/{movie_id}/enrich?sources=fanart
POST /movies/{movie_id}/enrich?sources=tmdb,fanart
```

---

## Exemples complets

### Exemple 1 : Template minimaliste custom

```json
{
  "name": "Mon Template Minimaliste",
  "description": "Titre et countdown sur fond noir",
  "template_type": "countdown",
  "layout": {
    "style": "minimal-focus",
    "components": [
      { "type": "color_background", "color": "#111111" },
      { "type": "title", "size": "giant", "position": "center" },
      { "type": "countdown", "size": "xlarge" }
    ]
  },
  "config": {
    "background_color": "#111111",
    "text_color": "#ffffff",
    "accent_color": "#ff6b6b",
    "show_seconds": true,
    "animate_numbers": true,
    "badge": { "show_when": "never" }
  }
}
```

### Exemple 2 : Template avec infos completes et badge dynamique

```json
{
  "name": "Soiree Cinema Complete",
  "description": "Affichage complet avec vote et statut dynamique",
  "template_type": "movie_info",
  "layout": {
    "style": "split-horizontal",
    "components": [
      { "type": "backdrop", "opacity": 0.25, "blur": 20 },
      { "type": "poster", "position": "left", "size": "full-height", "shadow": true },
      { "type": "title", "size": "xlarge" },
      { "type": "tagline", "style": "italic" },
      { "type": "genres" },
      { "type": "directors" },
      { "type": "cast", "limit": 4 },
      { "type": "overview", "max_lines": 3 },
      { "type": "metadata", "fields": ["year", "runtime", "rating", "votes"] },
      { "type": "countdown", "size": "large" },
      { "type": "badge", "text": "{{status_text}}", "position": "top-right", "style": "status-badge" }
    ]
  },
  "config": {
    "show_seconds": true,
    "show_rating": true,
    "show_votes": true,
    "show_genres": true,
    "show_director": true,
    "show_overview": true,
    "use_palette_colors": true,
    "badge": {
      "text": "{{status_text}}",
      "show_when": "always",
      "style": "status-badge",
      "colors": {
        "vote_open": "#f59e0b",
        "vote_closed": "#22c55e",
        "scheduled": "#6366f1",
        "running": "#ef4444",
        "default": "#6b7280"
      }
    }
  }
}
```

### Exemple 3 : Template HTML brut

```json
{
  "name": "Custom HTML",
  "description": "Template entierement personnalise en HTML/CSS",
  "template_type": "custom",
  "content": "<div class='custom-root'><h1 class='movie-title'>Film en cours</h1><div class='palette-accent'>Accent color</div></div>",
  "styles": ".custom-root { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--palette-background, #000); color: var(--palette-text, #fff); } .movie-title { font-size: 5rem; } .palette-accent { color: var(--palette-accent, #6366f1); }"
}
```

> **Note** : en mode HTML brut, les variables `{{movie.title}}` ne sont pas resolues automatiquement. Il faudrait implementer un systeme de templating cote backend ou utiliser le JavaScript (`script`) pour acceder aux donnees.

### Exemple 4 : Template neon avec textes custom

```json
{
  "name": "Neon Personnalise",
  "template_type": "movie_info",
  "layout": {
    "style": "neon-retro",
    "components": [
      { "type": "grid_overlay" },
      { "type": "poster", "position": "center", "size": "medium" },
      { "type": "title", "size": "xlarge" },
      { "type": "metadata", "fields": ["year", "runtime", "rating"] },
      { "type": "custom_text", "text": "CHEZ JEREMIE", "position": "top-center", "style": "retro-subtitle" }
    ]
  },
  "config": {
    "theme": "neon",
    "neon_color": "#ff00ff",
    "secondary_neon": "#00ffff",
    "show_grid": true,
    "scanlines": true,
    "badge": {
      "text": "{{countdown_short}}",
      "style": "neon",
      "color": "#00ffff"
    },
    "custom_texts": [
      { "text": "CINEMA PRIVE", "position": "top-center", "style": "neon-subtitle" }
    ]
  }
}
```

---

## Referene rapide : structure d'un template

```json
{
  "name": "string (requis)",
  "description": "string",
  "template_type": "countdown | movie_info | session_status | custom",

  // Option A : layout structure (recommande)
  "layout": {
    "style": "split-horizontal | poster-fullscreen | ...",
    "components": [
      { "type": "...", "position": "...", "size": "...", ... }
    ]
  },

  // Option B : HTML brut
  "content": "<html>...</html>",
  "styles": "css...",
  "script": "js...",

  // Configuration
  "config": {
    "theme": "...",
    "badge": { ... },
    "custom_texts": [ ... ],
    "show_seconds": true,
    // ... (voir section config)
  }
}
```
