// Render the manually curated popular reads on the landing page.
(() => {
  const container = document.querySelector('[data-home-articles]');
  if (!container || !Array.isArray(window.BILAFORM_ARTICLES)) return;

  const popular = window.BILAFORM_ARTICLES.filter((article) => article.popular).slice(0, 4);
  const dateLabel = (value) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

  container.innerHTML = popular.map((article) => `
    <article class="journal-card">
      <a class="journal-card-image" href="blog/articles/${article.slug}.html" aria-label="Read ${article.title}">
        <img src="${article.image}" alt="${article.alt}" loading="lazy" width="900" height="560">
      </a>
      <div class="journal-card-body">
        <div class="journal-card-meta"><span>${article.category}</span><span>${article.minutes} min read</span></div>
        <h3><a href="blog/articles/${article.slug}.html">${article.title}</a></h3>
        <p>${article.excerpt}</p>
        <div class="journal-card-bottom"><time datetime="${article.date}">${dateLabel(article.date)}</time><a href="blog/articles/${article.slug}.html">Read article <span aria-hidden="true">→</span></a></div>
      </div>
    </article>`).join('');
})();
