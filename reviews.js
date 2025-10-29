// Google Reviews integration
// How it works:
// - Frontend fetches from a backend endpoint you host, e.g. /api/reviews
// - That backend calls Google Places Details API with your Place ID and API key
// - We render up to 6 recent high-rated reviews with attribution

(function(){
  const PLACE_ID = window.GM_PLACE_ID || null; // optionally set on page
  const GOOGLE_URL = window.GM_GOOGLE_URL || null; // link to full listing
  const endpoint = window.GM_REVIEWS_ENDPOINT || '/api/reviews';
  const directKey = window.GM_GOOGLE_API_KEY || window.GM_DIRECT_GOOGLE_KEY || null; // dev-only
  const grid = document.getElementById('reviews-grid');
  const link = document.getElementById('reviews-google-link');
  if (!grid) return;

  function stars(n){
    const s = Math.round(n);
    return '★★★★★'.slice(0, s) + '☆☆☆☆☆'.slice(0, 5 - s);
  }

  function authorLabel(name){
    const raw = (name || 'Google User').trim();
    if (!raw || raw.toLowerCase() === 'google user') return 'Google User';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first} ${lastInitial}.`;
  }

  function snippet(text, max = 140){
    if (!text) return '';
    const stripped = String(text).replace(/\s+/g, ' ').trim();
    if (stripped.length <= max) return stripped;
    const truncated = stripped.slice(0, max);
    const lastSpace = truncated.lastIndexOf(' ');
    const result = lastSpace > 60 ? truncated.slice(0, lastSpace) : truncated;
    return `${result}…`;
  }

  function render(reviews, listingUrl, avgRating, totalCount){
    grid.innerHTML = '';
    const all = Array.isArray(reviews) ? reviews : [];
    // Compute average if not provided
    const computedAvg = (typeof avgRating === 'number' && !Number.isNaN(avgRating))
      ? avgRating
      : (all.length ? all.reduce((s,r) => s + (r.rating || 0), 0) / all.length : undefined);
    const computedTotal = (typeof totalCount === 'number' && !Number.isNaN(totalCount)) ? totalCount : all.length;
    // Ensure only reviews above 4 stars, newest first
    const items = all
      .filter(r => (r.rating || 0) >= 4)
      .sort((a,b) => (b.time || 0) - (a.time || 0))
      .slice(0, 12);

    for (const r of items){
      const card = document.createElement('div');
      card.className = 'review-card';
      card.innerHTML = `
        <div class="review-header">
          <img class="review-avatar" src="${r.profile_photo_url || ''}" alt="${r.author_name || 'Reviewer'}" onerror="this.style.visibility='hidden'">
          <div>
            <div class="review-name">${r.author_name || 'Google User'}</div>
            <div class="review-stars" aria-label="${r.rating} star rating">${stars(r.rating || 5)}</div>
          </div>
        </div>
        <div class="review-text">${(r.text || '').replace(/</g,'&lt;')}</div>
        <div class="review-time">${r.relative_time_description || ''}</div>
      `;
      grid.appendChild(card);
    }
    if (link){ link.href = listingUrl || GOOGLE_URL || '#'; }

    // Also populate the top scrolling banner with snippets
    const ticker = document.getElementById('reviews-ticker');
    if (ticker){
      const mkItem = (rev) => {
        const safe = (rev.text || '').replace(/</g,'&lt;');
        return `
        <div class="review-item">
          <div class="stars" aria-hidden="true">${stars(rev.rating || 5)}</div>
          <div class="review-snippet">“${snippet(safe)}”</div>
          <div class="review-author">${authorLabel(rev.author_name)}</div>
        </div>`;
      };
      const seq = items.map(mkItem).join('');
      // duplicate once for seamless scrolling illusion
      ticker.innerHTML = seq + seq;
    }

    const metaBar = document.getElementById('reviews-meta');
    if (metaBar){
      const ratingEl = metaBar.querySelector('[data-rating]');
      if (ratingEl && typeof computedAvg === 'number') {
        ratingEl.textContent = computedAvg.toFixed(1);
      }
      const countEl = metaBar.querySelector('[data-count]');
      if (countEl) {
        if (typeof computedTotal === 'number' && computedTotal > 0) {
          let formatted = String(computedTotal);
          try {
            const nf = (typeof Intl !== 'undefined' && Intl.NumberFormat) ? new Intl.NumberFormat('en-US') : null;
            if (nf) formatted = nf.format(computedTotal);
          } catch {}
          countEl.textContent = `Based on ${formatted}+ Google reviews`;
        } else {
          countEl.textContent = 'Verified Google club-fitting reviews';
        }
      }
      const metaLink = metaBar.querySelector('[data-meta-link]');
      if (metaLink) {
        metaLink.href = listingUrl || GOOGLE_URL || metaLink.href || '#';
      }
      metaBar.hidden = false;
    }

    // Expose rating meta for other widgets
    try {
      const meta = { rating: computedAvg, total: computedTotal, url: link?.href };
      window.GM_REVIEWS_META = meta;
      window.dispatchEvent(new CustomEvent('gm-reviews-loaded', { detail: meta }));
    } catch {}
  }

  async function tryBackend(){
    const url = `${endpoint}${PLACE_ID ? `?place_id=${encodeURIComponent(PLACE_ID)}`:''}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('backend status ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.reviews)) throw new Error('unexpected payload');
    render(data.reviews, data.url, data.rating, data.user_ratings_total);
  }

  async function tryDirect(){
    if (!directKey || !PLACE_ID) throw new Error('no direct key or place id');
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', PLACE_ID);
    url.searchParams.set('fields', 'url,reviews,rating,user_ratings_total');
    url.searchParams.set('key', directKey);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('google status ' + res.status);
    const payload = await res.json();
    if (payload.status !== 'OK') throw new Error('google payload ' + payload.status);
    const reviews = Array.isArray(payload.result?.reviews) ? payload.result.reviews : [];
    render(reviews, payload.result?.url, payload.result?.rating, payload.result?.user_ratings_total);
  }

  async function load(){
    // Wait for optional config overrides (e.g., /aws/config.json)
    try { if (window.GM_CONFIG_READY) await window.GM_CONFIG_READY; } catch {}
    // Try backend > try direct key (dev) > fallback mock
    try{
      await tryBackend();
      return;
    } catch {}
    try{
      await tryDirect();
      return;
    } catch {}
    try{
      if (!window.GM_DISABLE_MOCKS) {
        const res = await fetch('/mock-reviews.json', { cache: 'no-store' });
        if (res.ok){
          const data = await res.json();
          render(data.reviews || [], data.url);
          return;
        }
      }
    } catch {}
    // If we reach here, show nothing instead of placeholders
    render([], window.GM_GOOGLE_URL || '#');
  }

  load();
  if (typeof window !== 'undefined') {
    window.reloadReviews = load;
  }
})();
