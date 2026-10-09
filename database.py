import sqlite3
import os
import json

DB_FILE = os.path.join(os.path.dirname(__file__), 'parapharmacie.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Table categories
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT,
        icon TEXT,
        description TEXT
    )
    ''')

    # Table products
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        brand TEXT NOT NULL,
        category_id TEXT NOT NULL,
        price REAL NOT NULL,
        old_price REAL,
        stock INTEGER NOT NULL DEFAULT 20,
        rating REAL DEFAULT 4.8,
        reviews_count INTEGER DEFAULT 12,
        badge TEXT,
        image TEXT NOT NULL,
        description TEXT NOT NULL,
        ingredients TEXT,
        usage_tips TEXT,
        skin_type TEXT,
        is_flash_sale INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
    )
    ''')

    # Table orders
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_city TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        notes TEXT,
        payment_method TEXT NOT NULL,
        subtotal REAL NOT NULL,
        shipping_fee REAL NOT NULL,
        discount REAL DEFAULT 0,
        total REAL NOT NULL,
        coupon_code TEXT,
        status TEXT DEFAULT 'En attente',
        items_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Table prescriptions (ordonnances)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_city TEXT,
        image_url TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'Nouveau',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Table reviews
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        author TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        verified INTEGER DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )
    ''')

    conn.commit()
    conn.close()

def seed_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if products already exist
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] > 0:
        conn.close()
        return

    # Seed categories
    categories = [
        ("visage", "Soins Visage", "العناية بالوجه", "sparkles", "Nettoyants, sérums, anti-âge et crèmes hydratantes dermatologiques"),
        ("solaire", "Protection Solaire", "الحماية من الشمس", "sun", "Crèmes solaires SPF50+, brumes invisibles et soins après-soleil"),
        ("cheveux", "Cheveux & Cuir Chevelu", "العناية بالشعر", "scissors", "Traitements anti-chute, shampoings fortifiants et soins réparateurs"),
        ("corps", "Corps & Hygiène", "العناية بالجسم", "heart", "Hydratation intense, déodorants doux et hygiène intime respectueuse"),
        ("complements", "Compléments Alimentaires", "المكملات الغذائية", "pill", "Vitamines, collagène marin, magnésium et défenses immunitaires"),
        ("bebe", "Maman & Bébé", "الأم والطفل", "baby", "Soins hypoallergéniques pédiatriques, crèmes de change et laits bébé"),
        ("packs", "Packs & Coffrets Éco", "العروض والباقات", "package", "Routines complètes au meilleur rapport qualité-prix")
    ]

    cursor.executemany("INSERT OR REPLACE INTO categories (id, name, name_ar, icon, description) VALUES (?, ?, ?, ?, ?)", categories)

    # Seed 24 authentic top parapharmacie products
    products = [
        # Visage
        (
            "Effaclar Duo+ M Soin Anti-Imperfections Triple Action 40ml",
            "La Roche-Posay",
            "visage",
            175.0,
            210.0,
            25,
            4.9,
            48,
            "Best-Seller",
            "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80",
            "Soin complet renforcé anti-imperfections, anti-marques et anti-récidive pour peaux grasses à tendance acnéique. Texture gel-crème fraîche non grasse.",
            "Phylobioma, Niacinamide, Procerad, Acide Salicylique, LHA, Zinc PCA.",
            "Appliquer matin et soir sur l'ensemble du visage préalablement nettoyé avec le Gel Effaclar.",
            "Grasse / Acnéique",
            1
        ),
        (
            "CeraVe Baume Hydratant Corps & Visage 454g",
            "CeraVe",
            "visage",
            195.0,
            230.0,
            30,
            4.9,
            92,
            "Coup de Cœur",
            "https://images.unsplash.com/photo-1608248597359-0098f95c52c2?w=600&auto=format&fit=crop&q=80",
            "Hydrate en continu pendant 48 heures et aide à restaurer la barrière protectrice de la peau grâce aux 3 céramides essentiels et à l'acide hyaluronique.",
            "3 Céramides essentiels (1, 3, 6-II), Acide Hyaluronique, Technologie MVE brevetée.",
            "Appliquer généreusement aussi souvent que nécessaire sur le visage et le corps.",
            "Sèche à très sèche",
            0
        ),
        (
            "Hyalu B5 Sérum Anti-Rides Réparateur Repulpant 30ml",
            "La Roche-Posay",
            "visage",
            340.0,
            395.0,
            18,
            4.8,
            64,
            "Top Vente",
            "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80",
            "La référence anti-rides réparatrice qui repulpe immédiatement la peau et réduit significativement les rides. Enrichi en deux acides hyaluroniques purs et vitamine B5.",
            "Duo d'Acides Hyaluroniques purifiés, Vitamine B5 (Panthénol), Madécassoside réparateur.",
            "Appliquer 3 à 4 gouttes matin et soir sur le visage, le cou et le décolleté.",
            "Tous types de peaux",
            1
        ),
        (
            "Niacinamide 10% + Zinc 1% Sérum Régulateur 30ml",
            "The Ordinary",
            "visage",
            110.0,
            140.0,
            45,
            4.7,
            115,
            "Prix Doux",
            "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&auto=format&fit=crop&q=80",
            "Formule à haute concentration en vitamines et minéraux pour réduire visiblement les imperfections, resserrer les pores dilatés et équilibrer le sébum.",
            "Niacinamide (Vitamine B3) 10%, Zinc PCA 1%.",
            "Appliquer quelques gouttes matin et soir avant les crèmes plus lourdes. Ne pas associer à la vitamine C pure.",
            "Mixte à Grasse",
            0
        ),
        (
            "Cicaplast Baume B5+ Ultra-Réparateur Apaisant 100ml",
            "La Roche-Posay",
            "visage",
            155.0,
            185.0,
            35,
            5.0,
            88,
            "Indispensable",
            "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&auto=format&fit=crop&q=80",
            "Baume multi-usages qui apaise et protège les peaux irritées, gercées ou échauffées de toute la famille (nourrissons, enfants, adultes). Accélère la cicatrisation cutanée.",
            "Madécassoside, Panthénol 5%, Tribioma complexe prébiotique, Cuivre-Zinc-Manganèse.",
            "Appliquer 2 fois par jour sur peau propre et sèche. Peut s'appliquer sur le corps, le visage et les lèvres.",
            "Peau fragilisée / Irritée",
            0
        ),
        (
            "Sébium Gel Moussant Nettoyant Purifiant 500ml",
            "Bioderma",
            "visage",
            180.0,
            220.0,
            28,
            4.8,
            42,
            "Format Éco",
            "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&auto=format&fit=crop&q=80",
            "Nettoie en douceur et purifie l'épiderme sans dessécher. Limite la sécrétion de sébum et évite l'obstruction des pores cutanés.",
            "Complexe Fluidactiv breveté, Sulfate de Zinc, Sulfate de Cuivre.",
            "Faire mousser sur peau humide matin et soir, puis rincer abondamment à l'eau tiède.",
            "Mixte, Grasse",
            0
        ),

        # Solaire
        (
            "Anthelios UVMune 400 Fluide Invisible SPF50+ 50ml",
            "La Roche-Posay",
            "solaire",
            190.0,
            240.0,
            50,
            4.9,
            140,
            "N°1 Solaire",
            "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop&q=80",
            "La plus haute protection contre les rayons UVA ultra-longs. Texture ultra-fluide invisible, fini non gras et sans traces blanches. Résistant à l'eau et à la sueur.",
            "Filtre breveté Mexoryl 400, Technologie Netlock, Eau Thermale de La Roche-Posay.",
            "Agiter avant emploi. Appliquer généreusement sur le visage et le cou avant toute exposition solaire.",
            "Tous types de peaux",
            1
        ),
        (
            "Photoderm Max Aquafluide SPF50+ Fini Toucher Sec 40ml",
            "Bioderma",
            "solaire",
            165.0,
            195.0,
            24,
            4.7,
            38,
            "Promo -15%",
            "https://images.unsplash.com/photo-1563178406-4cdc2923acbc?w=600&auto=format&fit=crop&q=80",
            "Très haute protection solaire pour le visage au toucher sec et effet matifiant. Sans parfum, résistant à l'eau, excellente tolérance oculaire.",
            "Brevet Sun Active Defense, Poudres matifiantes, Filtres dermatologiques UVA/UVB.",
            "Appliquer quotidiennement sur le visage et le cou de manière uniforme avant l'exposition.",
            "Mixte à Grasse",
            0
        ),
        (
            "Fusion Water Magic SPF50 Protection Quotidienne 50ml",
            "ISDIN",
            "solaire",
            215.0,
            260.0,
            22,
            4.9,
            57,
            "Best-Seller",
            "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
            "Crème solaire visage à base aqueuse, ultra-légère qui s'absorbe instantanément sans laisser de résidu gras. Ne pique pas les yeux.",
            "Acide Hyaluronique, Extrait d'Algue Méditerranéenne antioxydante, Filtres nouvelle génération.",
            "Appliquer 30 minutes avant l'exposition solaire et renouveler toutes les 2 heures.",
            "Tous types de peaux",
            1
        ),
        (
            "Sun Gel-Crème Oil Control SPF50+ Toucher Sec 50ml",
            "Eucerin",
            "solaire",
            185.0,
            225.0,
            19,
            4.8,
            34,
            "Anti-Brillance",
            "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&auto=format&fit=crop&q=80",
            "Protection solaire visage avancée à effet anti-brillance durable jusqu'à 8 heures. Idéale pour les peaux grasses ou à tendance acnéique sous le soleil marocain.",
            "L-Carnitine régulatrice de sébum, Licochalcone A, Acide Glycyrrhétinique protecteur d'ADN.",
            "Appliquer le matin après ou à la place de votre soin de jour habituel.",
            "Grasse, Acnéique",
            0
        ),

        # Cheveux
        (
            "Dercos Shampoing Traitant Anti-Pelliculaire Kératolytique 390ml",
            "Vichy",
            "cheveux",
            160.0,
            195.0,
            32,
            4.9,
            67,
            "Recommandé",
            "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600&auto=format&fit=crop&q=80",
            "Élimine 100% des pellicules visibles dès la première application et offre une action anti-récidive pendant 6 semaines. Apaise les démangeaisons du cuir chevelu.",
            "Disulfure de Sélénium, Acide Salicylique, Céramide R, Vitamine E.",
            "Utiliser en cure 3 fois par semaine pendant 4 semaines, puis 1 fois par semaine en entretien.",
            "Pellicules / Cuir chevelu sensible",
            1
        ),
        (
            "Anaphase+ Shampoing Complément Anti-Chute 400ml",
            "Ducray",
            "cheveux",
            190.0,
            230.0,
            20,
            4.8,
            51,
            "Top Anti-Chute",
            "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=600&auto=format&fit=crop&q=80",
            "Prépare le cuir chevelu aux traitements anti-chute, fortifie la fibre capillaire et redonne force, volume et vigueur aux cheveux dévitalisés.",
            "Monolaurine, Biotine (Vitamine B8), Vitamine B6, Ruscus activateur de microcirculation.",
            "Appliquer, masser le cuir chevelu pendant 2 à 3 minutes, puis rincer soigneusement.",
            "Chute de cheveux occasionnelle ou chronique",
            0
        ),
        (
            "Huile Prodigieuse Multi-Fonctions Visage Corps Cheveux 100ml",
            "Nuxe",
            "cheveux",
            270.0,
            320.0,
            15,
            4.9,
            83,
            "Culte & Luxe",
            "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=600&auto=format&fit=crop&q=80",
            "Soin mythique aux 7 huiles précieuses 100% végétales. Nourrit, répare et sublime la peau et les pointes des cheveux en un seul geste au parfum inimitable.",
            "Huiles de Tsubaki, Argan, Macadamia, Bourrache, Camélia, Noisette et Amande douce.",
            "Sur les cheveux : appliquer en huile de finition sur les longueurs ou en masque 10 min avant le shampoing.",
            "Tous types de cheveux",
            0
        ),

        # Corps & Hygiène
        (
            "Lipikar Baume AP+M Relipidant Anti-Grattage 400ml",
            "La Roche-Posay",
            "corps",
            240.0,
            285.0,
            26,
            4.9,
            75,
            "Peaux Atopiques",
            "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
            "Triple action : apaise immédiatement, espace les crises de sécheresse sévère et rééquilibre le microbiome cutané. Convient aux bébés, enfants et adultes.",
            "Aqua Posae Filiformis + Microrésyl, Beurre de Karité 20%, Niacinamide apaisant.",
            "Appliquer 1 fois par jour sur le visage et le corps sur peau propre.",
            "Sèche, Très sèche, Atopique",
            0
        ),
        (
            "CeraVe Gel Nettoyant Anti-Rugosités SA 236ml",
            "CeraVe",
            "corps",
            145.0,
            175.0,
            21,
            4.7,
            44,
            "Lissant",
            "https://images.unsplash.com/photo-1556228722-d0b71946ec33?w=600&auto=format&fit=crop&q=80",
            "Nettoie en douceur, favorise l'élimination des rugosités et lisse la peau sans altérer la barrière cutanée. Idéal pour les peaux granuleuses et kératose pilaire.",
            "Acide Salicylique 0.5%, Urée 10%, 3 Céramides essentiels, Acide Hyaluronique.",
            "Masser délicatement sur peau humide en évitant le contour des yeux, puis rincer.",
            "Rugueuse, Irrégulière",
            0
        ),
        (
            "Spirial Déodorant Anti-Transpirant 48h Roll-On 50ml",
            "SVR",
            "corps",
            95.0,
            120.0,
            40,
            4.8,
            39,
            "Efficacité 48h",
            "https://images.unsplash.com/photo-1617897903246-719242758050?w=600&auto=format&fit=crop&q=80",
            "Efficacité anti-transpirante intense 48 heures même en situation de stress ou de sport. Sans alcool, sans parfum, anti-traces blanches et jaunes.",
            "Chlorhydrate d'Aluminium purifié, Terre de Diatomée absorbante, Allantoïne apaisante.",
            "Appliquer quotidiennement sur peau propre et sèche sous les aisselles.",
            "Toutes peaux même sensibles",
            0
        ),

        # Compléments Alimentaires
        (
            "Arkopharma Forcapil Anti-Chute Cheveux & Ongles (Boîte 90 Gélules)",
            "Arkopharma",
            "complements",
            260.0,
            310.0,
            35,
            4.9,
            96,
            "N°1 Maroc",
            "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600&auto=format&fit=crop&q=80",
            "Formule complète dédiée à freiner la chute des cheveux, stimuler la pousse et fortifier les ongles cassants. Efficacité cliniquement prouvée dès 30 jours.",
            "Acides aminés soufrés (Cystine, Méthionine), Cheveu de Vénus, Vitamine B8 (Biotine), Zinc.",
            "Prendre 1 gélule par jour le matin au petit-déjeuner avec un grand verre d'eau. Cure conseillée de 3 mois.",
            "Cure interne",
            1
        ),
        (
            "Collagène Marin Pur + Acide Hyaluronique & Vitamine C 300g",
            "NutriSanté",
            "complements",
            320.0,
            380.0,
            18,
            4.8,
            41,
            "Anti-Âge In & Out",
            "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80",
            "Poudre de peptides de collagène marin hydrolysé type 1 haute absorption. Améliore l'élasticité cutanée, réduit les ridules et renforce les articulations.",
            "Hydrolysat de Collagène marin 10g/dose, Acide Hyaluronique 120mg, Vitamine C 80mg.",
            "Diluer 1 cuillère doseuse dans un verre d'eau, jus ou smoothie une fois par jour de préférence le matin.",
            "Beauté & Bien-être",
            0
        ),
        (
            "Magnésium Marin B6 + B9 Anti-Fatigue & Stress 60 Comprimés",
            "Arkopharma",
            "complements",
            120.0,
            150.0,
            29,
            4.7,
            53,
            "Vitalité",
            "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&auto=format&fit=crop&q=80",
            "Aide à réduire la fatigue passagère et soutient le bon fonctionnement du système nerveux face au stress quotidien et surmenage.",
            "Oxyde de Magnésium marin naturel, Vitamine B6, Vitamine B9.",
            "1 comprimé par jour au cours d'un repas principal pendant 1 à 2 mois.",
            "Énergie & Sommeil",
            0
        ),

        # Maman & Bébé
        (
            "Mustela Bébé Gel Lavant Doux Corps & Cheveux 500ml Flacon Pompe",
            "Mustela",
            "bebe",
            135.0,
            165.0,
            30,
            4.9,
            62,
            "Indispensable Bébé",
            "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80",
            "Nettoie efficacement tout en respectant la peau délicate et le cuir chevelu des nouveau-nés, bébés et enfants. Ne pique pas les yeux.",
            "Perséose d'Avocat breveté Bio, Vitamine B5, Tensio-actifs doux.",
            "Verser dans la main, faire mousser sur le corps et les cheveux de bébé puis rincer délicatement.",
            "Peau normale du nourrisson",
            0
        ),
        (
            "Mustela Crème Change 1 2 3 Prévention Érythème Fessier 100ml",
            "Mustela",
            "bebe",
            85.0,
            110.0,
            40,
            4.9,
            78,
            "Top Vente",
            "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
            "Soin complet du siège : 1. Prévient les irritations et rougeurs, 2. Soulage dès la 1ère application, 3. Répare durablement la barrière cutanée de bébé.",
            "Oxéoline d'Alcacéa, Oléodistillat de Tournesol, Oxyde de Zinc protecteur.",
            "Appliquer en couche épaisse sur les fesses propres et sèches de bébé à chaque changement de couche.",
            "Siège du nourrisson",
            0
        ),

        # Packs Éco
        (
            "Pack Anti-Imperfections Glow & Pureté (3 Produits)",
            "Para Chaïmaa Routine",
            "packs",
            420.0,
            530.0,
            12,
            5.0,
            31,
            "Économisez 110 DH",
            "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80",
            "Le pack d'exception recommandé par les pharmaciens SAGFARMA : 1x Gel Nettoyant Purifiant + 1x Sérum Niacinamide 10% + 1x Fluide Solaire Matifiant SPF50+. Routine complète pour une peau nette et matifiée.",
            "Niacinamide, Zinc, Acide Salicylique, Filtres solaires haute tolérance.",
            "Matin : Nettoyant -> Sérum -> Solaire. Soir : Nettoyant -> Sérum.",
            "Mixte à Grasse / Acnéique",
            1
        ),
        (
            "Pack Duo Solaire & Hydratation Haute Protection",
            "Para Chaïmaa Routine",
            "packs",
            345.0,
            435.0,
            15,
            4.9,
            24,
            "Économisez 90 DH",
            "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop&q=80",
            "Duo protecteur indispensable contre le soleil et le dessèchement : Anthelios UVMune 400 SPF50+ Invisible + Baume Cicaplast B5+ apaisant.",
            "Mexoryl 400, Madécassoside, Panthénol 5%, Eau thermale.",
            "Appliquer la protection solaire le matin avant l'exposition et le baume réparateur le soir.",
            "Tous types de peaux",
            1
        ),
        (
            "Pack Anti-Chute Ultime Cure 3 Mois Cheveux Fortifiés",
            "Para Chaïmaa Routine",
            "packs",
            590.0,
            735.0,
            10,
            5.0,
            19,
            "Économisez 145 DH",
            "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600&auto=format&fit=crop&q=80",
            "Le protocole complet In & Out pour stopper net la chute des cheveux : Forcapil 90 gélules + Shampoing Ducray Anaphase+ 400ml + Huile fortifiante stimulante.",
            "Biotine, Cystine, Ruscus, Vitamines B complexes.",
            "Gélule quotidienne au petit-déjeuner + Shampoing traitant 3 fois par semaine.",
            "Chute réactionnelle ou saisonnière",
            1
        )
    ]

    cursor.executemany('''
    INSERT INTO products (
        title, brand, category_id, price, old_price, stock, rating, reviews_count,
        badge, image, description, ingredients, usage_tips, skin_type, is_flash_sale
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', products)

    # Seed Sample Reviews
    sample_reviews = [
        (1, "Fatima-Zahra El Amrani (Casablanca)", 5, "Produit 100% original ! Service client au top, livraison reçue en 24h à Casablanca avec des échantillons gratuits en cadeau. Bravo Para Chaïmaa !"),
        (1, "Yassine Berrada (Rabat)", 5, "Très efficace contre les boutons et points noirs. Le meilleur prix du marché marocain."),
        (7, "Salma Bennani (Marrakech)", 5, "L'écran solaire indispensable pour Marrakech ! Texture invisible et pas collante du tout. Livraison très rapide."),
        (11, "Hicham Tazi (Tanger)", 5, "Après seulement 2 lavages mes pellicules ont totalement disparu. Emballage soigné."),
        (17, "Khadija Idrissi (Fès)", 5, "Super pack Forcapil ! J'ai déjà commandé 2 fois chez SAGFARMA, toujours ponctuel et produits certifiés authentiques.")
    ]
    cursor.executemany("INSERT INTO reviews (product_id, author, rating, comment) VALUES (?, ?, ?, ?)", sample_reviews)

    # Seed sample orders so the admin dashboard shows live data right away
    sample_orders = [
        (
            "ORD-2026-1042", "Imane Alaoui", "0661234567", "Casablanca", "Boulevard d'Anfa, Résidence Les Fleurs Appt 12",
            "Livraison avant 17h svp", "Paiement à la livraison", 420.0, 0.0, 42.0, 378.0, "CHAIMAA10", "Confirmée",
            json.dumps([{"id": 22, "title": "Pack Anti-Imperfections Glow & Pureté", "price": 420.0, "quantity": 1, "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80"}])
        ),
        (
            "ORD-2026-1043", "Mehdi Chraibi", "0672987654", "Rabat", "Avenue Mohammed VI, Souissi",
            "Appeler avant de passer", "Paiement à la livraison", 380.0, 25.0, 0.0, 405.0, None, "Expédiée",
            json.dumps([{"id": 7, "title": "Anthelios UVMune 400 Fluide Invisible SPF50+", "price": 190.0, "quantity": 2, "image": "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop&q=80"}])
        ),
        (
            "ORD-2026-1044", "Sanaa Mansouri", "0654112233", "Marrakech", "Guéliz, Rue de la Liberté",
            "Sonnette Mansouri", "Carte Bancaire", 590.0, 0.0, 0.0, 590.0, None, "Livrée",
            json.dumps([{"id": 24, "title": "Pack Anti-Chute Ultime Cure 3 Mois", "price": 590.0, "quantity": 1, "image": "https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600&auto=format&fit=crop&q=80"}])
        )
    ]

    cursor.executemany('''
    INSERT INTO orders (
        order_number, customer_name, customer_phone, customer_city, customer_address,
        notes, payment_method, subtotal, shipping_fee, discount, total, coupon_code, status, items_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', sample_orders)

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    seed_db()
    print("Database initialized and seeded successfully!")
