// Resolve a journal slug for the shared article-detail route before rendering.
(() => {
  const params = new URLSearchParams(location.search);
  const requested = params.get('slug');
  const articles = window.BILAFORM_ARTICLES || [];
  const article = articles.find((item) => item.slug === requested) || articles.find((item) => item.popular) || articles[0];
  if (article) document.body.dataset.articleSlug = article.slug;
})();
