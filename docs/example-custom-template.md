# Exemple de template custom : Cinema Premiere

Creer un nouveau template dans le Template Manager :
- **Name** : Cinema Premiere
- **Type** : Custom
- **Style de rendu** : HTML/CSS/JS Personnalise

Puis coller le contenu ci-dessous dans les 3 champs.

---

## HTML

```html
<div class="premiere" id="premiere">
  <!-- Animated background layers -->
  <div class="bg-layer">
    <div class="backdrop" id="backdrop"></div>
    <div class="backdrop-blur" id="backdrop-blur"></div>
    <div class="noise"></div>
    <div class="gradient-overlay"></div>
    <div class="vignette"></div>
  </div>

  <!-- Floating particles -->
  <div class="particles" id="particles"></div>

  <!-- Animated accent line -->
  <div class="accent-line"></div>

  <!-- Main content -->
  <div class="main">
    <!-- Poster with 3D tilt -->
    <div class="poster-container" id="poster-container">
      <div class="poster-glow" id="poster-glow"></div>
      <div class="poster-card">
        <img id="poster" src="" alt="" />
        <div class="poster-shine"></div>
      </div>
      <div class="poster-reflection">
        <img id="poster-reflect" src="" alt="" />
      </div>
    </div>

    <!-- Info -->
    <div class="info">
      <div class="rating-chip" id="rating-chip">
        <svg class="star-icon" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
        </svg>
        <span id="rating">--</span>
        <span class="rating-max">/10</span>
      </div>

      <h1 id="title" class="title">En attente...</h1>

      <p id="tagline" class="tagline"></p>

      <div class="divider"><span></span></div>

      <div id="meta" class="meta"></div>
      <div id="genres" class="genres"></div>

      <p id="overview" class="overview"></p>

      <div id="cast" class="cast"></div>
    </div>
  </div>

  <!-- Bottom bar -->
  <div class="bar">
    <div class="bar-inner">
      <div class="session-badge" id="session-badge">
        <div class="pulse-dot"></div>
        <span id="session-name"></span>
      </div>
      <div class="countdown-box" id="countdown-box">
        <div class="countdown-ring" id="countdown-ring">
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" class="ring-bg"/>
            <circle cx="20" cy="20" r="18" class="ring-fill" id="ring-fill"/>
          </svg>
        </div>
        <div class="countdown-value" id="countdown-value"></div>
      </div>
    </div>
    <div class="progress-line">
      <div class="progress-glow" id="progress-glow"></div>
    </div>
  </div>
</div>
```

## CSS

```css
@keyframes float-up {
  0% { transform: translateY(100vh) scale(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-10vh) scale(1); opacity: 0; }
}

@keyframes ken-burns {
  0% { transform: scale(1.05) translate(0, 0); }
  33% { transform: scale(1.2) translate(-2%, -1%); }
  66% { transform: scale(1.1) translate(1%, -2%); }
  100% { transform: scale(1.05) translate(0, 0); }
}

@keyframes reveal-up {
  from { opacity: 0; transform: translateY(40px); filter: blur(8px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@keyframes reveal-scale {
  from { opacity: 0; transform: scale(0.85) translateY(20px); filter: blur(6px); }
  to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
}

@keyframes gradient-rotate {
  0% { --angle: 0deg; }
  100% { --angle: 360deg; }
}

@keyframes shimmer-text {
  0% { background-position: -100% center; }
  100% { background-position: 200% center; }
}

@keyframes shine-move {
  0% { transform: translateX(-100%) rotate(25deg); }
  100% { transform: translateX(200%) rotate(25deg); }
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
}

@keyframes dash-rotate {
  to { stroke-dashoffset: 0; }
}

@keyframes line-scan {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

@keyframes noise-anim {
  0% { transform: translate(0, 0); }
  10% { transform: translate(-5%, -5%); }
  20% { transform: translate(-10%, 5%); }
  30% { transform: translate(5%, -10%); }
  40% { transform: translate(-5%, 15%); }
  50% { transform: translate(-10%, 5%); }
  60% { transform: translate(15%, 0); }
  70% { transform: translate(0, 10%); }
  80% { transform: translate(-15%, 0); }
  90% { transform: translate(10%, 5%); }
  100% { transform: translate(5%, 0); }
}

@keyframes glow-breathe {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

:root {
  --primary: #a855f7;
  --accent: #c084fc;
  --bg: #09090b;
  --text: #fafafa;
  --surface: rgba(255, 255, 255, 0.05);
}

.premiere {
  position: relative;
  width: 100%; height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif;
}

/* ── Background layers ── */
.bg-layer { position: absolute; inset: 0; }

.backdrop {
  position: absolute; inset: -10%;
  background-size: cover; background-position: center;
  animation: ken-burns 40s ease-in-out infinite;
  opacity: 0; transition: opacity 2s ease;
  filter: saturate(1.2);
}
.backdrop.loaded { opacity: 0.35; }

.backdrop-blur {
  position: absolute; inset: -10%;
  background-size: cover; background-position: center;
  filter: blur(80px) saturate(1.8);
  opacity: 0; transition: opacity 2s ease;
}
.backdrop-blur.loaded { opacity: 0.25; }

.noise {
  position: absolute; inset: -50%;
  width: 200%; height: 200%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  animation: noise-anim 8s steps(10) infinite;
  pointer-events: none;
}

.gradient-overlay {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 50%, rgba(0,0,0,0.8), transparent),
    radial-gradient(ellipse 60% 80% at 80% 80%, var(--primary-a, rgba(168,85,247,0.15)), transparent),
    linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.9) 100%);
}

.vignette {
  position: absolute; inset: 0;
  box-shadow: inset 0 0 200px 60px rgba(0,0,0,0.5);
}

/* ── Particles ── */
.particles { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
.particle {
  position: absolute;
  width: 3px; height: 3px;
  background: var(--accent);
  border-radius: 50%;
  animation: float-up linear infinite;
  box-shadow: 0 0 6px var(--accent), 0 0 12px var(--primary);
}

/* ── Accent line ── */
.accent-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--primary), var(--accent), transparent);
  z-index: 10;
  overflow: hidden;
}
.accent-line::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, white 50%, transparent 100%);
  animation: line-scan 4s ease-in-out infinite;
  opacity: 0.6;
}

/* ── Main layout ── */
.main {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 5vw;
  padding: 6vh 5vw;
  height: calc(100% - 70px);
}

/* ── Poster ── */
.poster-container {
  flex-shrink: 0;
  width: 26vw; max-width: 360px;
  position: relative;
  opacity: 0;
  animation: reveal-scale 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
  perspective: 600px;
}

.poster-glow {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
  animation: glow-breathe 5s ease-in-out infinite;
  filter: blur(40px);
  z-index: -1;
}

.poster-card {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.1),
    0 25px 60px -15px rgba(0,0,0,0.7),
    0 0 40px -10px var(--primary);
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}

.poster-card img {
  width: 100%; height: auto; display: block;
}

.poster-shine {
  position: absolute; inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255,255,255,0.12) 45%,
    rgba(255,255,255,0.03) 50%,
    transparent 55%
  );
  animation: shine-move 6s ease-in-out infinite;
  pointer-events: none;
}

.poster-reflection {
  margin-top: 8px;
  height: 60px;
  overflow: hidden;
  border-radius: 0 0 16px 16px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.15), transparent);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.15), transparent);
}
.poster-reflection img {
  width: 100%; height: auto; display: block;
  transform: scaleY(-1);
  filter: blur(2px);
}

/* ── Info panel ── */
.info {
  flex: 1; min-width: 0;
}

.rating-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px;
  background: var(--surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 100px;
  font-weight: 700; font-size: 1rem;
  margin-bottom: 1.2rem;
  opacity: 0;
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards;
}
.rating-chip .star-icon { color: #facc15; filter: drop-shadow(0 0 4px #facc1580); }
.rating-max { opacity: 0.4; font-weight: 400; font-size: 0.8rem; }

.title {
  font-size: clamp(2.2rem, 5vw, 5rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin-bottom: 0.6rem;
  background: linear-gradient(
    90deg,
    var(--text) 0%,
    var(--accent) 30%,
    var(--text) 60%,
    var(--accent) 100%
  );
  background-size: 300% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation:
    reveal-up 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both,
    shimmer-text 8s linear 1.5s infinite;
}

.tagline {
  font-size: 1.15rem;
  font-style: italic;
  opacity: 0;
  color: var(--accent);
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.7s forwards;
  margin-bottom: 1.2rem;
}

.divider {
  margin-bottom: 1.2rem;
  opacity: 0;
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards;
}
.divider span {
  display: block; height: 1px; width: 60px;
  background: linear-gradient(90deg, var(--primary), transparent);
}

.meta {
  display: flex; flex-wrap: wrap; gap: 1.2rem;
  font-size: 0.9rem; opacity: 0;
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards;
  margin-bottom: 1rem;
}
.meta-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px;
  background: var(--surface);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06);
}
.meta-icon { opacity: 0.6; font-size: 0.85rem; }

.genres {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-bottom: 1.5rem;
  opacity: 0;
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards;
}
.genre-pill {
  padding: 6px 16px;
  background: linear-gradient(135deg, var(--surface), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 100px;
  font-size: 0.8rem;
  letter-spacing: 0.03em;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.overview {
  font-size: 0.95rem; line-height: 1.7;
  opacity: 0;
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1.1s forwards;
  max-height: 6em; overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  margin-bottom: 1.2rem;
  color: rgba(255,255,255,0.65);
}

.cast {
  font-size: 0.85rem;
  opacity: 0;
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1.2s forwards;
  color: rgba(255,255,255,0.4);
}
.cast strong { color: rgba(255,255,255,0.6); }

/* ── Bottom bar ── */
.bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  z-index: 5;
}
.bar-inner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 5vw;
  height: 60px;
}

.session-badge {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 16px;
  background: var(--surface);
  backdrop-filter: blur(20px);
  border-radius: 100px;
  border: 1px solid rgba(255,255,255,0.06);
  font-size: 0.8rem;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  opacity: 0;
  animation: reveal-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1.4s forwards;
}

.pulse-dot {
  width: 8px; height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse-ring 2s ease-in-out infinite;
  box-shadow: 0 0 8px #22c55e;
}

.countdown-box {
  display: flex; align-items: center; gap: 12px;
  opacity: 0; transition: opacity 0.6s ease;
}
.countdown-box.visible { opacity: 1; }

.countdown-ring {
  width: 40px; height: 40px;
}
.countdown-ring svg { transform: rotate(-90deg); }
.ring-bg {
  fill: none;
  stroke: rgba(255,255,255,0.08);
  stroke-width: 2.5;
}
.ring-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 113;
  stroke-dashoffset: 113;
  transition: stroke-dashoffset 1s linear;
  filter: drop-shadow(0 0 4px var(--accent));
}

.countdown-value {
  font-size: 1.6rem;
  font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
  text-shadow: 0 0 20px var(--accent);
  letter-spacing: -0.02em;
}

.progress-line {
  height: 2px;
  background: rgba(255,255,255,0.05);
  position: relative;
  overflow: hidden;
}
.progress-glow {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  width: 0%;
  transition: width 1s linear;
  box-shadow: 0 0 12px var(--primary), 0 0 4px var(--accent);
  position: relative;
}
.progress-glow::after {
  content: '';
  position: absolute;
  right: 0; top: -4px;
  width: 10px; height: 10px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--accent);
}
```

## JavaScript

```javascript
(function() {
  // ── Particle system ──
  var particleContainer = document.getElementById('particles');
  function createParticle() {
    var el = document.createElement('div');
    el.className = 'particle';
    var x = Math.random() * 100;
    var dur = 8 + Math.random() * 12;
    var delay = Math.random() * dur;
    var size = 1 + Math.random() * 3;
    el.style.cssText = 'left:' + x + '%;width:' + size + 'px;height:' + size + 'px;animation-duration:' + dur + 's;animation-delay:-' + delay + 's;opacity:' + (0.2 + Math.random() * 0.5);
    particleContainer.appendChild(el);
  }
  for (var i = 0; i < 25; i++) createParticle();

  // ── State tracking ──
  var currentMovie = null;

  Theatarr.onUpdate(function(data) {
    // ── Palette ──
    if (data.palette) {
      var p = data.palette;
      var r = document.documentElement;
      if (p.primary) {
        r.style.setProperty('--primary', p.primary);
        r.style.setProperty('--primary-a', p.primary + '26');
      }
      if (p.accent) r.style.setProperty('--accent', p.accent);
      if (p.background) r.style.setProperty('--bg', p.background);
      if (p.text) r.style.setProperty('--text', p.text);
    }

    // ── Movie ──
    var m = data.movie;
    if (m) {
      var isNew = !currentMovie || currentMovie.title !== m.title;
      currentMovie = m;

      document.getElementById('title').textContent = m.title || '';
      document.getElementById('tagline').textContent = m.tagline || '';

      // Poster
      if (m.poster_url) {
        var poster = document.getElementById('poster');
        var posterReflect = document.getElementById('poster-reflect');
        if (isNew) {
          // Smooth image transition
          var img = new Image();
          img.onload = function() {
            poster.src = m.poster_url;
            poster.alt = m.title;
            posterReflect.src = m.poster_url;
            posterReflect.alt = m.title;
          };
          img.src = m.poster_url;
        }
      }

      // Backdrop
      if (m.backdrop_url) {
        var bd = document.getElementById('backdrop');
        var bdBlur = document.getElementById('backdrop-blur');
        if (isNew) {
          var bdImg = new Image();
          bdImg.onload = function() {
            bd.style.backgroundImage = 'url(' + m.backdrop_url + ')';
            bdBlur.style.backgroundImage = 'url(' + m.backdrop_url + ')';
            bd.classList.add('loaded');
            bdBlur.classList.add('loaded');
          };
          bdImg.src = m.backdrop_url;
        }
      }

      // Rating
      if (m.rating) {
        document.getElementById('rating').textContent = m.rating.toFixed(1);
        document.getElementById('rating-chip').style.removeProperty('display');
      } else {
        document.getElementById('rating-chip').style.display = 'none';
      }

      // Meta
      var metaParts = [];
      if (m.year) metaParts.push('<div class="meta-item"><span class="meta-icon">&#128197;</span> ' + m.year + '</div>');
      if (m.runtime_minutes) {
        var h = Math.floor(m.runtime_minutes / 60);
        var min = m.runtime_minutes % 60;
        metaParts.push('<div class="meta-item"><span class="meta-icon">&#9202;</span> ' + h + 'h' + (min > 0 ? min.toString().padStart(2, '0') : '') + '</div>');
      }
      if (m.directors && m.directors.length > 0) {
        metaParts.push('<div class="meta-item"><span class="meta-icon">&#127916;</span> ' + m.directors[0] + '</div>');
      }
      document.getElementById('meta').innerHTML = metaParts.join('');

      // Genres
      if (m.genres && m.genres.length > 0) {
        document.getElementById('genres').innerHTML = m.genres.map(function(g) {
          return '<span class="genre-pill">' + g + '</span>';
        }).join('');
      }

      // Overview
      document.getElementById('overview').textContent = m.overview || '';

      // Cast
      if (m.cast && m.cast.length > 0) {
        document.getElementById('cast').innerHTML = '<strong>Avec</strong>&ensp;' + m.cast.slice(0, 5).join(' &middot; ');
      }
    }

    // ── Session ──
    if (data.session && data.session.name) {
      document.getElementById('session-name').textContent = data.session.name;
    }

    // ── Countdown ──
    var box = document.getElementById('countdown-box');
    if (data.countdown && data.countdown.remaining > 0) {
      box.classList.add('visible');
      document.getElementById('countdown-value').textContent = data.countdown.formatted;

      // Ring progress (stroke-dashoffset: 113 = empty, 0 = full)
      var progress = data.countdown.progress || 0;
      var offset = 113 - (progress * 113);
      document.getElementById('ring-fill').style.strokeDashoffset = offset;

      // Bottom progress line
      document.getElementById('progress-glow').style.width = (progress * 100) + '%';
    } else {
      box.classList.remove('visible');
    }
  });
})();
```
