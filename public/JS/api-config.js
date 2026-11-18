// For GitHub Pages, set this to the deployed API host before the /api path.
// Example: window.BILAFORM_API_BASE_URL = 'https://api.your-domain.example';
(() => {
  const configuredHost = typeof window.BILAFORM_API_BASE_URL === 'string'
    ? window.BILAFORM_API_BASE_URL.trim().replace(/\/+$/, '') : '';
  const isLocalPreview = ['5500', '5501'].includes(location.port)
    && ['localhost', '127.0.0.1'].includes(location.hostname);
  const localApi = 'http://127.0.0.1:8000/api';
  const fallback = isLocalPreview ? localApi : '/api';
  window.BILAFORM_API_ROOT = configuredHost
    ? `${configuredHost.replace(/\/api$/i, '')}/api`
    : fallback;
})();
