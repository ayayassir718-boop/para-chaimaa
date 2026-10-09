/**
 * PARA CHAÏMAA - PARAPHARMACIE (Sté SAGFARMA)
 * Admin Back-Office Application Logic
 */

let adminOrders = [];
let adminProducts = [];
let adminCategories = [];
let adminPrescriptions = [];

document.addEventListener('DOMContentLoaded', () => {
  loadAdminStats();
  loadAdminOrders();
  loadAdminProducts();
  loadAdminPrescriptions();
});

// ----------------- STATS -----------------

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();

    document.getElementById('stat-revenue').textContent = `${data.total_revenue.toLocaleString()} DH`;
    document.getElementById('stat-orders').textContent = data.total_orders;
    document.getElementById('stat-pending').textContent = data.pending_orders;
    document.getElementById('stat-products').textContent = data.total_products;
    
    const stockAlert = document.getElementById('stat-low-stock');
    if (stockAlert) stockAlert.textContent = data.low_stock;

    const prescBadge = document.getElementById('stat-prescriptions');
    if (prescBadge) prescBadge.textContent = data.prescriptions_count;

  } catch (err) {
    console.error('Erreur chargement stats:', err);
  }
}

// ----------------- ORDERS -----------------

async function loadAdminOrders() {
  const container = document.getElementById('orders-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/orders');
    adminOrders = await res.json();
    renderAdminOrders();
  } catch (err) {
    console.error('Erreur chargement commandes:', err);
  }
}

function renderAdminOrders(filterStatus = 'all') {
  const container = document.getElementById('orders-table-body');
  if (!container) return;

  const filtered = filterStatus === 'all' 
    ? adminOrders 
    : adminOrders.filter(o => o.status === filterStatus);

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">Aucune commande trouvée.</td></tr>`;
    return;
  }

  container.innerHTML = filtered.map(o => {
    let statusClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (o.status === 'Confirmée') statusClass = 'bg-blue-100 text-blue-800 border-blue-200';
    if (o.status === 'Expédiée') statusClass = 'bg-purple-100 text-purple-800 border-purple-200';
    if (o.status === 'Livrée') statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (o.status === 'Annulée') statusClass = 'bg-red-100 text-red-800 border-red-200';

    const itemsSummary = (o.items || []).map(it => `${it.title} (x${it.quantity})`).join(', ');

    // Normalize moroccan phone for wa.me
    let cleanPhone = o.customer_phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '212' + cleanPhone.substring(1);

    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50 transition text-sm">
        <td class="p-4 font-bold text-emerald-950">${o.order_number}</td>
        <td class="p-4">
          <div class="font-semibold text-gray-900">${o.customer_name}</div>
          <div class="text-xs text-gray-500">${o.customer_city} • <a href="tel:${o.customer_phone}" class="text-emerald-700 hover:underline">${o.customer_phone}</a></div>
          <div class="text-xs text-gray-400 truncate max-w-xs" title="${o.customer_address}">${o.customer_address}</div>
        </td>
        <td class="p-4 max-w-xs">
          <div class="text-xs text-gray-700 truncate" title="${itemsSummary}">${itemsSummary}</div>
          <div class="text-[11px] text-gray-400 mt-0.5">${o.payment_method}</div>
        </td>
        <td class="p-4 font-bold text-gray-900">${o.total} DH</td>
        <td class="p-4">
          <span class="inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${statusClass}">
            ${o.status}
          </span>
        </td>
        <td class="p-4 text-xs text-gray-500">${o.created_at ? o.created_at.substring(0, 16) : '-'}</td>
        <td class="p-4">
          <div class="flex items-center gap-2">
            <select onchange="updateOrderStatus(${o.id}, this.value)" class="text-xs border border-gray-300 rounded px-2 py-1 bg-white">
              <option value="En attente" ${o.status === 'En attente' ? 'selected' : ''}>En attente</option>
              <option value="Confirmée" ${o.status === 'Confirmée' ? 'selected' : ''}>Confirmée</option>
              <option value="Expédiée" ${o.status === 'Expédiée' ? 'selected' : ''}>Expédiée</option>
              <option value="Livrée" ${o.status === 'Livrée' ? 'selected' : ''}>Livrée</option>
              <option value="Annulée" ${o.status === 'Annulée' ? 'selected' : ''}>Annulée</option>
            </select>
            <a href="https://wa.me/${cleanPhone}?text=Salam%20${encodeURIComponent(o.customer_name)},%20ici%20la%20parapharmacie%20Para%20Chaïmaa%20(SAGFARMA)%20concernant%20votre%20commande%20${o.order_number}" target="_blank" class="p-1.5 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200 transition" title="Contacter sur WhatsApp">
              💬
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminStats();
      loadAdminOrders();
      alert(`Statut de la commande mis à jour : ${newStatus}`);
    }
  } catch (err) {
    alert('Erreur lors de la mise à jour du statut');
  }
}

// ----------------- PRODUCTS -----------------

async function loadAdminProducts() {
  const container = document.getElementById('products-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/products?sort=newest');
    const data = await res.json();
    adminProducts = data.products;
    renderAdminProducts();
  } catch (err) {
    console.error('Erreur chargement produits:', err);
  }
}

function renderAdminProducts() {
  const container = document.getElementById('products-table-body');
  if (!container) return;

  container.innerHTML = adminProducts.map(p => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 transition text-sm">
      <td class="p-4">
        <img src="${p.image}" class="w-12 h-12 object-cover rounded-lg border border-gray-200">
      </td>
      <td class="p-4">
        <div class="font-bold text-gray-900 leading-tight">${p.title}</div>
        <div class="text-xs text-emerald-800 font-semibold uppercase mt-0.5">${p.brand} • Catégorie: ${p.category_id}</div>
      </td>
      <td class="p-4 font-bold text-gray-900">${p.price} DH ${p.old_price ? `<span class="text-xs text-gray-400 line-through">(${p.old_price} DH)</span>` : ''}</td>
      <td class="p-4">
        <span class="font-bold ${p.stock <= 5 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-gray-800'}">
          ${p.stock}
        </span>
      </td>
      <td class="p-4">
        <span class="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-700">${p.badge || '-'}</span>
      </td>
      <td class="p-4">
        <div class="flex items-center gap-2">
          <button onclick="openEditProductModal(${p.id})" class="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded font-semibold transition">
            Modifier
          </button>
          <button onclick="deleteProduct(${p.id})" class="px-2.5 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded font-semibold transition">
            Supprimer
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddProductModal() {
  document.getElementById('product-form').reset();
  document.getElementById('product-modal-title').textContent = "Ajouter un Nouveau Soin";
  document.getElementById('edit-product-id').value = "";
  document.getElementById('product-modal').classList.add('active');
}

function openEditProductModal(productId) {
  const prod = adminProducts.find(p => p.id === productId);
  if (!prod) return;

  document.getElementById('product-modal-title').textContent = "Modifier le Soin";
  document.getElementById('edit-product-id').value = prod.id;
  document.getElementById('prod-title').value = prod.title;
  document.getElementById('prod-brand').value = prod.brand;
  document.getElementById('prod-category').value = prod.category_id;
  document.getElementById('prod-price').value = prod.price;
  document.getElementById('prod-old-price').value = prod.old_price || "";
  document.getElementById('prod-stock').value = prod.stock;
  document.getElementById('prod-badge').value = prod.badge || "";
  document.getElementById('prod-image').value = prod.image;
  document.getElementById('prod-desc').value = prod.description;
  document.getElementById('prod-ingredients').value = prod.ingredients || "";
  document.getElementById('prod-usage').value = prod.usage_tips || "";

  document.getElementById('product-modal').classList.add('active');
}

async function saveProductForm(event) {
  event.preventDefault();

  const id = document.getElementById('edit-product-id').value;
  const payload = {
    title: document.getElementById('prod-title').value.trim(),
    brand: document.getElementById('prod-brand').value.trim(),
    category_id: document.getElementById('prod-category').value,
    price: parseFloat(document.getElementById('prod-price').value),
    old_price: document.getElementById('prod-old-price').value ? parseFloat(document.getElementById('prod-old-price').value) : null,
    stock: parseInt(document.getElementById('prod-stock').value) || 20,
    badge: document.getElementById('prod-badge').value.trim(),
    image: document.getElementById('prod-image').value.trim(),
    description: document.getElementById('prod-desc').value.trim(),
    ingredients: document.getElementById('prod-ingredients').value.trim(),
    usage_tips: document.getElementById('prod-usage').value.trim()
  };

  try {
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      alert(id ? 'Soin mis à jour avec succès !' : 'Nouveau soin ajouté !');
      closeAdminModal('product-modal');
      loadAdminProducts();
      loadAdminStats();
    } else {
      alert(data.error || 'Erreur lors de l\'enregistrement');
    }
  } catch (err) {
    alert('Erreur communication serveur');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce produit ?')) return;

  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert('Produit supprimé !');
      loadAdminProducts();
      loadAdminStats();
    }
  } catch (err) {
    alert('Erreur suppression produit');
  }
}

// ----------------- PRESCRIPTIONS -----------------

async function loadAdminPrescriptions() {
  const container = document.getElementById('prescriptions-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/prescriptions');
    adminPrescriptions = await res.json();

    if (adminPrescriptions.length === 0) {
      container.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">Aucune ordonnance reçue pour le moment.</td></tr>`;
      return;
    }

    container.innerHTML = adminPrescriptions.map(p => `
      <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
        <td class="p-4 font-bold text-gray-900">${p.customer_name}</td>
        <td class="p-4">
          <a href="tel:${p.customer_phone}" class="text-emerald-700 hover:underline font-semibold">${p.customer_phone}</a>
          <div class="text-xs text-gray-400">${p.customer_city || '-'}</div>
        </td>
        <td class="p-4">
          <a href="${p.image_url}" target="_blank" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">
            📄 Voir le document
          </a>
          <div class="text-xs text-gray-500 mt-1">${p.notes || 'Sans note particulière'}</div>
        </td>
        <td class="p-4 text-xs text-gray-500">${p.created_at ? p.created_at.substring(0, 16) : '-'}</td>
        <td class="p-4">
          <a href="https://wa.me/212${p.customer_phone.replace(/\D/g, '').replace(/^0/, '')}?text=Salam%20${encodeURIComponent(p.customer_name)},%20ici%20votre%20pharmacien%20Para%20Chaïmaa%20(SAGFARMA)%20au%20sujet%20de%20votre%20ordonnance." target="_blank" class="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 inline-block">
            Contacter WhatsApp
          </a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Erreur chargement ordonnances:', err);
  }
}

function closeAdminModal(id) {
  document.getElementById(id).classList.remove('active');
}
