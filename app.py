import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, datetime
from io import BytesIO

# Import the database module
import database as db 

st.set_page_config(page_title="AgriManager Pro", layout="wide", page_icon="🌾")

# --- CUSTOM CSS ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
    
    * { font-family: 'Inter', sans-serif; }
    
    .stApp { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); }
    
    .metric-card {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.07);
        border-left: 5px solid #2e7d32;
        margin: 10px 0;
    }
    
    .metric-value {
        font-size: 32px;
        font-weight: 700;
        color: #1b5e20;
        margin: 10px 0;
    }
    
    .metric-label {
        font-size: 14px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .stock-box {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
        border-radius: 12px;
        color: white;
        margin: 8px 0;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    
    .stock-name { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .stock-qty { font-size: 28px; font-weight: 700; }
    .stock-unit { font-size: 14px; opacity: 0.9; }
    
    div[data-testid="stSidebar"] { background: linear-gradient(180deg, #1b5e20 0%, #2e7d32 100%); }
    div[data-testid="stSidebar"] * { color: white !important; }
    
    h1 { color: #1b5e20; font-weight: 700; font-size: 2.5rem; }
    h2, h3 { color: #2e7d32; font-weight: 600; }
    
    .stButton>button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-weight: 600;
        transition: all 0.3s;
    }
    
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .success-box {
        background: #4caf50;
        color: white;
        padding: 20px;
        border-radius: 12px;
        margin: 20px 0;
        font-size: 18px;
        text-align: center;
        font-weight: 600;
        animation: slideIn 0.5s ease-out;
    }
    
    @keyframes slideIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .dataframe { border-radius: 8px; overflow: hidden; }
    
    .purchase-card {
        background: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin: 15px 0;
        border-left: 4px solid #667eea;
    }
    
    .total-display {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        margin: 20px 0;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    .total-label { font-size: 14px; opacity: 0.9; margin-bottom: 10px; }
    .total-amount { font-size: 36px; font-weight: 700; }
    
    /* Simplified Treatment Line Style */
    .traitement-row {
        background: white;
        border-left: 4px solid #4caf50;
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
</style>
""", unsafe_allow_html=True)

# --- SESSION STATE INIT ---
if 'user' not in st.session_state: st.session_state.user = None
if 'panier' not in st.session_state: st.session_state.panier = []
if 'treatment_buffer' not in st.session_state: st.session_state.treatment_buffer = [] 
if 'treatment_success' not in st.session_state: st.session_state.treatment_success = None

# --- AUTHENTICATION ---
def login_screen():
    c1, c2, c3 = st.columns([1, 2, 1])
    with c2:
        st.markdown("<h1 style='text-align: center;'>🚜 AgriManager Pro</h1>", unsafe_allow_html=True)
        st.markdown("<p style='text-align: center; color: #666;'>Gestion intelligente de votre exploitation</p>", unsafe_allow_html=True)
        
        tab_login, tab_signup = st.tabs(["🔒 Connexion", "📝 Inscription"])
        
        with tab_login:
            with st.form("login_form"):
                email = st.text_input("Email", key="l_mail")
                password = st.text_input("Mot de passe", type="password", key="l_pass")
                if st.form_submit_button("Se connecter", use_container_width=True):
                    user = db.login_user(email, password)
                    if user:
                        st.session_state.user = user
                        st.rerun()
                    else:
                        st.error("Erreur de connexion.")

        with tab_signup:
            with st.form("signup_form"):
                email = st.text_input("Email", key="s_mail")
                password = st.text_input("Mot de passe", type="password", key="s_pass")
                if st.form_submit_button("Créer un compte", use_container_width=True):
                    user = db.create_user(email, password)
                    if user:
                        st.success("Compte créé ! Connectez-vous.")
                    else:
                        st.error("Erreur inscription.")

if not st.session_state.user:
    login_screen()
    st.stop()

# Handle user object
if isinstance(st.session_state.user, dict):
    user_id = st.session_state.user.get('id')
else:
    user_id = st.session_state.user.id

# --- 2. THEN FETCH FARM NAME (Safe because user_id now exists) ---
if 'farm_name' not in st.session_state:
    # We pass the user_id we just defined above
    st.session_state.farm_name = db.get_farm_name(user_id)

user_farm_name = st.session_state.farm_name
# --- SIDEBAR (DYNAMIC NAME) ---
st.sidebar.title(f"👨‍🌾 {user_farm_name}")
menu = st.sidebar.radio("Navigation", ["📊 Dashboard", "🚜 Traitements", "📜 Historique", "📦 Achats & Stock", "⚙️ Paramètres"])

if st.sidebar.button("Déconnexion"):
    st.session_state.user = None
    st.rerun()

# --- DASHBOARD ---
if menu == "📊 Dashboard":
    st.title(f"📊 {user_farm_name}")
    
    achats_data, trait_data, prod_data = db.get_dashboard_data(user_id)
    
    df_achats = pd.DataFrame(achats_data)
    df_traits = pd.DataFrame(trait_data)
    df_prods = pd.DataFrame(prod_data)

    total_stock_value = (df_prods['stock_actuel'] * df_prods['prix_moyen']).sum() if not df_prods.empty else 0.0
    total_spent = df_achats['montant_ttc'].sum() if not df_achats.empty else 0.0
    total_trait_cost = df_traits['cout_estime'].sum() if not df_traits.empty else 0.0

    c1, c2, c3 = st.columns(3)
    
    with c1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">💰 Valeur Stock Actuel</div>
            <div class="metric-value">{total_stock_value:.2f} MAD</div>
        </div>
        """, unsafe_allow_html=True)
    
    with c2:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">📉 Dépenses Totales</div>
            <div class="metric-value">{total_spent:.2f} MAD</div>
        </div>
        """, unsafe_allow_html=True)
    
    with c3:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">🚜 Coût Traitements</div>
            <div class="metric-value">{total_trait_cost:.2f} MAD</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("---")

    g1, g2 = st.columns(2)
    
    with g1:
        st.subheader("📦 Stock par Produit")
        if not df_prods.empty:
            for _, row in df_prods.iterrows():
                st.markdown(f"""
                <div class="stock-box">
                    <div class="stock-name">{row['nom']}</div>
                    <div class="stock-qty">{row['stock_actuel']:.2f} <span class="stock-unit">{row['unite_reference']}</span></div>
                    <div class="stock-unit">{row['type_produit']}</div>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.info("Aucun produit en stock.")

    with g2:
        st.subheader("💸 Dépenses par Type")
        if not df_achats.empty:
            df_achats['Type'] = df_achats['produits'].apply(lambda x: x.get('type_produit') if x else 'Autre')
            
            fig2 = px.pie(df_achats, values='montant_ttc', names='Type', 
                          title="Répartition des Achats", hole=0.4,
                          color_discrete_sequence=px.colors.qualitative.Set3)
            fig2.update_layout(showlegend=True)
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.info("Aucun achat enregistré.")

    if not df_traits.empty:
        st.subheader("📊 Coût des Traitements par Parcelle")
        df_traits_agg = df_traits.groupby('parcelle')['cout_estime'].sum().reset_index()
        fig3 = px.bar(df_traits_agg, x='parcelle', y='cout_estime', 
                      title="Coût Total par Parcelle",
                      labels={'parcelle': 'Parcelle', 'cout_estime': 'Coût (MAD)'},
                      color='cout_estime',
                      color_continuous_scale='Greens')
        fig3.update_layout(showlegend=False)
        st.plotly_chart(fig3, use_container_width=True)

# --- TRAITEMENTS ---
elif menu == "🚜 Traitements":
    st.header("🚜 Saisie des Traitements")
    st.markdown("Ajoutez autant de lignes que nécessaire, puis validez le tout en une seule fois.")

    if st.session_state.treatment_success:
        st.markdown(f"""
        <div class="success-box">
            ✅ Traitement enregistré avec succès !<br>
            Coût Total: {st.session_state.treatment_success:.2f} MAD
        </div>
        """, unsafe_allow_html=True)
        st.session_state.treatment_success = None

    prods = db.obtenir_produits(user_id)
    parcelles = db.obtenir_parcelles(user_id)

    if not prods or not parcelles:
        st.warning("⚠️ Veuillez d'abord ajouter des Parcelles et des Produits dans l'onglet Paramètres.")
    else:
        # --- SECTION 1: ADD LINE FORM ---
        st.markdown("### 1️⃣ Ajouter une ligne de traitement")
        
        with st.container():
            with st.form("add_line_form", clear_on_submit=True):
                c1, c2, c3, c4 = st.columns([2, 2, 1, 1])
                
                parcelle_names = [p['nom'] for p in parcelles]
                product_names = [p['nom'] for p in prods]
                
                selected_parcelle = c1.selectbox("📍 Parcelle", parcelle_names)
                selected_product = c2.selectbox("🧪 Produit", product_names)
                dose = c3.number_input("💧 Dose (Qté)", min_value=0.0, step=0.1)
                date_trait = c4.date_input("📅 Date", value=date.today())
                
                add_line = st.form_submit_button("➕ Ajouter la ligne", type="secondary")
                
                if add_line:
                    if dose > 0:
                        product_obj = next((p for p in prods if p['nom'] == selected_product), None)
                        if product_obj:
                            cost = dose * float(product_obj.get('prix_moyen', 0))
                            
                            st.session_state.treatment_buffer.append({
                                "parcelle": selected_parcelle,
                                "produit": selected_product,
                                "produit_id": product_obj['id'],
                                "dose": dose,
                                "date": date_trait,
                                "cost": cost,
                                "unit": product_obj.get('unite_reference', '')
                            })
                            st.rerun()
                    else:
                        st.error("La dose doit être supérieure à 0.")

        # --- SECTION 2: REVIEW LIST ---
        st.markdown("### 2️⃣ Liste à valider")
        
        if st.session_state.treatment_buffer:
            total_batch_cost = 0
            
            st.markdown("""
            <div style="display: flex; font-weight: bold; color: #666; padding: 10px; border-bottom: 2px solid #ddd;">
                <div style="flex: 2;">Parcelle</div>
                <div style="flex: 2;">Produit</div>
                <div style="flex: 1;">Dose</div>
                <div style="flex: 1;">Date</div>
                <div style="flex: 1;">Coût</div>
                <div style="width: 50px;">Action</div>
            </div>
            """, unsafe_allow_html=True)

            for idx, item in enumerate(st.session_state.treatment_buffer):
                total_batch_cost += item['cost']
                
                c1, c2, c3, c4, c5, c6 = st.columns([2, 2, 1, 1, 1, 0.5])
                
                with c1: st.write(f"📍 **{item['parcelle']}**")
                with c2: st.write(f"{item['produit']}")
                with c3: st.write(f"{item['dose']} {item['unit']}")
                with c4: st.write(f"{item['date'].strftime('%d/%m/%Y')}")
                with c5: st.write(f"**{item['cost']:.2f} MAD**")
                with c6:
                    if st.button("❌", key=f"rm_{idx}"):
                        st.session_state.treatment_buffer.pop(idx)
                        st.rerun()
                st.markdown("<hr style='margin: 5px 0;'>", unsafe_allow_html=True)

            # --- SECTION 3: FINAL ACTION ---
            st.markdown(f"""
            <div class="total-display">
                <div class="total-label">COÛT TOTAL DU LOT</div>
                <div class="total-amount">{total_batch_cost:.2f} MAD</div>
                <div style="font-size: 14px; margin-top:5px;">{len(st.session_state.treatment_buffer)} lignes en attente</div>
            </div>
            """, unsafe_allow_html=True)
            
            col_left, col_btn, col_right = st.columns([1, 2, 1])
            with col_btn:
                if st.button("🚀 Valider et Enregistrer (Tout le lot)", type="primary", use_container_width=True):
                    tx_list = []
                    for t in st.session_state.treatment_buffer:
                        tx_list.append({
                            "user_id": user_id,
                            "produit_id": t['produit_id'],
                            "parcelle": t['parcelle'],
                            "quantite_utilisee": t['dose'],
                            "date_traitement": str(t['date'])
                        })
                    
                    db.enregistrer_traitement_batch(tx_list)
                    
                    st.session_state.treatment_success = total_batch_cost
                    st.session_state.treatment_buffer = []
                    st.balloons()
                    st.rerun()
        else:
            st.info("La liste est vide. Ajoutez des traitements ci-dessus.")

# --- HISTORIQUE ---
elif menu == "📜 Historique":
    st.header("📜 Historique des Traitements")
    
    year_start = datetime(datetime.now().year, 1, 1).isoformat()
    all_treatments = db.get_treatments_from_date(user_id, year_start)
    
    if all_treatments:
        df_hist = pd.DataFrame(all_treatments)
        df_hist['date_traitement'] = pd.to_datetime(df_hist['date_traitement']).dt.strftime('%d/%m/%Y')
        df_hist['produit_nom'] = df_hist['produits'].apply(lambda x: x.get('nom') if x else 'N/A')
        
        display_df = df_hist[['date_traitement', 'parcelle', 'produit_nom', 'quantite_utilisee', 'cout_estime']]
        display_df.columns = ['Date', 'Parcelle', 'Produit', 'Quantité', 'Coût (MAD)']
        
        st.dataframe(display_df, use_container_width=True, hide_index=True)
        
        st.subheader("📈 Analyse par Parcelle")
        parcelle_stats = df_hist.groupby('parcelle').agg({
            'cout_estime': 'sum',
            'quantite_utilisee': 'sum'
        }).reset_index()
        parcelle_stats.columns = ['Parcelle', 'Coût Total (MAD)', 'Quantité Totale']
        
        col1, col2 = st.columns(2)
        with col1:
            st.dataframe(parcelle_stats, use_container_width=True, hide_index=True)
        
        with col2:
            fig = px.pie(parcelle_stats, values='Coût Total (MAD)', names='Parcelle',
                        title="Distribution des Coûts par Parcelle",
                        color_discrete_sequence=px.colors.qualitative.Pastel)
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Aucun traitement enregistré cette année.")

# --- ACHATS ---
elif menu == "📦 Achats & Stock":
    st.header("📦 Gestion Achats & Stocks")
    
    col_f, col_d = st.columns(2)
    fournisseur = col_f.text_input("🏢 Fournisseur", "Coopérative")
    date_com = col_d.date_input("📅 Date Achat", date.today())
    
    st.markdown("---")
    
    if 'panier' not in st.session_state:
        st.session_state.panier = []
    
    st.subheader("➕ Ajouter des produits")
    
    with st.container():
        col1, col2, col3, col4, col5, col6 = st.columns([2, 1.5, 1, 1, 1.5, 1])
        
        product_types = db.get_product_types(user_id)
        
        new_product = col1.text_input("Nom du produit", key="new_prod_name")
        new_type = col2.selectbox("Type", product_types, key="new_prod_type")
        new_qty = col3.number_input("Qté", min_value=0.0, step=0.1, key="new_prod_qty")
        new_unit = col4.selectbox("Unité", ["L", "Kg", "ml", "g"], key="new_prod_unit")
        new_price = col5.number_input("Prix HT", min_value=0.0, step=0.01, key="new_prod_price")
        new_tva = col6.selectbox("TVA %", [0, 7, 10, 14, 20], index=4, key="new_prod_tva")
        
        if st.button("➕ Ajouter au panier", type="primary"):
            if new_product and new_qty > 0 and new_price > 0:
                st.session_state.panier.append({
                    "produit": new_product,
                    "type": new_type,
                    "quantite": new_qty,
                    "unite": new_unit,
                    "prix": new_price,
                    "tva": new_tva
                })
                st.rerun()
    
    if st.session_state.panier:
        st.markdown("---")
        st.subheader("🛒 Panier de Validation")
        
        total_ht = 0
        total_tva = 0
        total_ttc = 0
        
        items_to_remove = []
        
        for idx, item in enumerate(st.session_state.panier):
            try:
                item_total_ht = float(item.get('quantite', 0)) * float(item.get('prix', 0))
                item_tva = item_total_ht * (float(item.get('tva', 0)) / 100)
                item_ttc = item_total_ht + item_tva
                
                total_ht += item_total_ht
                total_tva += item_tva
                total_ttc += item_ttc
            
                col1, col2 = st.columns([5, 1])
                
                with col1:
                    st.markdown(f"""
                    <div class="purchase-card">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0; color: #1b5e20;">{item['produit']}</h4>
                                <p style="margin: 5px 0; color: #666;"><span style="background: #e3f2fd; padding: 3px 8px; border-radius: 4px; font-size: 12px;">{item['type']}</span></p>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 14px; color: #666;">Quantité</div>
                                <div style="font-size: 20px; font-weight: 600;">{item['quantite']:.2f} {item['unite']}</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 14px; color: #666;">Prix Unitaire HT</div>
                                <div style="font-size: 20px; font-weight: 600;">{item['prix']:.2f} MAD</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 14px; color: #666;">TVA</div>
                                <div style="font-size: 16px; font-weight: 600; color: #ff9800;">{item['tva']}%</div>
                            </div>
                            <div style="flex: 1; text-align: right;">
                                <div style="font-size: 14px; color: #666;">Total HT</div>
                                <div style="font-size: 22px; font-weight: 700; color: #667eea;">{item_total_ht:.2f} MAD</div>
                                <div style="font-size: 12px; color: #999;">TVA: {item_tva:.2f} MAD</div>
                                <div style="font-size: 16px; font-weight: 600; color: #2e7d32;">TTC: {item_ttc:.2f} MAD</div>
                            </div>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                
                with col2:
                    if st.button("🗑️", key=f"del_{idx}"):
                        st.session_state.panier.pop(idx)
                        st.rerun()
            except:
                pass
        
        st.markdown("---")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown(f"""
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 15px 0; color: #2e7d32;">📊 Récapitulatif</h3>
                <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee;">
                    <span style="font-size: 16px; color: #666;">Total HT:</span>
                    <span style="font-size: 20px; font-weight: 600;">{total_ht:.2f} MAD</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee;">
                    <span style="font-size: 16px; color: #666;">Total TVA:</span>
                    <span style="font-size: 20px; font-weight: 600; color: #ff9800;">{total_tva:.2f} MAD</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 15px 0 0 0; padding: 15px 0;">
                    <span style="font-size: 18px; font-weight: 600; color: #1b5e20;">TOTAL TTC:</span>
                    <span style="font-size: 28px; font-weight: 700; color: #1b5e20;">{total_ttc:.2f} MAD</span>
                </div>
            </div>
            """, unsafe_allow_html=True)
        
        with col2:
            st.markdown(f"""
            <div class="total-display">
                <div class="total-label">MONTANT À PAYER</div>
                <div class="total-amount">{total_ttc:.2f} MAD</div>
                <div style="margin-top: 10px; font-size: 14px; opacity: 0.9;">
                    {len(st.session_state.panier)} produit{'s' if len(st.session_state.panier) > 1 else ''}
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button("🚀 VALIDER LA COMMANDE", type="primary", use_container_width=True):
                for p in st.session_state.panier:
                    u_ref = "Kg" if p['unite'] in ["Kg", "g"] else "L"
                    facteur = 0.001 if p['unite'] in ["g", "ml"] else 1.0
                    
                    db.enregistrer_achat_complet({
                        "nom": p['produit'],
                        "type_produit": p['type'],
                        "quantite": p['quantite'] * facteur,
                        "unite_ref": u_ref,
                        "unite_achat": p['unite'],
                        "prix_u_ht": p['prix'],
                        "taux_tva": p['tva'],
                        "fournisseur": fournisseur,
                        "date": str(date_com)
                    }, user_id)
                
                st.session_state.panier = []
                st.success("✅ Commande validée ! Stock mis à jour avec le nouveau PAMP !")
                st.balloons()
                st.rerun()

# --- PARAMETRES ---
elif menu == "⚙️ Paramètres":
    st.header("Paramètres")
    
    # ADDED "🏠 Configuration" TAB
    tab_farm, tab1, tab2, tab3 = st.tabs(["🏠 Configuration", "🌾 Parcelles", "🏷️ Types de Produits", "📊 Données"])
    
    with tab_farm:
        st.subheader("Configuration de la ferme")
        with st.form("config_farm"):
            new_farm_name = st.text_input("Nom de votre exploitation", value=user_farm_name)
            if st.form_submit_button("Sauvegarder les modifications"):
                db.update_farm_name(user_id, new_farm_name)
                # Update local session for immediate refresh
                st.session_state.farm_name = new_farm_name
                st.success("Nom sauvegardé avec succès ! (Rechargement...)")
                st.rerun()

    with tab1:
        with st.form("add_parcelle"):
            c1, c2, c3 = st.columns(3)
            n = c1.text_input("Nom Parcelle")
            s = c2.number_input("Surface (ha)")
            t = c3.selectbox("Culture", ["Blé", "Maïs", "Vigne", "Autre"])
            if st.form_submit_button("Ajouter"):
                db.ajouter_parcelle(user_id, n, s, t)
                st.success("Ajouté.")
                st.rerun()
        
        st.subheader("Parcelles existantes")
        st.dataframe(pd.DataFrame(db.obtenir_parcelles(user_id)), use_container_width=True, hide_index=True)
    
    with tab2:
        st.subheader("Gérer les Types de Produits")
        
        with st.form("add_product_type"):
            new_type = st.text_input("Nouveau type de produit")
            if st.form_submit_button("➕ Ajouter le type"):
                if new_type:
                    db.add_product_type(user_id, new_type)
                    st.success(f"Type '{new_type}' ajouté !")
                    st.rerun()
        
        st.subheader("Types existants")
        existing_types = db.get_product_types(user_id)
        for ptype in existing_types:
            col1, col2 = st.columns([4, 1])
            col1.write(f"🏷️ {ptype}")
            if col2.button("🗑️", key=f"del_{ptype}"):
                db.delete_product_type(user_id, ptype)
                st.rerun()
    
    with tab3:
        st.subheader("Statistiques")
        stats = db.get_user_stats(user_id)
        
        col1, col2, col3 = st.columns(3)
        col1.metric("Parcelles", stats.get('parcelles', 0))
        col2.metric("Produits", stats.get('produits', 0))
        col3.metric("Achats", stats.get('achats', 0))