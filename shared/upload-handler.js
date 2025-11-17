/**
 * Shared upload handler used by Cloudflare Workers and Pages Functions.
 * Persists uploaded swing videos to an R2 bucket and records submitted metadata.
 * Expects the following bindings in env:
 *   - VIDEO_UPLOADS (R2 bucket binding)
 *   - UPLOAD_MAX_MB (optional string/number override)
 *   - UPLOAD_WEBHOOK_URL (optional POST webhook notified on success)
 *   - UPLOAD_ALLOWED_TYPES (optional comma-separated MIME list)
 */

const DEFAULT_MAX_BYTES = 300 * 1024 * 1024; // 300 MB
const DEFAULT_ALLOWED_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/mov',
  'video/x-m4v'
];
const DEFAULT_SIGNED_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function handleUploadRequest(request, env, opts = {}) {
  if (!env || typeof env !== 'object') {
    return jsonResponse({ error: 'missing_env' }, 500, opts.corsHeaders);
  }

  const bucket = env.VIDEO_UPLOADS;
  if (!bucket || typeof bucket.put !== 'function') {
    return jsonResponse({ error: 'unconfigured_bucket' }, 500, opts.corsHeaders);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, opts.corsHeaders);
  }

  const form = await parseFormData(request);
  if (form.error) {
    return jsonResponse(form.error, form.status, opts.corsHeaders);
  }

  const {
    file,
    fields,
  } = form;

  const allowedTypes = resolveAllowedTypes(env.UPLOAD_ALLOWED_TYPES);
  if (file.type && !isAllowedType(file.type, allowedTypes)) {
    return jsonResponse({ error: 'unsupported_type', allowed: allowedTypes }, 415, opts.corsHeaders);
  }

  const maxBytes = resolveMaxBytes(env.UPLOAD_MAX_MB);
  if (file.size > maxBytes) {
    return jsonResponse({ error: 'file_too_large', maxBytes }, 413, opts.corsHeaders);
  }

  const keyBase = buildObjectKey(fields, file.name);
  const videoKey = `videos/${keyBase}`;
  const metaKey = `videos/${keyBase}.json`;

  try {
    await bucket.put(videoKey, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: safeMetadata(fields),
    });

    await bucket.put(metaKey, JSON.stringify({
      ...fields,
      originalFileName: file.name,
      storedAt: new Date().toISOString(),
      size: file.size,
      contentType: file.type || 'application/octet-stream',
    }), {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
      },
    });
  } catch (err) {
    return jsonResponse({ error: 'storage_write_failed', message: sanitizeError(err) }, 500, opts.corsHeaders);
  }

  const signedLinks = await createSignedUrls(bucket, videoKey, metaKey, env);
  const payload = {
    ...fields,
    objectKey: videoKey,
    metadataKey: metaKey,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
    signedVideoUrl: signedLinks.videoUrl,
    signedMetadataUrl: signedLinks.metadataUrl,
    signedUrlExpiresAt: signedLinks.expiresAt,
    signedUrlTtlSeconds: signedLinks.ttlSeconds,
  };

  await notifyWebhook(env.UPLOAD_WEBHOOK_URL, payload);
  await notifyEmail(env, payload);

  return jsonResponse({
    ok: true,
    objectKey: videoKey,
  }, 201, opts.corsHeaders);
}

async function parseFormData(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('video');
    if (!file || typeof file !== 'object' || typeof file.stream !== 'function') {
      return { error: { error: 'missing_video' }, status: 400 };
    }
    const requiredFields = ['name', 'email'];
    const fields = {};
    for (const key of formData.keys()) {
      if (key === 'video') continue;
      const value = formData.get(key);
      if (typeof value === 'string') {
        fields[key] = value.trim();
      }
    }
    for (const rf of requiredFields) {
      if (!fields[rf]) {
        return { error: { error: 'missing_field', field: rf }, status: 400 };
      }
    }
    return { file, fields };
  } catch (err) {
    return { error: { error: 'invalid_form', message: String(err) }, status: 400 };
  }
}

function resolveMaxBytes(value) {
  if (!value) return DEFAULT_MAX_BYTES;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_MAX_BYTES;
  return num * 1024 * 1024;
}

function buildObjectKey(fields, originalName = '') {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = slugify(fields.name || 'client');
  const ext = extractExtension(originalName);
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(16).slice(2, 10);
  return `${ts}_${safeName}_${random}${ext}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'client';
}

function extractExtension(name) {
  if (!name) return '';
  const idx = String(name).lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  const ext = name.slice(idx).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext.length <= 8 ? ext : '';
}

function safeMetadata(fields) {
  const out = {};
  const keys = Object.keys(fields || {});
  for (const key of keys) {
    const value = fields[key];
    if (value && value.length <= 1024) {
      out[key] = value;
    }
  }
  return out;
}

async function notifyWebhook(url, payload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'golfmax_remote_fitting_upload',
        ...payload,
      }),
    });
  } catch {
    // Best-effort notification; ignore errors
  }
}

export function jsonResponse(body, status = 200, corsHeaders) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
  if (corsHeaders && typeof corsHeaders === 'object') {
    Object.assign(headers, corsHeaders);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

async function notifyEmail(env, payload) {
  const apiKey = env.SENDGRID_API_KEY;
  const recipients = parseRecipientList(env.UPLOAD_NOTIFY_TO);
  if (!apiKey || !recipients.length) return;

  const from = env.UPLOAD_NOTIFY_FROM || recipients[0];
  const fromName = env.UPLOAD_NOTIFY_FROM_NAME || 'GolfMax Remote Fitting';
  const subject = env.UPLOAD_NOTIFY_SUBJECT || 'New GolfMax remote fitting submission';
  const text = buildEmailBody(payload);

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map(email => ({ email })) }],
        from: { email: from, name: fromName },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
    if (!res.ok) {
      console.error('SendGrid email failed', res.status);
    }
  } catch (err) {
    console.error('SendGrid email error', err);
  }
}

function buildEmailBody(payload) {
  const parts = [
    'A new remote fitting intake has been submitted.\n',
    `Name: ${payload.name || 'N/A'}`,
    `Email: ${payload.email || 'N/A'}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.handicap ? `Handicap: ${payload.handicap}` : null,
    payload['preferred-contact'] ? `Preferred follow-up: ${payload['preferred-contact']}` : null,
    payload['launch-monitor'] ? `Launch monitor: ${payload['launch-monitor']}` : null,
    payload['current-clubs'] ? `Current clubs:\n${payload['current-clubs']}` : null,
    payload.goals ? `Goals:\n${payload.goals}` : null,
    '',
    `Stored video key: ${payload.objectKey || 'unknown'}`,
    payload.metadataKey ? `Metadata key: ${payload.metadataKey}` : null,
    `Video size: ${formatBytes(payload.size)}`,
    `Content-Type: ${payload.contentType || 'unknown'}`,
    payload.signedVideoUrl ? `Download video: ${payload.signedVideoUrl}` : null,
    payload.signedMetadataUrl ? `Download metadata: ${payload.signedMetadataUrl}` : null,
    payload.signedUrlExpiresAt ? `Signed links expire: ${formatExpiry(payload.signedUrlExpiresAt, payload.signedUrlTtlSeconds)}` : null,
    '',
    'Retrieve the file from your R2 bucket or connected storage.',
  ].filter(Boolean);
  return parts.join('\n');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown';
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return `${bytes} B`;
}

function resolveAllowedTypes(value) {
  if (!value) return DEFAULT_ALLOWED_TYPES;
  if (Array.isArray(value)) return value;
  const entries = String(value)
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  return entries.length ? entries : DEFAULT_ALLOWED_TYPES;
}

function isAllowedType(type, allowed) {
  const normalized = String(type || '').toLowerCase();
  if (!normalized) return true; // allow when type missing (e.g., iOS)
  return allowed.includes(normalized);
}

function sanitizeError(err) {
  if (!err) return undefined;
  if (typeof err === 'string') return err.slice(0, 160);
  if (err?.message) return String(err.message).slice(0, 160);
  return String(err).slice(0, 160);
}

async function createSignedUrls(bucket, videoKey, metaKey, env) {
  if (!bucket || typeof bucket.createSignedUrl !== 'function') return {};
  const ttlSeconds = resolveSignedUrlTtl(env && env.UPLOAD_NOTIFY_LINK_TTL);
  try {
    const [videoSigned, metaSigned] = await Promise.all([
      bucket.createSignedUrl({ key: videoKey, expiration: ttlSeconds, method: 'GET' }),
      bucket.createSignedUrl({ key: metaKey, expiration: ttlSeconds, method: 'GET' }),
    ]);
    const videoUrl = extractSignedUrl(videoSigned);
    const metadataUrl = extractSignedUrl(metaSigned);
    if (!videoUrl && !metadataUrl) return {};
    return {
      videoUrl,
      metadataUrl,
      ttlSeconds,
      expiresAt: extractSignedExpiration(videoSigned) || extractSignedExpiration(metaSigned) || new Date(Date.now() + (ttlSeconds * 1000)).toISOString(),
    };
  } catch (err) {
    console.error('Signed URL generation failed', err);
    return {};
  }
}

function extractSignedUrl(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.url === 'string') return value.url;
  return undefined;
}

function extractSignedExpiration(value) {
  if (!value || typeof value !== 'object') return undefined;
  const expiration = value.expiration || value.expiresAt || value.expires || value.expireAt;
  if (!expiration) return undefined;
  if (expiration instanceof Date) return expiration.toISOString();
  if (typeof expiration === 'number' && Number.isFinite(expiration)) {
    const ms = expiration > 1e12 ? expiration : expiration * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof expiration === 'string') {
    const dt = new Date(expiration);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  return undefined;
}

function resolveSignedUrlTtl(value) {
  const fallback = DEFAULT_SIGNED_TTL_SECONDS;
  if (!value) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 300) return fallback;
  const capped = Math.min(num, 7 * 24 * 60 * 60);
  return Math.max(300, Math.floor(capped));
}

function parseRecipientList(value) {
  if (!value) return [];
  const entries = Array.isArray(value)
    ? value
    : String(value)
        .split(/[,;\s]+/)
        .map(v => v.trim());
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    if (!entry || !entry.includes('@')) continue;
    const lower = entry.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(entry);
  }
  return out;
}

function formatExpiry(expiresAtIso, ttlSeconds) {
  if (!expiresAtIso) return 'unknown';
  try {
    const date = new Date(expiresAtIso);
    if (Number.isNaN(date.getTime())) return 'unknown';
    const stamp = date.toISOString().replace('T', ' ').replace('Z', ' UTC');
    if (!Number.isFinite(ttlSeconds)) return stamp;
    const hours = (ttlSeconds / 3600);
    const rounded = hours >= 10 ? Math.round(hours) : Number(hours.toFixed(1));
    return `${stamp} (~${rounded} hours)`;
  } catch {
    return 'unknown';
  }
}
