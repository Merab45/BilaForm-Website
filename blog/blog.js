// Filter, search and paginate the curated article collection without dependencies.
(() => {
  const articles = window.BILAFORM_ARTICLES || [];
  const featured = articles.find((article) => article.featured) || articles.find((article) => article.popular);
  const popular = articles.filter((article) => article.popular);
  const featuredRoot = document.querySelector('[data-featured-article]');
  const popularRoot = document.querySelector('[data-popular-articles]');
  const listRoot = document.querySelector('[data-article-list]');
  const filterRoot = document.querySelector('[data-category-filters]');
  if (!listRoot || !filterRoot) return;
  const categories = ['All topics', ...new Set(articles.map((item) => item.category))];
  let category = 'All topics'; let query = ''; let visible = 6;
  const dateText = (value) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-KE', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const path = (article) => `articles/${article.slug}.html`;
  const card = (article) => `<article class="journal-card"><a class="journal-card-image" href="${path(article)}"><img src="../${article.image}" alt="${article.alt}" loading="lazy" width="900" height="560"></a><div class="journal-card-body"><div class="journal-card-meta"><span>${article.category}</span><span>${article.minutes} min read</span></div><h3><a href="${path(article)}">${article.title}</a></h3><p>${article.excerpt}</p><div class="journal-card-bottom"><time datetime="${article.date}">${dateText(article.date)}</time><a href="${path(article)}">Read article <span aria-hidden="true">→</span></a></div></div></article>`;
  if (featuredRoot && featured) featuredRoot.innerHTML = `<a class="journal-featured-image" href="${path(featured)}"><img src="../${featured.image}" alt="${featured.alt}" width="900" height="600"></a><div class="journal-featured-copy"><div class="journal-card-meta journal-featured-meta"><span>${featured.category}</span><span>${featured.minutes} min read</span></div><h2><a href="${path(featured)}">${featured.title}</a></h2><p>${featured.excerpt}</p><time datetime="${featured.date}">${dateText(featured.date)}</time><br><a class="journal-read-link" href="${path(featured)}">Read the featured article <span aria-hidden="true">→</span></a></div>`;
  if (popularRoot) popularRoot.innerHTML = popular.slice(0, 3).map(card).join('');
  filterRoot.innerHTML = categories.map((name, i) => `<button class="journal-filter" type="button" data-category="${name}" aria-pressed="${i === 0}">${name}</button>`).join('');
  const searchInput = document.querySelector('#article-search');
  const count = document.querySelector('[data-results-count]');
  const more = document.querySelector('[data-load-more]');
  function render() {
    const results = articles.filter((item) => (category === 'All topics' || item.category === category) && (!query || `${item.title} ${item.excerpt} ${item.category} ${item.sections.map((s) => s.join(' ')).join(' ')}`.toLowerCase().includes(query)));
    listRoot.innerHTML = results.length ? results.slice(0, visible).map(card).join('') : '<p class="journal-empty">No articles match that search. Try another phrase or topic.</p>';
    if (count) count.textContent = `${results.length} ${results.length === 1 ? 'article' : 'articles'}`;
    if (more) more.hidden = results.length <= visible;
    const schema = document.querySelector('#journal-list-schema');
    if (schema) schema.textContent = JSON.stringify({'@context':'https://schema.org','@type':'ItemList','itemListElement':articles.map((item,i)=>({'@type':'ListItem',position:i+1,url:`https://merab45.github.io/BilaForm-Website/blog/${path(item)}`,name:item.title}))});
  }
  filterRoot.addEventListener('click', (event) => {const button = event.target.closest('[data-category]'); if (!button) return; category = button.dataset.category; visible = 6; filterRoot.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); render();});
  searchInput?.addEventListener('input', () => {query = searchInput.value.trim().toLowerCase(); visible = 6; render();});
  more?.addEventListener('click', () => {visible += 6; render();});
  render();
})();
