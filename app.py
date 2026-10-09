from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import sqlite3
import os
import json
import random
import time
from werkzeug.utils import secure_filename
from database import get_db_connection, init_db, seed_db

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload

# Initialize & seed DB on startup if needed
init_db()
seed_db()

# Promo codes dictionary
COUPONS = {
    'CHAIMAA10': {'type': 'percent', 'value': 10, 'label': '-10% Réduction Spéciale Para Chaïmaa'},
    'SAGFARMA': {'type': 'fixed', 'value': 25, 'label': '-25 DH Offerts par SAGFARMA'},
    'BEAUTY15': {'type': 'percent', 'value': 15, 'label': '-15% Beauté & Bien-être'},
    'LIVRAISON': {'type': 'shipping', 'value': 0, 'label': 'Livraison Gratuite Offerte'}
}

# ----------------- PAGE ROUTES -----------------

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/admin')
def admin_page():
    return render_template('admin.html')

# ----------------- CATEGORIES API -----------------

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    categories = conn.execute('''
        SELECT c.*, COUNT(p.id) as product_count 
        FROM categories c 
        LEFT JOIN products p ON c.id = p.category_id 
        GROUP BY c.id
    ''').fetchall()
    conn.close()
    return jsonify([dict(c) for c in categories])

# ----------------- PRODUCTS API -----------------

@app.route('/api/products', methods=['GET'])
def get_products():
    category = request.args.get('category')
    search = request.args.get('search', '').strip()
    brand = request.args.get('brand')
    sort = request.args.get('sort', 'popular')
    flash_sale = request.args.get('flash_sale')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    query = "SELECT * FROM products WHERE 1=1"
    params = []

    if category and category != 'all':
        query += " AND category_id = ?"
        params.append(category)

    if search:
        query += " AND (title LIKE ? OR brand LIKE ? OR description LIKE ? OR ingredients LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard, wildcard])

    if brand and brand != 'all':
        query += " AND brand = ?"
        params.append(brand)

    if flash_sale == '1':
        query += " AND is_flash_sale = 1"

    if min_price is not None:
        query += " AND price >= ?"
        params.append(min_price)

    if max_price is not None:
        query += " AND price <= ?"
        params.append(max_price)

    if sort == 'price-asc':
        query += " ORDER BY price ASC"
    elif sort == 'price-desc':
        query += " ORDER BY price DESC"
    elif sort == 'rating':
        query += " ORDER BY rating DESC"
    elif sort == 'newest':
        query += " ORDER BY id DESC"
    else:  # popular default
        query += " ORDER BY rating DESC, reviews_count DESC"

    conn = get_db_connection()
    products = conn.execute(query, params).fetchall()
    
    # Get distinct brands for filter options
    brands = [row['brand'] for row in conn.execute("SELECT DISTINCT brand FROM products ORDER BY brand").fetchall()]
    conn.close()

    return jsonify({
        'products': [dict(p) for p in products],
        'total': len(products),
        'brands': brands
    })

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    conn = get_db_connection()
    product = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({'error': 'Produit non trouvé'}), 404

    # Fetch reviews
    reviews = conn.execute(
        "SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC", 
        (product_id,)
    ).fetchall()

    # Fetch related products from same category
    related = conn.execute(
        "SELECT * FROM products WHERE category_id = ? AND id != ? LIMIT 4",
        (product['category_id'], product_id)
    ).fetchall()

    conn.close()

    prod_dict = dict(product)
    prod_dict['reviews'] = [dict(r) for r in reviews]
    prod_dict['related'] = [dict(r) for r in related]
    return jsonify(prod_dict)

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.json or {}
    required = ['title', 'brand', 'category_id', 'price', 'image', 'description']
    for req in required:
        if req not in data:
            return jsonify({'error': f'Champ manquant: {req}'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products (
            title, brand, category_id, price, old_price, stock, rating, reviews_count,
            badge, image, description, ingredients, usage_tips, skin_type, is_flash_sale
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('title'),
        data.get('brand'),
        data.get('category_id'),
        float(data.get('price')),
        float(data['old_price']) if data.get('old_price') else None,
        int(data.get('stock', 20)),
        float(data.get('rating', 5.0)),
        int(data.get('reviews_count', 0)),
        data.get('badge', 'Nouveau'),
        data.get('image'),
        data.get('description'),
        data.get('ingredients', ''),
        data.get('usage_tips', ''),
        data.get('skin_type', 'Tous types'),
        1 if data.get('is_flash_sale') else 0
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'id': new_id, 'message': 'Produit ajouté avec succès !'}), 201

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    data = request.json or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    existing = cursor.execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Produit non trouvé'}), 404

    cursor.execute('''
        UPDATE products SET
            title = COALESCE(?, title),
            brand = COALESCE(?, brand),
            category_id = COALESCE(?, category_id),
            price = COALESCE(?, price),
            old_price = COALESCE(?, old_price),
            stock = COALESCE(?, stock),
            badge = COALESCE(?, badge),
            image = COALESCE(?, image),
            description = COALESCE(?, description),
            ingredients = COALESCE(?, ingredients),
            usage_tips = COALESCE(?, usage_tips),
            skin_type = COALESCE(?, skin_type),
            is_flash_sale = COALESCE(?, is_flash_sale)
        WHERE id = ?
    ''', (
        data.get('title'),
        data.get('brand'),
        data.get('category_id'),
        float(data['price']) if 'price' in data else None,
        float(data['old_price']) if 'old_price' in data and data['old_price'] != '' else None,
        int(data['stock']) if 'stock' in data else None,
        data.get('badge'),
        data.get('image'),
        data.get('description'),
        data.get('ingredients'),
        data.get('usage_tips'),
        data.get('skin_type'),
        1 if data.get('is_flash_sale') else 0 if 'is_flash_sale' in data else None,
        product_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Produit mis à jour avec succès !'})

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.execute("DELETE FROM reviews WHERE product_id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Produit supprimé !'})

# ----------------- REVIEWS API -----------------

@app.route('/api/products/<int:product_id>/reviews', methods=['POST'])
def add_review(product_id):
    data = request.json or {}
    author = data.get('author', '').strip() or 'Client vérifié'
    rating = int(data.get('rating', 5))
    comment = data.get('comment', '').strip()

    if not comment:
        return jsonify({'error': 'Veuillez saisir votre commentaire'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO reviews (product_id, author, rating, comment, verified)
        VALUES (?, ?, ?, ?, 1)
    ''', (product_id, author, rating, comment))

    # Recalculate average rating & review count
    cursor.execute("SELECT AVG(rating), COUNT(id) FROM reviews WHERE product_id = ?", (product_id,))
    avg_r, count_r = cursor.fetchone()
    cursor.execute('''
        UPDATE products SET rating = ?, reviews_count = reviews_count + 1 WHERE id = ?
    ''', (round(avg_r, 1), product_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Avis publié avec succès ! Merci pour votre confiance.'})

# ----------------- COUPONS API -----------------

@app.route('/api/coupons/validate', methods=['POST'])
def validate_coupon():
    data = request.json or {}
    code = data.get('code', '').strip().upper()
    subtotal = float(data.get('subtotal', 0))

    if not code:
        return jsonify({'valid': False, 'message': 'Veuillez renseigner un code'}), 400

    if code in COUPONS:
        c = COUPONS[code]
        discount = 0.0
        if c['type'] == 'percent':
            discount = round(subtotal * (c['value'] / 100.0), 2)
        elif c['type'] == 'fixed':
            discount = min(c['value'], subtotal)
        elif c['type'] == 'shipping':
            discount = 0.0  # signals free shipping

        return jsonify({
            'valid': True,
            'code': code,
            'type': c['type'],
            'value': c['value'],
            'discount': discount,
            'label': c['label'],
            'message': f"Code promo appliqué : {c['label']}"
        })
    else:
        return jsonify({'valid': False, 'message': 'Code promo invalide ou expiré.'}), 404

# ----------------- ORDERS API -----------------

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.json or {}
    name = data.get('customer_name', '').strip()
    phone = data.get('customer_phone', '').strip()
    city = data.get('customer_city', '').strip()
    address = data.get('customer_address', '').strip()
    items = data.get('items', [])
    payment_method = data.get('payment_method', 'Paiement à la livraison')
    coupon_code = data.get('coupon_code')
    notes = data.get('notes', '')

    if not name or not phone or not city or not address:
        return jsonify({'error': 'Veuillez remplir tous les champs obligatoires (Nom, Téléphone, Ville, Adresse)'}), 400

    if not items or len(items) == 0:
        return jsonify({'error': 'Votre panier est vide'}), 400

    # Calculate subtotal & shipping
    subtotal = sum(float(item['price']) * int(item.get('quantity', 1)) for item in items)
    
    # Moroccan shipping rules:
    # Free if subtotal >= 350 DH or coupon free shipping
    if subtotal >= 350 or coupon_code == 'LIVRAISON':
        shipping_fee = 0.0
    elif city.lower() in ['casablanca', 'casa']:
        shipping_fee = 20.0
    else:
        shipping_fee = 35.0

    # Calculate discount
    discount = 0.0
    if coupon_code and coupon_code.upper() in COUPONS:
        c = COUPONS[coupon_code.upper()]
        if c['type'] == 'percent':
            discount = round(subtotal * (c['value'] / 100.0), 2)
        elif c['type'] == 'fixed':
            discount = min(c['value'], subtotal)
        elif c['type'] == 'shipping':
            shipping_fee = 0.0

    total = max(0.0, round(subtotal + shipping_fee - discount, 2))

    # Generate Order Number
    timestamp = int(time.time()) % 100000
    rand_suffix = random.randint(100, 999)
    order_number = f"ORD-{timestamp}-{rand_suffix}"

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO orders (
            order_number, customer_name, customer_phone, customer_city, customer_address,
            notes, payment_method, subtotal, shipping_fee, discount, total, coupon_code, status, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En attente', ?)
    ''', (
        order_number, name, phone, city, address, notes, payment_method,
        subtotal, shipping_fee, discount, total, coupon_code, json.dumps(items)
    ))

    # Update product stocks
    for item in items:
        cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (item.get('quantity', 1), item['id']))

    conn.commit()
    conn.close()

    # WhatsApp message pre-fill link for customer confirmation
    items_summary = "%0A".join([f"- {it.get('title', '')} (x{it.get('quantity', 1)}) : {it.get('price', 0)} DH" for it in items])
    wa_text = (
        f"Salam Para Chaïmaa (SAGFARMA) !%0A"
        f"Je confirme ma commande *{order_number}* :%0A"
        f"*Nom :* {name}%0A"
        f"*Téléphone :* {phone}%0A"
        f"*Ville :* {city}%0A"
        f"*Adresse :* {address}%0A"
        f"*Total :* {total} DH ({payment_method})%0A%0A"
        f"*Articles :*%0A{items_summary}"
    )
    whatsapp_url = f"https://wa.me/212661000000?text={wa_text}"

    return jsonify({
        'success': True,
        'order_number': order_number,
        'total': total,
        'subtotal': subtotal,
        'shipping_fee': shipping_fee,
        'discount': discount,
        'whatsapp_url': whatsapp_url,
        'message': 'Commande enregistrée avec succès ! Notre équipe vous contactera pour confirmation.'
    }), 201

@app.route('/api/orders', methods=['GET'])
def get_orders():
    conn = get_db_connection()
    orders = conn.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
    conn.close()

    result = []
    for o in orders:
        od = dict(o)
        try:
            od['items'] = json.loads(od['items_json'])
        except Exception:
            od['items'] = []
        result.append(od)

    return jsonify(result)

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    data = request.json or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'Statut requis'}), 400

    conn = get_db_connection()
    conn.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': f'Statut mis à jour : {new_status}'})

# ----------------- PRESCRIPTION / ORDONNANCE UPLOAD API -----------------

@app.route('/api/prescriptions', methods=['POST'])
def upload_prescription():
    name = request.form.get('customer_name', '').strip()
    phone = request.form.get('customer_phone', '').strip()
    city = request.form.get('customer_city', '').strip()
    notes = request.form.get('notes', '').strip()

    if not name or not phone:
        return jsonify({'error': 'Nom et téléphone requis'}), 400

    image_file = request.files.get('file')
    image_url = '/static/images/prescription-placeholder.jpg'

    if image_file and image_file.filename != '':
        filename = secure_filename(f"ord_{int(time.time())}_{image_file.filename}")
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        image_file.save(save_path)
        image_url = f"/static/uploads/{filename}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO prescriptions (customer_name, customer_phone, customer_city, image_url, notes, status)
        VALUES (?, ?, ?, ?, ?, 'Nouveau')
    ''', (name, phone, city, image_url, notes))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Votre ordonnance a bien été transmise à nos pharmaciens SAGFARMA. Nous vous contacterons sous peu par téléphone ou WhatsApp !'
    })

@app.route('/api/prescriptions', methods=['GET'])
def get_prescriptions():
    conn = get_db_connection()
    prescriptions = conn.execute("SELECT * FROM prescriptions ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify([dict(p) for p in prescriptions])

# ----------------- SKIN QUIZ DIAGNOSTIC API -----------------

@app.route('/api/quiz-recommendation', methods=['POST'])
def quiz_recommendation():
    data = request.json or {}
    skin_type = data.get('skin_type', 'mixte')  # grasse, seche, mixte, sensible
    concern = data.get('concern', 'acne')       # acne, rides, taches, deshydratation

    conn = get_db_connection()
    
    # Intelligently query tailored routine products
    cursor = conn.cursor()
    # 1. Cleanse product
    if 'grasse' in skin_type or 'acne' in concern:
        cleanser = cursor.execute("SELECT * FROM products WHERE id = 6").fetchone() or cursor.execute("SELECT * FROM products LIMIT 1").fetchone()
    else:
        cleanser = cursor.execute("SELECT * FROM products WHERE id = 2").fetchone() or cursor.execute("SELECT * FROM products LIMIT 1").fetchone()

    # 2. Treatment serum
    if 'rides' in concern:
        serum = cursor.execute("SELECT * FROM products WHERE id = 3").fetchone()
    elif 'taches' in concern or 'glow' in concern:
        serum = cursor.execute("SELECT * FROM products WHERE id = 4").fetchone()
    else:
        serum = cursor.execute("SELECT * FROM products WHERE id = 1").fetchone()

    # 3. Sunscreen / Daily protection
    sunscreen = cursor.execute("SELECT * FROM products WHERE id = 7").fetchone() or cursor.execute("SELECT * FROM products WHERE category_id = 'solaire' LIMIT 1").fetchone()

    conn.close()

    routine_products = [dict(cleanser), dict(serum), dict(sunscreen)]
    total_val = sum(p['price'] for p in routine_products)
    bundle_discount = round(total_val * 0.15, 2)  # 15% discount for buying the routine
    final_pack_price = round(total_val - bundle_discount, 2)

    return jsonify({
        'routine_name': f"Routine Personnalisée SAGFARMA - {skin_type.capitalize()} & {concern.capitalize()}",
        'products': routine_products,
        'original_total': total_val,
        'discount': bundle_discount,
        'bundle_price': final_pack_price,
        'advice': "Appliquez le nettoyant matin et soir, suivi du sérum traitant ciblé, et terminez le matin par la protection solaire SPF50+ pour préserver votre peau."
    })

# ----------------- ADMIN DASHBOARD STATS API -----------------

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    conn = get_db_connection()
    total_orders = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    total_revenue = conn.execute("SELECT COALESCE(SUM(total), 0) FROM orders WHERE status != 'Annulée'").fetchone()[0]
    pending_orders = conn.execute("SELECT COUNT(*) FROM orders WHERE status = 'En attente'").fetchone()[0]
    total_products = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    low_stock = conn.execute("SELECT COUNT(*) FROM products WHERE stock <= 5").fetchone()[0]
    prescriptions_count = conn.execute("SELECT COUNT(*) FROM prescriptions WHERE status = 'Nouveau'").fetchone()[0]

    recent_orders = conn.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 5").fetchall()
    conn.close()

    return jsonify({
        'total_orders': total_orders,
        'total_revenue': round(total_revenue, 2),
        'pending_orders': pending_orders,
        'total_products': total_products,
        'low_stock': low_stock,
        'prescriptions_count': prescriptions_count,
        'recent_orders': [dict(o) for o in recent_orders]
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Para Chaïmaa E-Commerce Server on port {port}...")
    app.run(host='0.0.0.0', port=port)
