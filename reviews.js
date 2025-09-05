// Google Reviews integration
// How it works:
// - Frontend fetches from a backend endpoint you host, e.g. /api/reviews
// - That backend calls Google Places Details API with your Place ID and API key
// - We render up to 6 recent high-rated reviews with attribution

(function(){
  const PLACE_ID = window.GM_PLACE_ID || null; // optionally set on page
  const GOOGLE_URL = window.GM_GOOGLE_URL || null; // link to full listing
  const endpoint = window.GM_REVIEWS_ENDPOINT || '/api/reviews';
  const grid = document.getElementById('reviews-grid');
  const link = document.getElementById('reviews-google-link');
  if (!grid) return;

  function stars(n){
    const s = Math.round(n);
    return '★★★★★'.slice(0, s) + '☆☆☆☆☆'.slice(0, 5 - s);
  }

  function render(reviews, listingUrl){
    grid.innerHTML = '';
    const items = reviews.slice(0, 6);
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
  }

  async function load(){
    try{
      // Try backend endpoint
      const res = await fetch(`${endpoint}${PLACE_ID ? `?place_id=${encodeURIComponent(PLACE_ID)}`:''}`);
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();
      // Expected shape: { reviews: [...], url: 'https://maps.google.com/?cid=...' }
      if (data && Array.isArray(data.reviews)) {
        render(data.reviews, data.url);
        return;
      }
      throw new Error('unexpected payload');
    } catch (e){
      // Fallback to mock file if present so the layout still works during dev
      try{
        const res = await fetch('/mock-reviews.json', { cache: 'no-store' });
        if (res.ok){
          const data = await res.json();
          render(data.reviews || [], data.url);
          return;
        }
      } catch {}
      // If everything fails, keep existing banner content
    }
  }

  load();
})();

