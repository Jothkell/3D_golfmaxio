(function () {
    const form = document.querySelector('.remote-fitting-form');
    if (!form) return;

    const endpoint = (window.GM_UPLOAD_ENDPOINT && window.GM_UPLOAD_ENDPOINT !== '#')
        ? window.GM_UPLOAD_ENDPOINT
        : '/api/upload';
    const statusEl = form.querySelector('[data-form-status]');
    const progressWrap = form.querySelector('[data-upload-progress]');
    const progressBar = progressWrap ? progressWrap.querySelector('progress') : null;
    const progressText = progressWrap ? progressWrap.querySelector('[data-progress-text]') : null;
    const submitBtn = form.querySelector('button[type="submit"]');
    const fileInput = form.querySelector('#video');
    const fileNameEl = form.querySelector('[data-upload-filename]');
    const maxBytes = 300 * 1024 * 1024; // 300 MB hard cap client-side
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/mov', 'video/webm', 'video/x-m4v'];

    function resetProgress() {
        if (progressWrap) progressWrap.classList.remove('on');
        if (progressBar) progressBar.value = 0;
        if (progressText) progressText.textContent = '';
    }

    function setStatus(type, message) {
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.classList.remove('success', 'error', 'info');
        if (type) statusEl.classList.add(type);
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return '';
        if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
        return bytes + ' B';
    }

    function validateFile(file) {
        if (!file) {
            setStatus('error', 'Please choose a swing video to upload.');
            return false;
        }
        if (file.size > maxBytes) {
            setStatus('error', `Video is too large. Please keep it under ${formatBytes(maxBytes)}.`);
            return false;
        }
        if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
            setStatus('error', 'Unsupported file type. Upload an MP4, MOV, or WebM video.');
            return false;
        }
        return true;
    }

    function updateFileLabel() {
        if (!fileInput || !fileInput.files || !fileNameEl) return;
        const [file] = fileInput.files;
        if (!file) {
            fileNameEl.textContent = 'Choose Video File';
            return;
        }
        fileNameEl.textContent = `${file.name} • ${formatBytes(file.size)}`;
        setStatus('info', 'Ready to upload. Submit the form when finished.');
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            updateFileLabel();
            resetProgress();
        });
    }

    async function submitForm(event) {
        event.preventDefault();
        resetProgress();
        if (!submitBtn) return;

        if (endpoint === '#') {
            setStatus('error', 'Uploads are disabled in local preview. Please deploy the upload worker before testing.');
            return;
        }

        const formData = new FormData(form);
        const video = fileInput ? fileInput.files[0] : null;
        if (!validateFile(video)) return;

        submitBtn.disabled = true;
        form.classList.add('is-uploading');
        setStatus('info', 'Uploading your swing video…');

        try {
            const response = await sendWithProgress(endpoint, formData);
            if (!response.ok) {
                const reason = response.error || 'Upload failed. Please try again.';
                throw new Error(reason);
            }
            form.reset();
            updateFileLabel();
            setStatus('success', 'Thanks! Your swing video and fitting details are on their way. We\'ll reach out within one business day.');
        } catch (err) {
            setStatus('error', err.message || 'Upload failed. Please try again.');
        } finally {
            submitBtn.disabled = false;
            form.classList.remove('is-uploading');
            if (progressWrap) progressWrap.classList.remove('on');
        }
    }

    function sendWithProgress(url, formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.responseType = 'json';

            xhr.upload.onprogress = (evt) => {
                if (!evt.lengthComputable || !progressWrap || !progressBar) return;
                const percent = Math.round((evt.loaded / evt.total) * 100);
                progressWrap.classList.add('on');
                progressBar.value = percent;
                if (progressText) progressText.textContent = `${percent}%`;
            };

            xhr.onerror = () => reject(new Error('Network error while uploading.'));
            xhr.ontimeout = () => reject(new Error('Upload timed out. Please check your connection and try again.'));

            xhr.onload = () => {
                const status = xhr.status;
                const body = xhr.response || {};
                if (status >= 200 && status < 300 && body.ok) {
                    resolve(body);
                } else {
                    resolve({
                        ok: false,
                        error: body.error || `Upload failed with status ${status}`,
                    });
                }
            };

            xhr.send(formData);
        });
    }

    form.addEventListener('submit', submitForm);
})();
