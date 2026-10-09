/**
 * PARA CHAÏMAA - PARAPHARMACIE (Sté SAGFARMA)
 * Modern E-Commerce Client Application Logic
 */

// Application State
const state = {
  products: [],
  categories: [],
  brands: [],
  cart: JSON.parse(localStorage.getItem('para_cart') || '[]'),
  wishlist: JSON.parse(localStorage.getItem('para_wishlist') || '[]'),
  activeCategory: 'all',
  activeBrand: 'all',
  activeSort: 'popular',
  searchQuery: '',
  appliedCoupon: null,
  activeProductModal: null,
  quizAnswers: { skin_type: 'mixte', concern: 'acne' }
};

// Moroccan Cities for delivery selection
const MOROCCAN_CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Tanger", "Fès", "Agadir", "Meknès", 
  "Oujda", "Kénitra", "Tétouan", "Salé", "Mohammédia", "El Jadida", "Nador", 
  "Béni Mellal", "Khouribga", "Safi", "Témara", "Dakhla", "Laâyoune"
];

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initCategories();
  loadProducts();
  updateCartBadge();
  updateWishlistBadge();
  initFlashTimer();
  initCityDropdown();
  setupEventListeners();
});

// Save to LocalStorage
function saveCart() {
  localStorage.setItem('para_cart', JSON.stringify(state.cart));
  updateCartBadge();
  renderCartDrawer();
}

function saveWishlist() {
  localStorage.setItem('para_wishlist', JSON.stringify(state.wishlist));
  updateWishlistBadge();
}

// ----------------- DATA FETCHING -----------------

async function initCategories() {
  try {
    const res = await fetch('/api/categories');
    state.categories = await res.json();
    renderCategoryPills();
  } catch (err) {
    console.error('Erreur chargement catégories:', err);
  }
}

async function loadProducts() {
  const container = document.getElementById('products-grid');
  if (!container) return;

  // Show skeleton loading
  container.innerHTML = Array(8).fill(0).map(() => `
    <div class="product-card animate-pulse p-4">
      <div class="w-full h-48 bg-gray-200 rounded-xl mb-4"></div>
      <div class="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
      <div class="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div class="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div class="h-10 bg-gray-200 rounded-full w-full"></div>
    </div>
  `).join('');

  try {
    let url = `/api/products?category=${encodeURIComponent(state.activeCategory)}&sort=${state.activeSort}`;
    if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;
    if (state.activeBrand !== 'all') url += `&brand=${encodeURIComponent(state.activeBrand)}`;

    const res = await fetch(url);
    const data = await res.json();
    state.products = data.products;
    state.brands = data.brands || [];

    renderProductsGrid();
    renderBrandFilterOptions();
  } catch (err) {
    console.error('Erreur chargement produits:', err);
    container.innerHTML = `<div class="col-span-full text-center py-12 text-red-600 font-medium">Erreur de chargement des produits. Veuillez rafraîchir.</div>`;
  }
}

// ----------------- RENDERING -----------------

function renderCategoryPills() {
  const container = document.getElementById('category-pills-container');
  if (!container) return;

  let html = `
    <button onclick="selectCategory('all')" class="category-pill ${state.activeCategory === 'all' ? 'active' : ''}">
      <span>✨ Tous les soins</span>
    </button>
  `;

  state.categories.forEach(cat => {
    const isActive = state.activeCategory === cat.id;
    html += `
      <button onclick="selectCategory('${cat.id}')" class="category-pill ${isActive ? 'active' : ''}">
        <span>${cat.name}</span>
        <span class="text-xs opacity-75">(${cat.product_count})</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function renderBrandFilterOptions() {
  const select = document.getElementById('brand-filter-select');
  if (!select) return;

  let options = `<option value="all">Toutes les marques</option>`;
  state.brands.forEach(b => {
    options += `<option value="${b}" ${state.activeBrand === b ? 'selected' : ''}>${b}</option>`;
  });
  select.innerHTML = options;
}

function renderProductsGrid() {
  const container = document.getElementById('products-grid');
  const countBadge = document.getElementById('products-count');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${state.products.length} soin(s) disponible(s)`;

  if (state.products.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-gray-100 p-8">
        <div class="w-16 h-16 mx-auto mb-4 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center text-2xl font-bold">🍃</div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">Aucun produit ne correspond à votre recherche</h3>
        <p class="text-gray-500 mb-6">Essayez d'ajuster vos filtres ou de chercher un autre mot-clé.</p>
        <button onclick="resetFilters()" class="btn-primary">Réinitialiser les filtres</button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.products.map(p => {
    const isWish = state.wishlist.includes(p.id);
    const discount = p.old_price ? Math.round(((p.old_price - p.price) / p.old_price) * 100) : 0;
    
    return `
      <div class="product-card group" data-id="${p.id}">
        <!-- Image & Badges -->
        <div class="product-image-container cursor-pointer" onclick="openProductModal(${p.id})">
          <img src="${p.image}" alt="${p.title}" class="product-image" loading="lazy" onerror="this.src='/static/images/logo.jpg'">
          
          ${p.badge ? `<span class="badge-tag ${p.badge.includes('%') || p.badge.includes('Promo') ? 'badge-promo' : 'badge-best'}">${p.badge}</span>` : ''}
          ${discount > 0 && !p.badge ? `<span class="badge-tag badge-promo">-${discount}%</span>` : ''}

          <button onclick="event.stopPropagation(); toggleWishlist(${p.id})" class="wishlist-btn ${isWish ? 'active' : ''}" title="Ajouter aux favoris">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span class="font-bold tracking-wider uppercase text-emerald-800">${p.brand}</span>
              <div class="flex items-center text-amber-500 gap-1">
                <span>★</span>
                <span class="font-semibold text-gray-700">${p.rating}</span>
                <span class="text-gray-400">(${p.reviews_count})</span>
              </div>
            </div>

            <h3 class="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-emerald-800 cursor-pointer transition mb-2" onclick="openProductModal(${p.id})">
              ${p.title}
            </h3>

            <p class="text-xs text-gray-500 line-clamp-1 mb-3">${p.skin_type || 'Tous types de peaux'}</p>
          </div>

          <div>
            <!-- Price Block -->
            <div class="flex items-baseline gap-2 mb-3">
              <span class="text-lg font-extrabold text-emerald-950">${p.price} DH</span>
              ${p.old_price ? `<span class="text-xs text-gray-400 line-through">${p.old_price} DH</span>` : ''}
              ${discount > 0 ? `<span class="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-${discount}%</span>` : ''}
            </div>

            <!-- Action Buttons -->
            <div class="grid grid-cols-2 gap-2">
              <button onclick="addToCart(${p.id})" class="btn-primary py-2 px-3 text-xs w-full">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                Panier
              </button>
              
              <button onclick="orderViaWhatsApp(${p.id})" class="btn-whatsapp py-2 px-2 text-xs w-full" title="Commander vite par WhatsApp">
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------- FILTERS & INTERACTION -----------------

function selectCategory(catId) {
  state.activeCategory = catId;
  renderCategoryPills();
  loadProducts();
}

function handleBrandChange(val) {
  state.activeBrand = val;
  loadProducts();
}

function handleSortChange(val) {
  state.activeSort = val;
  loadProducts();
}

function handleSearchInput(val) {
  state.searchQuery = val.trim();
  // Live autocomplete results dropdown
  showSearchAutocomplete(state.searchQuery);
}

function showSearchAutocomplete(query) {
  const dropdown = document.getElementById('search-autocomplete');
  if (!dropdown) return;

  if (query.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }

  const matches = state.products.filter(p => 
    p.title.toLowerCase().includes(query.toLowerCase()) || 
    p.brand.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  if (matches.length === 0) {
    dropdown.innerHTML = `<div class="p-3 text-sm text-gray-500 text-center">Aucun soin trouvé pour "${query}"</div>`;
  } else {
    dropdown.innerHTML = matches.map(p => `
      <div onclick="openProductModal(${p.id}); document.getElementById('search-autocomplete').classList.add('hidden')" class="p-3 hover:bg-emerald-50 flex items-center gap-3 cursor-pointer border-b border-gray-100 last:border-none transition">
        <img src="${p.image}" class="w-10 h-10 object-cover rounded-lg" alt="${p.title}">
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-emerald-800">${p.brand}</div>
          <div class="text-sm font-medium text-gray-900 truncate">${p.title}</div>
          <div class="text-xs font-bold text-gray-700">${p.price} DH</div>
        </div>
      </div>
    `).join('');
  }
  dropdown.classList.remove('hidden');
}

function executeSearch() {
  const input = document.getElementById('main-search-input');
  if (input) state.searchQuery = input.value.trim();
  const dropdown = document.getElementById('search-autocomplete');
  if (dropdown) dropdown.classList.add('hidden');
  loadProducts();
}

function resetFilters() {
  state.activeCategory = 'all';
  state.activeBrand = 'all';
  state.activeSort = 'popular';
  state.searchQuery = '';
  const searchInput = document.getElementById('main-search-input');
  if (searchInput) searchInput.value = '';
  renderCategoryPills();
  loadProducts();
}

// ----------------- CART SYSTEM -----------------

function addToCart(productId, qty = 1) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const existing = state.cart.find(it => it.id === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    state.cart.push({
      id: prod.id,
      title: prod.title,
      brand: prod.brand,
      price: prod.price,
      image: prod.image,
      quantity: qty
    });
  }

  saveCart();
  showToast(`✓ "${prod.title.substring(0, 28)}..." ajouté au panier !`, 'toast-success');
  openCartDrawer();
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(it => it.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(it => it.id !== productId);
  }
  saveCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(it => it.id !== productId);
  saveCart();
  showToast('Article retiré du panier.', 'toast-gold');
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById('cart-drawer').classList.add('active');
  document.getElementById('cart-backdrop').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  document.getElementById('cart-drawer').classList.remove('active');
  document.getElementById('cart-backdrop').classList.remove('active');
  document.body.style.overflow = 'auto';
}

function updateCartBadge() {
  const totalItems = state.cart.reduce((sum, it) => sum + it.quantity, 0);
  const badge = document.getElementById('cart-badge-count');
  if (badge) {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items-container');
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountRow = document.getElementById('cart-discount-row');
  const discountEl = document.getElementById('cart-discount');
  const shippingEl = document.getElementById('cart-shipping');
  const totalEl = document.getElementById('cart-total');
  const progressFill = document.getElementById('free-shipping-progress');
  const progressText = document.getElementById('free-shipping-text');

  if (!container) return;

  const subtotal = state.cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  
  // Free shipping progress logic (350 DH threshold)
  const freeThreshold = 350;
  const missingForFree = freeThreshold - subtotal;
  if (progressFill && progressText) {
    if (subtotal >= freeThreshold) {
      progressFill.style.width = '100%';
      progressText.innerHTML = `🎉 Félicitations ! Vous bénéficiez de la <strong>Livraison GRATUITE</strong> !`;
    } else {
      const pct = Math.min(100, (subtotal / freeThreshold) * 100);
      progressFill.style.width = `${pct}%`;
      progressText.innerHTML = `Ajoutez <strong>${missingForFree.toFixed(0)} DH</strong> supplémentaires pour la <strong>Livraison Gratuite</strong> !`;
    }
  }

  // Calculate discount
  let discountVal = 0;
  if (state.appliedCoupon) {
    if (state.appliedCoupon.type === 'percent') {
      discountVal = (subtotal * (state.appliedCoupon.value / 100));
    } else if (state.appliedCoupon.type === 'fixed') {
      discountVal = Math.min(state.appliedCoupon.value, subtotal);
    }
  }

  const shippingFee = subtotal >= freeThreshold || (state.appliedCoupon && state.appliedCoupon.type === 'shipping') ? 0 : 25;
  const finalTotal = Math.max(0, subtotal - discountVal + (subtotal > 0 ? shippingFee : 0));

  if (subtotalEl) subtotalEl.textContent = `${subtotal.toFixed(2)} DH`;
  if (shippingEl) shippingEl.textContent = shippingFee === 0 ? 'GRATUITE' : `${shippingFee} DH`;
  if (totalEl) totalEl.textContent = `${finalTotal.toFixed(2)} DH`;

  if (discountRow && discountEl) {
    if (discountVal > 0) {
      discountRow.classList.remove('hidden');
      discountEl.textContent = `-${discountVal.toFixed(2)} DH`;
    } else {
      discountRow.classList.add('hidden');
    }
  }

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4">
        <div class="w-16 h-16 mx-auto mb-3 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center text-2xl font-bold">🛒</div>
        <p class="text-gray-600 font-semibold mb-2">Votre panier est actuellement vide</p>
        <p class="text-xs text-gray-400 mb-6">Découvrez nos crèmes, sérums et protections solaires certifiés.</p>
        <button onclick="closeCartDrawer()" class="btn-primary text-sm py-2 px-6">Découvrir les produits</button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.cart.map(it => `
    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
      <img src="${it.image}" alt="${it.title}" class="w-16 h-16 object-cover rounded-lg bg-white p-1">
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-emerald-800 uppercase">${it.brand}</div>
        <h4 class="text-xs font-semibold text-gray-900 truncate mb-1">${it.title}</h4>
        <div class="text-xs font-extrabold text-emerald-950">${it.price} DH</div>
        
        <!-- Quantity Selector -->
        <div class="flex items-center gap-2 mt-2">
          <div class="flex items-center border border-gray-200 bg-white rounded-lg">
            <button onclick="updateCartQty(${it.id}, -1)" class="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold">-</button>
            <span class="w-6 text-center text-xs font-bold text-gray-800">${it.quantity}</span>
            <button onclick="updateCartQty(${it.id}, 1)" class="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold">+</button>
          </div>
          <button onclick="removeFromCart(${it.id})" class="text-xs text-red-500 hover:text-red-700 ml-auto flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ----------------- COUPONS -----------------

async function applyCoupon() {
  const input = document.getElementById('coupon-code-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  if (!code) {
    showToast('Veuillez entrer un code promo', 'toast-gold');
    return;
  }

  const subtotal = state.cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal })
    });
    const data = await res.json();

    if (data.valid) {
      state.appliedCoupon = data;
      showToast(`🎉 ${data.label}`, 'toast-success');
      renderCartDrawer();
    } else {
      showToast(data.message || 'Code promo invalide', 'toast-error');
    }
  } catch (err) {
    showToast('Erreur validation coupon', 'toast-error');
  }
}

// ----------------- WISHLIST -----------------

function toggleWishlist(productId) {
  const idx = state.wishlist.indexOf(productId);
  if (idx > -1) {
    state.wishlist.splice(idx, 1);
    showToast('Retiré de vos favoris.', 'toast-gold');
  } else {
    state.wishlist.push(productId);
    showToast('❤️ Ajouté à vos favoris !', 'toast-success');
  }
  saveWishlist();
  renderProductsGrid();
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlist-badge-count');
  if (badge) {
    badge.textContent = state.wishlist.length;
    badge.style.display = state.wishlist.length > 0 ? 'flex' : 'none';
  }
}

function openWishlistModal() {
  const modal = document.getElementById('wishlist-modal');
  const container = document.getElementById('wishlist-items-container');
  if (!modal || !container) return;

  const wishProducts = state.products.filter(p => state.wishlist.includes(p.id));

  if (wishProducts.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-4xl mb-3">🤍</div>
        <p class="text-gray-600 font-bold mb-1">Votre liste de favoris est vide</p>
        <p class="text-xs text-gray-400">Cliquez sur le cœur d'un produit pour le retrouver ici facilement.</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${wishProducts.map(p => `
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <img src="${p.image}" class="w-16 h-16 object-cover rounded-lg">
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-bold text-gray-900 truncate">${p.title}</h4>
              <div class="text-xs font-bold text-emerald-900 mb-2">${p.price} DH</div>
              <button onclick="addToCart(${p.id}); closeModal('wishlist-modal')" class="btn-primary py-1 px-3 text-xs">
                Ajouter au Panier
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ----------------- PRODUCT QUICK VIEW / DETAILS MODAL -----------------

async function openProductModal(productId) {
  const modal = document.getElementById('product-details-modal');
  if (!modal) return;

  try {
    const res = await fetch(`/api/products/${productId}`);
    const prod = await res.json();
    state.activeProductModal = prod;

    document.getElementById('modal-prod-img').src = prod.image;
    document.getElementById('modal-prod-brand').textContent = prod.brand;
    document.getElementById('modal-prod-title').textContent = prod.title;
    document.getElementById('modal-prod-price').textContent = `${prod.price} DH`;
    
    const oldPriceEl = document.getElementById('modal-prod-old-price');
    if (prod.old_price) {
      oldPriceEl.textContent = `${prod.old_price} DH`;
      oldPriceEl.classList.remove('hidden');
    } else {
      oldPriceEl.classList.add('hidden');
    }

    document.getElementById('modal-prod-rating').textContent = `${prod.rating} ★ (${prod.reviews_count} avis clients)`;
    document.getElementById('modal-prod-stock').textContent = prod.stock > 0 ? `En Stock (${prod.stock} unités)` : 'Rupture temporaire';
    document.getElementById('modal-prod-desc').textContent = prod.description;
    document.getElementById('modal-prod-ingredients').textContent = prod.ingredients || 'Formule dermatologiquement testée.';
    document.getElementById('modal-prod-usage').textContent = prod.usage_tips || 'Appliquer sur peau propre.';

    // Render reviews
    const reviewsContainer = document.getElementById('modal-reviews-list');
    if (reviewsContainer) {
      if (prod.reviews && prod.reviews.length > 0) {
        reviewsContainer.innerHTML = prod.reviews.map(r => `
          <div class="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
            <div class="flex justify-between font-bold text-gray-800 mb-1">
              <span>${r.author}</span>
              <span class="text-amber-500">${'★'.repeat(r.rating)}</span>
            </div>
            <p class="text-gray-600">${r.comment}</p>
          </div>
        `).join('');
      } else {
        reviewsContainer.innerHTML = `<p class="text-xs text-gray-400">Soyez le premier à donner votre avis sur ce soin !</p>`;
      }
    }

    // Modal action buttons
    document.getElementById('modal-add-cart-btn').onclick = () => {
      const qty = parseInt(document.getElementById('modal-qty-input').value) || 1;
      addToCart(prod.id, qty);
      closeModal('product-details-modal');
    };

    document.getElementById('modal-whatsapp-btn').onclick = () => {
      orderViaWhatsApp(prod.id);
    };

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    showToast('Erreur chargement détails soin', 'toast-error');
  }
}

async function submitReview(event) {
  event.preventDefault();
  if (!state.activeProductModal) return;

  const author = document.getElementById('review-author').value;
  const rating = document.getElementById('review-rating').value;
  const comment = document.getElementById('review-comment').value;

  try {
    const res = await fetch(`/api/products/${state.activeProductModal.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, rating, comment })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Avis enregistré avec succès ! Merci pour votre retour.', 'toast-success');
      document.getElementById('review-form').reset();
      openProductModal(state.activeProductModal.id); // Refresh
    }
  } catch (err) {
    showToast('Erreur publication avis', 'toast-error');
  }
}

// ----------------- CHECKOUT & ORDERS -----------------

function initCityDropdown() {
  const citySelect = document.getElementById('checkout-city');
  if (!citySelect) return;

  let opts = `<option value="">Sélectionnez votre ville *</option>`;
  MOROCCAN_CITIES.forEach(c => {
    opts += `<option value="${c}">${c}</option>`;
  });
  citySelect.innerHTML = opts;
}

function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Votre panier est vide !', 'toast-gold');
    return;
  }
  closeCartDrawer();
  const modal = document.getElementById('checkout-modal');
  renderCheckoutSummary();
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderCheckoutSummary() {
  const itemsList = document.getElementById('checkout-items-list');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const shippingEl = document.getElementById('checkout-shipping');
  const discountEl = document.getElementById('checkout-discount');
  const totalEl = document.getElementById('checkout-total');
  const citySelect = document.getElementById('checkout-city');

  if (!itemsList) return;

  const subtotal = state.cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const city = citySelect ? citySelect.value : '';

  // Free shipping above 350 DH
  let shippingFee = 0;
  if (subtotal >= 350 || (state.appliedCoupon && state.appliedCoupon.type === 'shipping')) {
    shippingFee = 0;
  } else if (city.toLowerCase().includes('casablanca')) {
    shippingFee = 20;
  } else {
    shippingFee = 35;
  }

  let discount = 0;
  if (state.appliedCoupon) {
    if (state.appliedCoupon.type === 'percent') {
      discount = (subtotal * (state.appliedCoupon.value / 100));
    } else if (state.appliedCoupon.type === 'fixed') {
      discount = Math.min(state.appliedCoupon.value, subtotal);
    }
  }

  const finalTotal = Math.max(0, subtotal - discount + shippingFee);

  itemsList.innerHTML = state.cart.map(it => `
    <div class="flex justify-between items-center text-xs py-1 border-b border-gray-100">
      <span class="truncate max-w-[200px]">${it.title} (x${it.quantity})</span>
      <span class="font-bold text-gray-900">${(it.price * it.quantity).toFixed(2)} DH</span>
    </div>
  `).join('');

  if (subtotalEl) subtotalEl.textContent = `${subtotal.toFixed(2)} DH`;
  if (shippingEl) shippingEl.textContent = shippingFee === 0 ? 'GRATUITE' : `${shippingFee} DH`;
  if (discountEl) discountEl.textContent = `-${discount.toFixed(2)} DH`;
  if (totalEl) totalEl.textContent = `${finalTotal.toFixed(2)} DH`;
}

async function submitOrder(event) {
  event.preventDefault();

  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const city = document.getElementById('checkout-city').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const notes = document.getElementById('checkout-notes').value.trim();
  const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'Paiement à la livraison';

  if (!name || !phone || !city || !address) {
    showToast('Veuillez remplir tous les champs obligatoires.', 'toast-error');
    return;
  }

  const submitBtn = document.getElementById('checkout-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Traitement de votre commande...';
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        customer_city: city,
        customer_address: address,
        notes: notes,
        payment_method: paymentMethod,
        coupon_code: state.appliedCoupon ? state.appliedCoupon.code : null,
        items: state.cart
      })
    });

    const data = await res.json();
    if (data.success) {
      // Clear cart
      state.cart = [];
      state.appliedCoupon = null;
      saveCart();

      closeModal('checkout-modal');
      showOrderSuccessModal(data);
    } else {
      showToast(data.error || 'Erreur lors de la validation.', 'toast-error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Confirmer ma commande';
      }
    }
  } catch (err) {
    showToast('Erreur de connexion serveur.', 'toast-error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Confirmer ma commande';
    }
  }
}

function showOrderSuccessModal(orderData) {
  const modal = document.getElementById('order-success-modal');
  if (!modal) return;

  document.getElementById('success-order-num').textContent = orderData.order_number;
  document.getElementById('success-order-total').textContent = `${orderData.total} DH`;
  document.getElementById('success-wa-btn').href = orderData.whatsapp_url;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Confetti effect simulation
  triggerConfetti();
}

// ----------------- WHATSAPP INSTANT ORDER -----------------

function orderViaWhatsApp(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const msg = encodeURIComponent(
    `Salam Para Chaïmaa (Sté SAGFARMA) ! 🍃\n` +
    `Je souhaite commander le produit suivant :\n` +
    `👉 *${prod.title}* (${prod.brand})\n` +
    `💰 *Prix :* ${prod.price} DH\n\n` +
    `Pouvez-vous me confirmer la disponibilité et la livraison ? Merci !`
  );

  window.open(`https://wa.me/212661000000?text=${msg}`, '_blank');
}

function orderWholeCartViaWhatsApp() {
  if (state.cart.length === 0) {
    showToast('Votre panier est vide !', 'toast-gold');
    return;
  }

  const itemsList = state.cart.map(it => `- ${it.title} (x${it.quantity}) : ${(it.price * it.quantity)} DH`).join('\n');
  const total = state.cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);

  const msg = encodeURIComponent(
    `Salam Para Chaïmaa (Sté SAGFARMA) ! 🍃\n` +
    `Je souhaite passer une commande directe de mon panier :\n\n` +
    `${itemsList}\n\n` +
    `*Total estimé :* ${total} DH\n` +
    `Merci de me contacter pour valider mon adresse et l'expédition !`
  );

  window.open(`https://wa.me/212661000000?text=${msg}`, '_blank');
}

// ----------------- SKIN QUIZ / DIAGNOSTIC ROUTINE -----------------

function openSkinQuiz() {
  const modal = document.getElementById('skin-quiz-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

async function submitSkinQuiz() {
  const skinType = document.querySelector('input[name="quiz_skin_type"]:checked')?.value || 'mixte';
  const concern = document.querySelector('input[name="quiz_concern"]:checked')?.value || 'acne';

  try {
    const res = await fetch('/api/quiz-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skin_type: skinType, concern: concern })
    });
    const routine = await res.json();

    const resultBox = document.getElementById('quiz-results-container');
    const formBox = document.getElementById('quiz-questions-container');

    formBox.classList.add('hidden');
    resultBox.classList.remove('hidden');

    document.getElementById('routine-title').textContent = routine.routine_name;
    document.getElementById('routine-advice').textContent = routine.advice;
    document.getElementById('routine-total-price').textContent = `${routine.bundle_price} DH`;
    document.getElementById('routine-orig-price').textContent = `${routine.original_total} DH`;

    document.getElementById('routine-items-list').innerHTML = routine.products.map(p => `
      <div class="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100">
        <img src="${p.image}" class="w-12 h-12 object-cover rounded-md">
        <div class="flex-1 min-w-0">
          <div class="text-[11px] font-bold text-emerald-800">${p.brand}</div>
          <div class="text-xs font-semibold text-gray-900 truncate">${p.title}</div>
          <div class="text-xs font-bold text-gray-800">${p.price} DH</div>
        </div>
      </div>
    `).join('');

    // One-click add bundle to cart
    document.getElementById('add-routine-cart-btn').onclick = () => {
      routine.products.forEach(p => {
        const existing = state.cart.find(it => it.id === p.id);
        if (existing) existing.quantity += 1;
        else state.cart.push({ id: p.id, title: p.title, brand: p.brand, price: p.price, image: p.image, quantity: 1 });
      });
      saveCart();
      closeModal('skin-quiz-modal');
      showToast('✨ Routine complète ajoutée au panier avec réduction !', 'toast-success');
      openCartDrawer();
    };

  } catch (err) {
    showToast('Erreur génération diagnostic', 'toast-error');
  }
}

function resetSkinQuiz() {
  document.getElementById('quiz-questions-container').classList.remove('hidden');
  document.getElementById('quiz-results-container').classList.add('hidden');
}

// ----------------- ORDONNANCE / PRESCRIPTION UPLOAD -----------------

function openPrescriptionModal() {
  const modal = document.getElementById('prescription-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

async function submitPrescription(event) {
  event.preventDefault();
  const form = document.getElementById('prescription-form');
  const formData = new FormData(form);

  const submitBtn = document.getElementById('presc-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi en cours...';

  try {
    const res = await fetch('/api/prescriptions', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'toast-success');
      form.reset();
      closeModal('prescription-modal');
    } else {
      showToast(data.error || 'Erreur lors de l\'envoi', 'toast-error');
    }
  } catch (err) {
    showToast('Erreur transmission ordonnance', 'toast-error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Transmettre mon ordonnance';
  }
}

// ----------------- FLASH DEALS COUNTDOWN -----------------

function initFlashTimer() {
  const hoursEl = document.getElementById('flash-hours');
  const minutesEl = document.getElementById('flash-minutes');
  const secondsEl = document.getElementById('flash-seconds');

  if (!hoursEl) return;

  let secondsLeft = 14 * 3600 + 45 * 60 + 20; // 14 hours countdown

  setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) secondsLeft = 24 * 3600;

    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;

    hoursEl.textContent = String(h).padStart(2, '0');
    minutesEl.textContent = String(m).padStart(2, '0');
    secondsEl.textContent = String(s).padStart(2, '0');
  }, 1000);
}

// ----------------- TOASTS & UTILS -----------------

function showToast(message, type = 'toast-success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="text-sm font-semibold">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
}

function triggerConfetti() {
  // Simple cheerful celebratory visual effect
  const duration = 2000;
  const colors = ['#0d3b2e', '#c59b4c', '#e2c275', '#25d366'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.top = '20%';
    el.style.left = `${Math.random() * 80 + 10}%`;
    el.style.width = '8px';
    el.style.height = '8px';
    el.style.borderRadius = '2px';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
    el.style.transition = 'all 1.5s cubic-bezier(0.25, 1, 0.5, 1)';
    document.body.appendChild(el);

    setTimeout(() => {
      el.style.transform = `translate(${Math.random() * 200 - 100}px, ${Math.random() * 400 + 200}px) rotate(${Math.random() * 720}deg)`;
      el.style.opacity = '0';
    }, 20);

    setTimeout(() => el.remove(), duration);
  }
}

function setupEventListeners() {
  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
      }
    });
  });

  // ESC key to close open modals & drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      closeCartDrawer();
      document.body.style.overflow = 'auto';
    }
  });

  // WhatsApp bubble hover trigger
  const waBtn = document.querySelector('.whatsapp-icon-btn');
  const waBubble = document.querySelector('.whatsapp-bubble');
  if (waBtn && waBubble) {
    setTimeout(() => { waBubble.style.display = 'block'; }, 2000);
  }
}
