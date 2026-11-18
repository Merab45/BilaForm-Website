// After deploying the API, replace the empty value with its HTTPS origin.
// Example: 'https://api.your-domain.example' (the frontend appends /api).
window.BILAFORM_API_BASE_URL = window.BILAFORM_API_BASE_URL || '';
(() => {
  const configuredHost = typeof window.BILAFORM_API_BASE_URL === 'string'
    ? window.BILAFORM_API_BASE_URL.trim().replace(/\/+$/, '') : '';
  const isLocalPreview = location.port !== '8000'
    && ['localhost', '127.0.0.1'].includes(location.hostname);
  const isGitHubPages = location.hostname === 'merab45.github.io';
  const localApi = 'http://127.0.0.1:8000/api';
  const fallback = isLocalPreview ? localApi : '/api';
  window.BILAFORM_API_ROOT = configuredHost
    ? `${configuredHost.replace(/\/api$/i, '')}/api`
    : fallback;
  window.BILAFORM_API_CONFIG_ERROR = isGitHubPages && !configuredHost
    ? 'BilaForm accounts are not connected to an API server yet. Configure the deployed API host to enable login and registration.'
    : '';
})();
