(function () {
    const TRACK_EVENT = 'gm-form-success';

    function noop() {}

    window.GM_TRACK = window.GM_TRACK || noop;

    async function init() {
        try {
            if (window.GM_CONFIG_READY) {
                await window.GM_CONFIG_READY;
            }
        } catch (err) {
            console.error('GM_CONFIG_READY failed', err);
        }

        const measurementId = resolveMeasurementId();
        if (!measurementId) {
            return;
        }

        bootstrapGA(measurementId);
        wireEventTracking();
    }

    function resolveMeasurementId() {
        const candidates = [
            window.GA_MEASUREMENT_ID,
            window.GM_GA_MEASUREMENT_ID,
            window.GM_GA4_ID,
            window.GM_ANALYTICS_ID,
        ];
        for (const id of candidates) {
            if (id && typeof id === 'string' && id.startsWith('G-')) {
                return id;
            }
        }
        return '';
    }

    function bootstrapGA(measurementId) {
        if (!document || document.getElementById('gm-ga4-script')) return;

        window.dataLayer = window.dataLayer || [];
        window.gtag =
            window.gtag ||
            function gtag() {
                window.dataLayer.push(arguments);
            };

        const script = document.createElement('script');
        script.id = 'gm-ga4-script';
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);

        window.gtag('js', new Date());
        window.gtag('config', measurementId, { send_page_view: true });

        window.GM_TRACK = function track(eventName, params) {
            if (typeof window.gtag === 'function') {
                window.gtag('event', eventName, params || {});
            }
        };
    }

    function wireEventTracking() {
        if (typeof document === 'undefined') return;

        const ctas = document.querySelectorAll('[data-analytics="cta-start"]');
        ctas.forEach((el) => {
            el.addEventListener(
                'click',
                () => {
                    window.GM_TRACK('select_content', {
                        content_type: 'cta',
                        item_id: 'start_free_fitting',
                        location: el.dataset.analyticsLocation || inferLocation(el),
                    });
                },
                { passive: true }
            );
        });

        window.addEventListener(TRACK_EVENT, () => {
            window.GM_TRACK('generate_lead', { method: 'remote_fitting_form' });
        });
    }

    function inferLocation(element) {
        if (!element) return 'unknown';
        const section = element.closest('section');
        return section && section.id ? section.id : 'unknown';
    }

    init();
})();
