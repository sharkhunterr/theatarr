# Architecture d'orchestration de session Theatarr

## Sommaire

1. [Scenario type](#scénario-type)
2. [Modes d'affichage : PC vs Cast vs Smart TV](#modes-daffichage)
3. [Comparatif des devices cibles](#comparatif-des-devices-cibles)
4. [Les approches d'orchestration](#les-approches-dorchestration)
5. [Comparatif des approches](#comparatif-des-approches)
6. [Faisabilite technique par composant](#faisabilité-technique-par-composant)
7. [Recommandation finale](#recommandation-finale)
8. [Architecture proposee](#architecture-proposée)

---

## Scenario type

Un admin cree une session de cinema composee de **sequences** orchestrees :

| # | Sequence | Duree | Actions |
|---|----------|-------|---------|
| 1 | **Ambiance pre-film** | 5 min | Lumieres Hue = couleur dominante du film, musique d'ambiance, ecran d'attente anime (wallmount) |
| 2 | **Countdown / Revelation** | 30s | Countdown dramatique, reveal du film, changement lumieres |
| 3 | **Lancement film** | ~2h | Extinction lumieres, arret musique, lecture du film sur le player |
| 4 | **Fin de session** | 30s | Rallumer lumieres progressivement, ecran de fin |

La question centrale : **comment afficher les visuels, jouer la musique, ET lancer le film sur le meme ecran, avec differents types de materiel ?**

---

## Modes d'affichage

Theatarr doit supporter **plusieurs types de setup** via un systeme de "Display Adapter" :

```
┌────────────────────────────────────────────────────────┐
│                    Backend Theatarr                      │
│                                                          │
│  Session Engine ──→ Display Adapter (interface commune)  │
│                          │                               │
│              ┌───────────┼───────────┐                   │
│              ▼           ▼           ▼                   │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│     │ Mode PC  │  │ Mode Cast│  │ Mode TV  │           │
│     │ (browser │  │ (Custom  │  │ (Samsung │           │
│     │  kiosk)  │  │ Receiver)│  │  LG,ATV) │           │
│     └──────────┘  └──────────┘  └──────────┘           │
└────────────────────────────────────────────────────────┘
```

### Mode 1 : PC / Raspberry Pi (Browser Kiosk)

Un PC ou RPi connecte en HDMI fait tourner Chrome en mode kiosk sur la page wallmount.

| Aspect | Detail |
|--------|--------|
| **Pre-show** | Page wallmount React (animations, templates) + Web Audio API (musique) |
| **Film** | Redirect vers Plex/Jellyfin Web OU API play sur player natif |
| **Controle** | WebSocket temps reel, instantane |
| **Audio** | Web Audio API : crossfade, volume, autoplay (flag `--autoplay-policy=no-user-gesture-required`) |
| **Lancement** | `chromium --kiosk --autoplay-policy=no-user-gesture-required http://theatarr:2173/wallmount` |
| **Materiel** | N'importe quel PC / RPi4+ / mini-PC |

**C'est le mode le plus simple et le plus fiable.** Le browser est un environnement controle a 100%.

### Mode 2 : Android TV / Google TV (ADB)

Le backend controle une Android TV via ADB sur le reseau local.

| Aspect | Detail |
|--------|--------|
| **Pre-show** | Lancement du navigateur Chrome avec l'URL wallmount via ADB intent |
| **Film** | API Plex/Jellyfin pour lancer le film dans l'app native (qualite max) |
| **Controle** | ADB intents + `androidtvremote2` (Python) |
| **Audio** | Web Audio API dans Chrome Android TV OU audio via l'app Plex |

```bash
# Ouvrir le wallmount dans Chrome sur Android TV
adb shell am start -a android.intent.action.VIEW \
  -d "http://theatarr:2173/wallmount" \
  -n com.android.chrome/com.google.android.apps.chrome.Main

# Ou installer Fully Kiosk Browser pour un mode kiosk propre
adb shell am start -a android.intent.action.VIEW \
  -d "http://theatarr:2173/wallmount" \
  -n de.ozerov.fully/.FullyActivity
```

**Prerequis** : Activer les Options Developpeur + Debogage USB/Reseau sur la TV.

**Alternative sans ADB** : La lib `androidtvremote2` utilise le protocole Android TV Remote v2 (meme que l'app Google TV Remote). **Pas besoin de mode developpeur.** Peut envoyer des touches, lancer des apps par deep link.

### Mode 3 : Chromecast / Google TV Stick (Custom Receiver)

Un Chromecast affiche un **Custom Web Receiver** heberge par Theatarr.

| Aspect | Detail |
|--------|--------|
| **Pre-show** | Custom Receiver charge le wallmount dans une iframe |
| **Film** | Bascule vers le player media integre au CAF (Cast Application Framework) |
| **Controle** | PyChromecast (Python) via custom namespace |
| **Audio** | Integre dans le receiver (Web Audio API dans la page castee) |

#### Pourquoi PAS DashCast

DashCast est un receiver Chromecast cree en **2014** (pas dependant de Home Assistant, mais le component HA est juste un sender). Problemes :
- Receiver non maintenu depuis 10 ans (marche par chance de retrocompatibilite)
- Charge les pages en iframe → bloque par `X-Frame-Options` sur beaucoup de sites
- Mode `force` (window.location) tue le receiver → plus aucun controle
- Chromecast en 720p avec CPU lent → animations complexes laggent
- Idle timeout du Chromecast peut tuer le receiver

#### Custom Receiver Theatarr : la bonne approche

Creer un **Custom Web Receiver** enregistre sur le Google Cast Developer Console :

| Etape | Detail |
|-------|--------|
| 1. Inscription | [cast.google.com/publish](https://cast.google.com/publish) — **5$ one-time** |
| 2. Creer l'app | Type "Custom Receiver", URL = `https://theatarr:2173/cast-receiver.html` |
| 3. Mode non-publie | Enregistrer les Chromecasts par numero de serie → fonctionne sans publier |
| 4. Sender | PyChromecast envoie des commandes via namespace custom `urn:x-cast:com.theatarr` |

Le receiver peut :
- Afficher le wallmount (iframe vers `/wallmount?cast=true`)
- Jouer de l'audio (Web Audio API integree)
- Basculer vers la lecture video (CAF media player)
- Recevoir des commandes du backend (changement de sequence, volume, etc.)
- **Tout ca dans une seule app** → pas de switch d'app, pas d'ecran noir

```
┌─ Chromecast ─────────────────────────────┐
│  Custom Receiver (theatarr-receiver.html) │
│  ┌─────────────────────────────────────┐ │
│  │  Mode 1: iframe wallmount          │ │ ← pre-show
│  │  + Web Audio API (musique)          │ │
│  ├─────────────────────────────────────┤ │
│  │  Mode 2: CAF Media Player          │ │ ← film
│  │  (video stream depuis Plex/JF)      │ │
│  └─────────────────────────────────────┘ │
│            ↕ namespace urn:x-cast:com.theatarr │
└──────────────────────────────────────────┘
           ↑ pychromecast
    ┌──────┴──────┐
    │   Backend   │
    └─────────────┘
```

### Mode 4 : Smart TV (Samsung Tizen / LG webOS)

Le backend ouvre le navigateur integre de la TV avec l'URL du wallmount.

| TV | Lib Python/Node | Commande |
|----|-----------------|----------|
| **Samsung Tizen** | `samsungtvws` (Python) | `tv.open_browser("http://theatarr:2173/wallmount")` |
| **LG webOS** | `lgtv2` (Node) ou SSAP via WS | `launch("com.webos.app.browser", {target: url})` |

**Limites** :
- Le navigateur integre des TV est souvent un vieux Chromium (CSS/JS parfois incompatible)
- Pas de flag autoplay → necessite un geste utilisateur pour l'audio
- Performances variables (les TV ne sont pas des PC)
- Pour le film : lancer l'app Plex/Jellyfin native via la meme API

### Mode 5 : Apple TV (pyatv) — Limite

| Aspect | Detail |
|--------|--------|
| **Pre-show** | **Impossible** d'afficher une page web. Pas de navigateur controllable. |
| **Film** | `pyatv` peut lancer l'app Plex et faire du deep link, mais pas ouvrir une URL arbitraire |
| **Audio** | `pyatv` peut streamer audio via AirPlay |
| **Alternative** | Developper une app tvOS (necessite Apple Developer Account 99$/an) |

**Verdict** : Apple TV n'est viable que pour la lecture du film (pas pour le pre-show wallmount). Il faudrait un device secondaire pour le pre-show ou renoncer au pre-show visuel.

---

## Comparatif des devices cibles

| Device | Pre-show web | Film qualite max | Audio pre-show | Controle distant | Cout adapter | Difficulte |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| **PC/RPi Kiosk** | Excellent | Bon (web) / Excellent (player natif) | Excellent (Web Audio) | WS instantane | 0€ | Facile |
| **Android TV / Google TV** | Bon (Chrome ATV) | Excellent (app native) | Bon | ADB / androidtvremote2 | 0€ | Moyen |
| **Chromecast + Custom Receiver** | Bon (iframe 720p) | Bon (CAF player, DD+) | Bon (integre) | pychromecast | 5€ (one-time) | Moyen-Haut |
| **Samsung Tizen TV** | Moyen (vieux browser) | Excellent (app native) | Limite (autoplay) | samsungtvws | 0€ | Moyen |
| **LG webOS TV** | Moyen (vieux browser) | Excellent (app native) | Limite (autoplay) | lgtv2 / SSAP | 0€ | Moyen |
| **Apple TV** | Impossible | Excellent (app native) | AirPlay audio seul | pyatv | 0€ | Haut (pas de web) |
| **Roku** | Impossible | Bon (app native) | Impossible | ECP (HTTP) | 0€ | Non viable |

---

## Les approches d'orchestration

Independamment du device, la question reste : comment enchainer pre-show et film ?

### Approche 1 : 100% Browser (PC Kiosk)

Tout reste dans le navigateur. Le film est lu via le web player Plex/Jellyfin.

```
Wallmount React ──redirect──→ Plex Web Player ──redirect──→ Wallmount (fin)
```

- Simple, pas de dependance externe
- Perd HDR/4K/DTS (limites browser)
- Ideal si pas de home-cinema

### Approche 2 : Browser + API Player Natif (recommande)

Le wallmount gere le pre-show, le backend lance le film sur un player natif via API.

```
Wallmount React ──ecran noir──→ Player natif (API Plex) ──webhook fin──→ Wallmount (fin)
```

- Qualite maximale pour le film
- Pre-show riche en animations
- Le wallmount affiche un ecran noir pendant le film (ou se cache si HDMI-CEC switch)

### Approche 3 : Custom Cast Receiver (Chromecast)

Un seul receiver gere tout : iframe wallmount puis CAF media player.

```
Custom Receiver: iframe wallmount ──switch interne──→ CAF video player ──→ iframe wallmount
```

- Pas de switch d'app visible (tout dans le meme receiver)
- Limite a 720p pour le pre-show, DD+ max pour le film
- Necessite le dev du receiver

### Approche 4 : Smart TV API

Le backend pilote la TV : ouvre le navigateur pour le pre-show, lance l'app Plex pour le film.

```
Browser TV (wallmount) ──API switch app──→ App Plex native ──API switch app──→ Browser TV (fin)
```

- Qualite native pour le film
- Pre-show limite par le browser embarque
- Transition visible (switch d'app ~2-3s)

---

## Comparatif des approches

| Critere | 1. 100% Browser | 2. Browser + Player | 3. Custom Receiver | 4. Smart TV API |
|---------|:-:|:-:|:-:|:-:|
| **Complexite dev** | Faible | Moyenne | Haute | Moyenne |
| **Qualite pre-show** | Excellente | Excellente | Bonne (720p) | Variable |
| **Qualite film** | Correcte (web) | Excellente (natif) | Bonne (DD+) | Excellente (natif) |
| **Transition** | Visible (redirect) | Propre (ecran noir) | Invisible (interne) | Visible (switch app) |
| **Audio pre-show** | Excellent | Excellent | Bon | Limite |
| **Interactivite** | Totale | Totale | Bonne | Limitee |
| **HDR / Atmos** | Non | Oui | Non | Oui |
| **Devices supportes** | PC, RPi | PC + player | Chromecast | Samsung, LG |

---

## Faisabilite technique par composant

### Lumieres Philips Hue

| Action | API | Complexite | Latence |
|--------|-----|------------|---------|
| Allumer en couleur X | `PUT /api/{user}/lights/{id}/state` `{"on":true,"xy":[x,y],"bri":254}` | Triviale | ~50ms |
| Transition progressive (5s) | Ajouter `"transitiontime":50` (unites de 100ms) | Triviale | instant + 5s fade |
| Eteindre progressivement | `{"on":false,"transitiontime":100}` | Triviale | 10s fade |
| Scene dynamique | Entertainment API (UDP/DTLS, 25Hz) | Moyenne | 20-40ms/frame |
| Extraire couleur du film | Palette deja existante dans Theatarr | Deja fait | N/A |

Rate limits : ~10 cmd/s pour `/lights`, ~1 cmd/s pour `/groups`. API locale uniquement, pas de cloud.

### Musique d'ambiance

| Source | Methode | Avantage | Inconvenient |
|--------|---------|----------|--------------|
| Fichier local | URL directe `http://backend/media/ambiance.mp3` | Simple, fiable | Stockage fichiers |
| Plex/Jellyfin | URL stream `http://plex:32400/library/parts/{id}?token=...` | Catalogue existant | Depend du serveur |
| URL externe | Web Audio API directement | Pas de stockage | Depend d'internet |

**Crossfade** : Web Audio API via `GainNode.gain.linearRampToValueAtTime()` (equal-power crossfade).

**Autoplay** : Chrome kiosk (`--autoplay-policy=no-user-gesture-required`) → autoplay sans interaction.

### Lecture du film

| Methode | API | Qualite max | Controle |
|---------|-----|-------------|----------|
| Plex Web (browser) | Redirect URL | 1080p, stereo/DD+ | Via Plex Web UI |
| Plex API → player natif | `POST /player/playback/playMedia` + header `X-Plex-Target-Client-Identifier` | 4K HDR, Atmos | Via API |
| Jellyfin Web (browser) | Redirect URL | 1080p, stereo/DD+ | Via Jellyfin Web |
| Jellyfin API → player natif | `POST /Sessions/{id}/Playing` | 4K HDR, Atmos | Via API |
| Chromecast (CAF) | pychromecast media_controller | 4K, DD+ | Via Cast |

**Python lib Plex** : `python-plexapi` — `client = plex.client("TV"); client.playMedia(movie)`

**Detection fin de film** : Plex webhooks (`media.stop`) ou polling API `/status/sessions`.

### Controle TV / Device

| Device | Lib | Actions disponibles |
|--------|-----|---------------------|
| HDMI-CEC | `cec-client` (Linux) | Power on/off, switch input, volume |
| Android TV | `androidtvremote2` (Python) | Navigation, lancement apps, deep links |
| Samsung | `samsungtvws` (Python) | Power, apps, browser URL, volume |
| LG | `lgtv2` (Node) / SSAP | Power, apps, browser URL, volume |
| Apple TV | `pyatv` (Python) | Power, apps (pas browser), AirPlay |
| Chromecast | `pychromecast` (Python) | Launch receiver, media, volume |

---

## Recommandation finale

### Architecture multi-mode avec Display Adapters

Plutot que choisir une seule approche, Theatarr devrait supporter **plusieurs modes** via le systeme d'adapters existant. L'admin configure son setup une fois, le Session Engine utilise l'adapter correspondant.

**Mode prioritaire a developper : PC/RPi Kiosk (Mode 1 + Approche 2)**

C'est le plus simple, le plus fiable, et couvre 80% des cas. Les autres modes pourront etre ajoutes plus tard comme adapters supplementaires.

---

## Architecture proposee

### Display Adapter Interface

```python
class DisplayAdapter(ServiceAdapter):
    """Interface commune pour tous les modes d'affichage."""

    category = AdapterCategory.DISPLAY  # nouveau type

    async def show_wallmount(self, url: str) -> None:
        """Afficher la page wallmount sur l'ecran."""
        ...

    async def play_media(self, media_url: str, media_type: str) -> None:
        """Lancer la lecture d'un media (film)."""
        ...

    async def stop_media(self) -> None:
        """Arreter la lecture."""
        ...

    async def show_black_screen(self) -> None:
        """Afficher un ecran noir (transition)."""
        ...

    async def get_playback_state(self) -> dict:
        """Etat de lecture actuel (playing/paused/stopped, position)."""
        ...
```

### Implementations

| Adapter | Pre-show | Film | Notes |
|---------|----------|------|-------|
| `BrowserKioskAdapter` | WS → wallmount page | WS → redirect Plex Web | Le plus simple |
| `PlexPlayerAdapter` | WS → wallmount page | API Plex → player natif | Meilleure qualite |
| `ChromecastAdapter` | pychromecast → custom receiver | CAF media player | Necessitecustom receiver |
| `AndroidTvAdapter` | ADB → Chrome URL | ADB → intent Plex app | Necessite mode dev |
| `SamsungTvAdapter` | samsungtvws → browser URL | samsungtvws → launch Plex | Samsung uniquement |
| `LgTvAdapter` | lgtv2 → browser URL | lgtv2 → launch Plex | LG uniquement |

### Flux orchestre par le Session Engine

```
┌─────────────────────────────────────────────────────────────┐
│  Session Engine (pour chaque sequence)                       │
│                                                              │
│  1. Lire les actions de la sequence                          │
│  2. Pour chaque action :                                     │
│     ├─ type: "display"  → DisplayAdapter.show_wallmount()   │
│     ├─ type: "audio"    → WS audio command au wallmount     │
│     ├─ type: "lights"   → HueAdapter.set_scene()            │
│     ├─ type: "playback" → DisplayAdapter.play_media()       │
│     └─ type: "wait"     → Attendre duree / evenement        │
│  3. Quand toutes les actions sont terminees → sequence suivante │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Modele de sequence enrichi

```json
{
  "sequences": [
    {
      "name": "Ambiance",
      "duration": 300,
      "actions": [
        {"type": "display", "command": "wallmount", "template": "cinematic-mystery"},
        {"type": "audio", "command": "play", "source": "plex://music/12345", "volume": 0.6, "fade_in": 3},
        {"type": "lights", "command": "scene", "color": "movie_primary", "brightness": 80, "transition": 5}
      ]
    },
    {
      "name": "Countdown",
      "duration": 30,
      "actions": [
        {"type": "display", "command": "wallmount", "template": "countdown"},
        {"type": "audio", "command": "fade_out", "duration": 5},
        {"type": "lights", "command": "pulse", "color": "movie_primary", "speed": "slow"}
      ]
    },
    {
      "name": "Film",
      "duration": "until_end",
      "actions": [
        {"type": "display", "command": "black"},
        {"type": "lights", "command": "off", "transition": 3},
        {"type": "playback", "command": "play", "source": "plex://movie/67890"}
      ]
    },
    {
      "name": "Fin",
      "duration": 60,
      "trigger": "playback_end",
      "actions": [
        {"type": "display", "command": "wallmount", "template": "session-end"},
        {"type": "lights", "command": "scene", "color": "warm_white", "brightness": 50, "transition": 10}
      ]
    }
  ]
}
```

### Ordre de developpement recommande

| Phase | Quoi | Effort | Valeur |
|-------|------|--------|--------|
| **1** | DisplayAdapter interface + `BrowserKioskAdapter` (WS commands) | 2-3j | Fondation |
| **2** | Commandes audio wallmount (Web Audio API + WS) | 2j | Pre-show musical |
| **3** | `HueAdapter` (REST API v2, scenes, transitions) | 2j | Lumieres |
| **4** | Modele sequences enrichi + UI admin pour configurer les actions | 3-4j | Orchestration complete |
| **5** | Commandes playback Plex/Jellyfin (etendre adapters existants) | 2j | Lancement film |
| **6** | Session Engine etendu (execution actions par sequence) | 3j | Tout relier |
| **7** | `ChromecastAdapter` + custom receiver HTML | 4-5j | Support Chromecast |
| **8** | `AndroidTvAdapter` (ADB / androidtvremote2) | 2-3j | Support Android TV |
| **9** | `SamsungTvAdapter` / `LgTvAdapter` | 2j chacun | Support Smart TV |

**Phases 1-6** = MVP fonctionnel en mode PC Kiosk (~2 semaines)
**Phases 7-9** = Support multi-device (+2 semaines)
