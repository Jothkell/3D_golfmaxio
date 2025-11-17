// Lightweight edit mode: toggle to make page text editable and update globe labels.
(function(){
  if (window.__GM_EDIT_MODE_WIRED__) return; // avoid double injection
  window.__GM_EDIT_MODE_WIRED__ = true;

  const state = { on: false };

  // Styles for the editor UI and editable elements
  const style = document.createElement('style');
  style.textContent = `
    .gm-edit-toggle { position: fixed; right: 14px; bottom: 14px; z-index: 10000; }
    .gm-edit-toggle button { background:#111; color:#fff; border:none; padding:10px 14px; border-radius:10px; font-weight:700; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,.25); }
    .gm-edit-panel { position: fixed; right: 14px; bottom: 64px; z-index:10000; background: rgba(255,255,255,0.98); border:1px solid #ddd; border-radius:12px; padding:10px; width: 300px; box-shadow:0 10px 30px rgba(0,0,0,.18); display:none; }
    .gm-edit-panel.on { display:block; }
    .gm-edit-panel label { display:block; font-size:12px; color:#333; margin:6px 0 4px; font-weight:700; }
    .gm-edit-panel input[type="text"] { width:100%; padding:8px; border:1px solid #ccc; border-radius:8px; font-size:13px; }
    .gm-edit-actions { display:flex; gap:8px; margin-top:10px; }
    .gm-edit-actions button { flex:1; padding:8px 10px; border:none; border-radius:8px; font-weight:700; cursor:pointer; }
    .gm-save { background:#111; color:#fff; }
    .gm-reset { background:#eee; color:#333; }
    .gm-editable:focus { outline: 2px dashed #5aa3ff; outline-offset: 2px; }
    html.gm-editing a { pointer-events: none !important; }
    /* Remover affordance */
    .gm-removable { position: relative !important; }
    .gm-remove { position:absolute; top:6px; right:6px; z-index:1000; width:18px; height:18px; border-radius:50%; border:none; cursor:pointer; background:rgba(0,0,0,0.55); color:#fff; line-height:18px; font-size:12px; padding:0; display:flex; align-items:center; justify-content:center; opacity:0.9; }
    html.gm-editing .gm-remove { display:flex; }
    html:not(.gm-editing) .gm-remove { display:none !important; }
    .gm-remove:hover { background:rgba(0,0,0,0.8); }
  `;
  document.head.appendChild(style);

  // UI Elements
  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'gm-edit-toggle';
  const btn = document.createElement('button');
  btn.textContent = 'Edit Text';
  toggleWrap.appendChild(btn);
  document.body.appendChild(toggleWrap);

  const panel = document.createElement('div');
  panel.className = 'gm-edit-panel';
  panel.innerHTML = `
    <label>Globe Label</label>
    <input id="gm-label" type="text" placeholder="FREE ONLINE REMOTE FITTING" />
    <label>Outer Globe Text (tiled)</label>
    <input id="gm-overlay" type="text" placeholder="FREE ONLINE REMOTE FITTING" />
    <div class="gm-edit-actions">
      <button class="gm-save" type="button">Save</button>
      <button class="gm-reset" type="button">Reset</button>
    </div>
  `;
  document.body.appendChild(panel);

  const inputLabel = panel.querySelector('#gm-label');
  const inputOverlay = panel.querySelector('#gm-overlay');
  inputLabel.value = window.GM_LABEL_TEXT || 'FREE ONLINE REMOTE FITTING';
  inputOverlay.value = window.GM_LABEL_TEXT || 'FREE ONLINE REMOTE FITTING';

  function setEditable(on){
    state.on = on;
    document.documentElement.classList.toggle('gm-editing', on);
    btn.textContent = on ? 'Done' : 'Edit Text';
    panel.classList.toggle('on', on);
    const nodes = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, li, label, button, a');
    nodes.forEach(el => {
      // Avoid making inputs editable; skip nav container wrappers to reduce layout issues
      if (el.closest('nav')) return;
      if (['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return;
      el.contentEditable = on ? 'true' : 'false';
      el.classList.toggle('gm-editable', on);
    });

    // Wire up remove (×) buttons for common "items"
    if (on) attachRemovers(); else detachRemovers();
  }

  btn.addEventListener('click', () => setEditable(!state.on));

  // Debounce updates to globe textures
  let t1, t2;
  inputLabel.addEventListener('input', () => {
    clearTimeout(t1);
    const v = inputLabel.value.trim();
    t1 = setTimeout(() => {
      window.GM_LABEL_TEXT = v;
      if (typeof window.updateGlobeLabel === 'function') window.updateGlobeLabel(v);
    }, 150);
  });
  inputOverlay.addEventListener('input', () => {
    clearTimeout(t2);
    const v = inputOverlay.value.trim();
    t2 = setTimeout(() => {
      if (typeof window.updateOverlayText === 'function') window.updateOverlayText(v);
    }, 150);
  });

  // Persistence of edits
  const STORAGE_KEY = 'gm-edits:' + (location && location.pathname ? location.pathname : 'file');
  let deletions = new Set();

  // Assign stable ids to elements we may edit/remove
  function ensureIds(){
    let counter = 1;
    const nodes = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, li, label, button, a, section');
    nodes.forEach(el => {
      if (el.closest('nav')) return;
      if (!el.id && !el.dataset.gmId){ el.dataset.gmId = 'gm-' + (counter++); }
    });
  }

  // Remover helpers
  const SELECTORS = [
    // Major sections
    'section', '.reviews-banner', '.showcase-nav', '.video-process-section', '.fitting-form-section',
    // Cards and sub-items
    '.showcase-card', '.step-card', '.highlight-item', '.credential-item', '.stat-item', '.form-group',
    // Bio blocks
    '.bio-content', '.bio-text', '.bio-image',
    // Video and how-it-works wrappers
    '.video-section', '.how-it-works'
  ];

  // Track deletions when clicking ×
  function attachRemovers(){
    try {
      const seen = new WeakSet();
      document.querySelectorAll(SELECTORS.join(',')).forEach(el => {
        if (el.closest('nav')) return; // avoid nav
        if (seen.has(el)) return;
        seen.add(el);
        el.classList.add('gm-removable');
        if (el.querySelector(':scope > .gm-remove')) return; // already has
        const b = document.createElement('button');
        b.className = 'gm-remove';
        b.type = 'button';
        b.setAttribute('aria-label', 'Remove');
        b.textContent = '×';
        b.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          ensureIds();
          const id = el.id || el.dataset.gmId;
          if (id) deletions.add(id);
          el.remove();
        });
        el.appendChild(b);
      });
    } catch {}
  }

  function detachRemovers(){
    try {
      document.querySelectorAll('.gm-remove').forEach(b => b.remove());
      document.querySelectorAll('.gm-removable').forEach(el => el.classList.remove('gm-removable'));
    } catch {}
  }

  // Save current edits (texts + deletions) to localStorage
  function saveEdits(){
    try {
      ensureIds();
      const payload = { deletions: Array.from(deletions), texts: {} };
      const nodes = document.querySelectorAll('.gm-editable');
      nodes.forEach(el => {
        if (['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return;
        const key = el.id || el.dataset.gmId;
        if (!key) return;
        // Save HTML to preserve simple formatting
        payload.texts[key] = el.innerHTML;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return payload;
    } catch {}
  }

  function applyEdits(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      // Apply deletions first
      (payload.deletions || []).forEach(id => {
        const el = document.getElementById(id) || document.querySelector('[data-gm-id="'+CSS.escape(id)+'"]');
        if (el) el.remove();
      });
      // Apply text edits
      const map = payload.texts || {};
      Object.keys(map).forEach(id => {
        const el = document.getElementById(id) || document.querySelector('[data-gm-id="'+CSS.escape(id)+'"]');
        if (el) el.innerHTML = map[id];
      });
    } catch {}
  }

  // Asterisk prompt handling for known patterns
  function applyPrompts(){
    try {
      const nodes = Array.from(document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6'));
      nodes.forEach(el => {
        const t = (el.textContent || '').trim();
        if (!t.startsWith('*') || !t.endsWith('*')) return;
        const prompt = t.slice(1, -1).toLowerCase();
        // Known: average star rating
        if (prompt.includes('average star rating') || prompt.includes('insert') && prompt.includes('star rating')){
          // Hide this prompt element; hero badge already reflects rating
          el.style.display = 'none';
          return;
        }
        // Known: make these look like tabs (we keep button strip styling)
        if (prompt.includes('make these look like tabs')){
          el.style.display = 'none';
          return;
        }
        // Unknown prompt: keep it visible in edit mode only
        el.dataset.gmPrompt = prompt;
        if (!document.documentElement.classList.contains('gm-editing')){
          el.style.display = 'none';
        }
      });
    } catch {}
  }

  // Wire buttons
  panel.querySelector('.gm-save').addEventListener('click', () => { saveEdits(); applyPrompts(); });
  panel.querySelector('.gm-reset').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });

  // Apply saved edits on load
  applyEdits();
  // Then evaluate any prompts
  applyPrompts();
})();
