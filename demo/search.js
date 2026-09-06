/**
 * Amazon Demo E-Commerce Search Controller
 * Provides real-time and form-submitted product search, category filtering,
 * URL query persistence, no-results suggestions, and cross-page search routing.
 */

(() => {
  function initSearch() {
    const searchForm = document.querySelector('.nav-search');
    const searchInput = document.querySelector('.search-input');
    const categorySelect = document.querySelector('.search-category-select');
    const searchButton = document.querySelector('.search-button');
    const showcaseGrid = document.querySelector('.product-showcase-grid');
    const isShowcasePage = !!showcaseGrid;

    if (!searchInput) return;

    // 1. Create or get Search Results Bar (on index.html)
    let resultsBar = document.getElementById('search-results-bar');
    let noResultsBox = document.getElementById('no-results-box');

    if (isShowcasePage && !resultsBar) {
      resultsBar = document.createElement('div');
      resultsBar.id = 'search-results-bar';
      resultsBar.className = 'search-results-banner';
      resultsBar.style.display = 'none';
      showcaseGrid.parentNode.insertBefore(resultsBar, showcaseGrid);
    }

    if (isShowcasePage && !noResultsBox) {
      noResultsBox = document.createElement('div');
      noResultsBox.id = 'no-results-box';
      noResultsBox.className = 'no-results-card';
      noResultsBox.style.display = 'none';
      noResultsBox.innerHTML = `
        <div class="no-results-icon">&#128269;</div>
        <h3>No matching products found</h3>
        <p>We couldn't find any products matching your search. Try checking your spelling or explore popular categories:</p>
        <div class="suggestion-chips">
          <button type="button" class="search-chip" data-query="MacBook">MacBook Pro</button>
          <button type="button" class="search-chip" data-query="iPhone 16">iPhone 16 Pro</button>
          <button type="button" class="search-chip" data-query="Sony Headphones">Sony Headphones</button>
          <button type="button" class="search-chip" data-query="Apple Watch">Apple Watch Ultra</button>
          <button type="button" class="search-chip" data-query="Samsung">Samsung 4K Display</button>
          <button type="button" class="search-chip" data-query="Keyboard">Keychron Keyboard</button>
          <button type="button" class="search-chip" id="btn-view-all" style="background:#FEBD69; border-color:#A88734; color:#111; font-weight:700;">Show All Products</button>
        </div>
      `;
      showcaseGrid.parentNode.insertBefore(noResultsBox, showcaseGrid.nextSibling);

      // Attach clicks to suggestion chips
      noResultsBox.querySelectorAll('.search-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          if (chip.id === 'btn-view-all') {
            searchInput.value = '';
            if (categorySelect) categorySelect.value = 'All Products';
            executeSearch();
          } else {
            const q = chip.getAttribute('data-query');
            searchInput.value = q;
            if (categorySelect) categorySelect.value = 'All Products';
            executeSearch();
          }
        });
      });
    }

    // 2. Main Filter Function (executed on index.html)
    function filterProducts(query = '', category = 'All Products') {
      if (!isShowcasePage) return;

      const normalizedQuery = query.trim().toLowerCase();
      const normalizedCat = category.trim().toLowerCase();
      const cards = Array.from(showcaseGrid.querySelectorAll('.showcase-card'));

      let matchCount = 0;

      cards.forEach(card => {
        const title = (card.querySelector('h2')?.textContent || '').toLowerCase();
        const desc = (card.querySelector('p')?.textContent || '').toLowerCase();
        const price = (card.querySelector('.card-price')?.textContent || '').toLowerCase();
        const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
        const keywords = (card.getAttribute('data-keywords') || '').toLowerCase();

        const fullCardText = `${title} ${desc} ${price} ${cardCat} ${keywords}`;

        // Check category match
        let categoryMatches = true;
        if (normalizedCat !== 'all products' && normalizedCat !== 'all' && normalizedCat !== 'all departments') {
          if (normalizedCat.includes('computer')) {
            categoryMatches = cardCat.includes('computer') || cardCat.includes('laptop') || cardCat.includes('monitor') || cardCat.includes('keyboard');
          } else if (normalizedCat.includes('smartphones') || normalizedCat.includes('phone')) {
            categoryMatches = cardCat.includes('phone') || cardCat.includes('smartphone');
          } else if (normalizedCat.includes('audio') || normalizedCat.includes('wearable')) {
            categoryMatches = cardCat.includes('audio') || cardCat.includes('headphone') || cardCat.includes('watch') || cardCat.includes('wearable');
          } else {
            categoryMatches = fullCardText.includes(normalizedCat);
          }
        }

        // Check search query match
        let queryMatches = true;
        if (normalizedQuery) {
          const terms = normalizedQuery.split(/\s+/).filter(Boolean);
          queryMatches = terms.every(term => fullCardText.includes(term));
        }

        if (categoryMatches && queryMatches) {
          card.style.display = 'flex';
          matchCount++;
        } else {
          card.style.display = 'none';
        }
      });

      // Update Results Bar & No Results Box
      if (normalizedQuery || (normalizedCat !== 'all products' && normalizedCat !== 'all' && normalizedCat !== 'all departments')) {
        resultsBar.style.display = 'flex';
        const queryDisplay = normalizedQuery ? ` for "<strong>${escapeHtml(query.trim())}</strong>"` : '';
        const catDisplay = (normalizedCat !== 'all products' && normalizedCat !== 'all' && normalizedCat !== 'all departments') ? ` in <em>${category}</em>` : '';

        resultsBar.innerHTML = `
          <span>Showing 1-${matchCount} of ${matchCount} results${queryDisplay}${catDisplay}</span>
          <button type="button" class="btn-clear-filter" id="btn-clear-filter">&#10005; Clear Filter</button>
        `;

        const btnClear = resultsBar.querySelector('#btn-clear-filter');
        if (btnClear) {
          btnClear.addEventListener('click', () => {
            searchInput.value = '';
            if (categorySelect) categorySelect.value = 'All Products';
            filterProducts('', 'All Products');
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('q');
              url.searchParams.delete('category');
              window.history.replaceState(null, '', url.pathname);
            } catch (_) {}
          });
        }
      } else {
        resultsBar.style.display = 'none';
      }

      if (matchCount === 0) {
        showcaseGrid.style.display = 'none';
        noResultsBox.style.display = 'block';
        const queryText = noResultsBox.querySelector('h3');
        if (queryText) {
          queryText.innerHTML = `No results found for "${escapeHtml(query.trim() || category)}"`;
        }
      } else {
        showcaseGrid.style.display = 'grid';
        noResultsBox.style.display = 'none';
      }
    }

    function executeSearch() {
      const query = searchInput.value.trim();
      const cat = categorySelect ? categorySelect.value : 'All Products';

      if (isShowcasePage) {
        filterProducts(query, cat);
        try {
          const url = new URL(window.location.href);
          if (query) url.searchParams.set('q', query);
          else url.searchParams.delete('q');
          if (cat && cat !== 'All Products' && cat !== 'All Departments') url.searchParams.set('category', cat);
          else url.searchParams.delete('category');
          window.history.replaceState(null, '', url.toString());
        } catch (_) {}
      } else {
        // Navigate to index.html with parameters
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (cat && cat !== 'All Products' && cat !== 'All Departments') params.set('category', cat);
        window.location.href = `index.html?${params.toString()}`;
      }
    }

    // 3. Event Listeners
    if (searchButton) {
      searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        executeSearch();
      });
    }

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch();
      }
    });

    // Real-time live filtering on index.html with debounce
    if (isShowcasePage) {
      let debounceTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const query = searchInput.value;
          const cat = categorySelect ? categorySelect.value : 'All Products';
          filterProducts(query, cat);
        }, 180);
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener('change', () => {
        executeSearch();
      });
    }

    // 4. Subnav link filters on index.html
    if (isShowcasePage) {
      const subnavLinks = document.querySelectorAll('.nav-main a');
      subnavLinks.forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        if (text.includes('laptops') || text.includes('smartphones') || text.includes('audio') || text.includes('all products')) {
          link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === 'index.html') {
              e.preventDefault();
              subnavLinks.forEach(l => l.classList.remove('active'));
              link.classList.add('active');

              if (text.includes('all products')) {
                searchInput.value = '';
                if (categorySelect) categorySelect.value = 'All Products';
                filterProducts('', 'All Products');
              } else if (text.includes('laptops')) {
                if (categorySelect) categorySelect.value = 'Computers';
                filterProducts(searchInput.value, 'Computers');
              } else if (text.includes('smartphones')) {
                if (categorySelect) categorySelect.value = 'Smartphones';
                filterProducts(searchInput.value, 'Smartphones');
              } else if (text.includes('audio')) {
                if (categorySelect) categorySelect.value = 'Audio';
                filterProducts(searchInput.value, 'Audio');
              }
            }
          });
        }
      });
    }

    // 5. Initialize from URL Query Params
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const initialQuery = urlParams.get('q');
      const initialCat = urlParams.get('category');

      if (initialQuery || initialCat) {
        if (initialQuery) searchInput.value = initialQuery;
        if (initialCat && categorySelect) {
          Array.from(categorySelect.options).forEach(opt => {
            if (opt.value.toLowerCase() === initialCat.toLowerCase() || opt.text.toLowerCase() === initialCat.toLowerCase()) {
              categorySelect.value = opt.value;
            }
          });
        }
        if (isShowcasePage) {
          filterProducts(searchInput.value, categorySelect ? categorySelect.value : 'All Products');
        }
      }
    } catch (_) {}
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initSearch();
    } else {
      document.addEventListener('DOMContentLoaded', initSearch);
      setTimeout(initSearch, 20);
    }
  }
})();
