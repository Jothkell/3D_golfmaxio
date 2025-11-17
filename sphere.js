// 3D background sphere with scroll-reactive rotation
// and orbiting previews that act as section shortcuts.

(function(){
  const canvas = document.getElementById('bg3d-canvas');
  const container = document.getElementById('bg3d');
  if (!canvas || !container || !window.THREE) return;

  const THREE = window.THREE;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  // Sphere (original size)
  const SPHERE_RADIUS = 2.4;
  const geom = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7fa9ff,
    roughness: 0.45,
    metalness: 0.1,
    emissive: 0x0a1e3a,
    emissiveIntensity: 0.35,
  });
  const sphere = new THREE.Mesh(geom, mat);
  sphere.rotation.y = Math.PI; // orient texture center to face camera
  const globe = new THREE.Group();
  globe.add(sphere);
  scene.add(globe);

  // Label texture: appears printed on the globe (equirectangular mapping)
  function makeLabelTexture(text){
    const w = 2048, h = 1024; // 2:1 for equirectangular
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // Black background (no emission), white text (emits) for emissiveMap
    ctx.fillStyle = 'black';
    ctx.fillRect(0,0,w,h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Fit text to visible hemisphere width so entire line is readable
    let fontSize = Math.floor(h * 0.06); // start small
    const maxWidth = w * 0.45; // keep within central 45% of texture width (visible hemisphere)
    function setFont() { ctx.font = `700 ${fontSize}px Work Sans, Arial, sans-serif`; }
    setFont();
    let width = ctx.measureText(text).width;
    while (width > maxWidth && fontSize > 16) {
      fontSize -= 2;
      setFont();
      width = ctx.measureText(text).width;
    }
    ctx.fillStyle = 'rgba(255,255,255,1.0)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    // Draw centered at equator. Keep within safe margins so text doesn't wrap at seam.
    // Place at x = w*0.5 so it's visible from camera by default.
    ctx.fillText(text, w * 0.5, h * 0.5);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  const initialLabel = (typeof window !== 'undefined' && window.GM_LABEL_TEXT) ? window.GM_LABEL_TEXT : 'FREE ONLINE REMOTE FITTING';
  let labelTex = makeLabelTexture(initialLabel);
  sphere.material.emissiveMap = labelTex;
  sphere.material.needsUpdate = true;

  // Semi-transparent outer globe with repeated text pattern (3x radius)
  function makeTiledTextTexture(text){
    const w = 2048, h = 1024;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // Transparent background; draw repeated text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const baseSize = 56; // reasonably small; many repeats
    ctx.font = `700 ${baseSize}px Work Sans, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 4;

    const stepX = ctx.measureText(text).width + 120;
    const stepY = baseSize * 1.8;
    // Stagger rows to avoid vertical banding and seam artifacts
    for (let y = stepY; y < h - stepY/2; y += stepY) {
      const rowOffset = (y / stepY) % 2 === 0 ? 0 : stepX * 0.5;
      for (let x = -stepX + rowOffset; x < w + stepX; x += stepX) {
        ctx.fillText(text, x, y);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  const OVERLAY_RADIUS = SPHERE_RADIUS * 3.0;
  const overlayGeom = new THREE.SphereGeometry(OVERLAY_RADIUS, 64, 64);
  const overlayMat = new THREE.MeshStandardMaterial({
    color: 0x6f8fdc,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.62, // more opaque so surface is visible
    emissive: 0x0a1e3a,
    emissiveIntensity: 1.4, // brighter text
    depthWrite: false,
    side: THREE.BackSide, // render inner faces since camera is inside
  });
  const overlayTextEnabled = (typeof window !== 'undefined') ? window.GM_OVERLAY_TEXT !== false : true;
  let overlayTex = overlayTextEnabled ? makeTiledTextTexture(initialLabel) : null;
  if (overlayTex) overlayMat.emissiveMap = overlayTex;
  const overlaySphere = new THREE.Mesh(overlayGeom, overlayMat);
  overlaySphere.renderOrder = 1; // draw after inner globe for clarity
  overlaySphere.rotation.y = Math.PI; // align pattern like inner sphere
  globe.add(overlaySphere);

  // Add dots on the sphere surface so motion is visible
  const DOT_COUNT = 600;
  const dotPositions = new Float32Array(DOT_COUNT * 3);
  const r = SPHERE_RADIUS + 0.02; // slightly above the surface
  for (let i = 0; i < DOT_COUNT; i++) {
    // Random point on unit sphere via normal distribution
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len = Math.hypot(x, y, z);
    } while (len === 0 || len > 1);
    x /= len; y /= len; z /= len;
    dotPositions[i*3+0] = x * r;
    dotPositions[i*3+1] = y * r;
    dotPositions[i*3+2] = z * r;
  }
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
  const dotsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, sizeAttenuation: true, opacity: 0.9, transparent: true });
  const dots = new THREE.Points(dotsGeo, dotsMat);
  sphere.add(dots);

  // Resize handling
  function resize(){
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // Scroll-driven rotation: use scroll delta to rotate "down" on scroll down
  let lastScrollY = window.scrollY || 0;
  let targetRotX = 0; // integrate deltas into a target rotation
  const sensitivity = 0.0015; // tune feel
  function handleScroll(){
    const y = window.scrollY || 0;
    const dy = y - lastScrollY;
    lastScrollY = y;
    // Scrolling down (dy>0) should rotate dots downward on screen: decrease rotation.x
    targetRotX -= dy * sensitivity;
    // Clamp to avoid extreme spin
    const clamp = Math.PI * 2;
    if (targetRotX > clamp) targetRotX -= clamp * 2;
    if (targetRotX < -clamp) targetRotX += clamp * 2;
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('wheel', (e) => {
    // For trackpads with momentum when content height is small
    targetRotX -= e.deltaY * sensitivity * 0.5;
  }, { passive: true });

  // No orbiting previews for now
  function layoutPreviews(){ /* intentionally empty */ }

  // Animation loop
  function frame(t){
    // Smoothly approach target X rotation (globe itself). No Y drift on the globe.
    globe.rotation.x += (targetRotX - globe.rotation.x) * 0.08;
    // Keep base Y fixed on the globe itself
    // Apply gentle Y drift only to the dots for parallax cue
    dots.rotation.y = t * 0.00025;
    renderer.render(scene, camera);
    layoutPreviews(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Expose simple update hooks for edit mode
  if (typeof window !== 'undefined') {
    window.updateGlobeLabel = function(text){
      try {
        const newTex = makeLabelTexture(text || '');
        if (labelTex) labelTex.dispose();
        labelTex = newTex;
        sphere.material.emissiveMap = labelTex;
        sphere.material.needsUpdate = true;
      } catch {}
    };
    window.updateOverlayText = function(text){
      try {
        if (!overlayTextEnabled) return; // disabled on this page
        const newTex = makeTiledTextTexture(text || '');
        if (overlayTex) overlayTex.dispose();
        overlayTex = newTex;
        overlayMat.emissiveMap = overlayTex;
        overlayMat.needsUpdate = true;
      } catch {}
    };
  }
})();
