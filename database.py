import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# --- AUTH (UNCHANGED AS REQUESTED) ---
def login_user(email, password):
    try:
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return response.user
    except Exception as e:
        return None

def create_user(email, password):
    try:
        response = supabase.auth.sign_up({"email": email, "password": password})
        return response.user
    except Exception as e:
        return None

# --- FARM NAME MANAGEMENT (NEW & FIXED) ---
def get_farm_name(user_id):
    try:
        # Try to fetch existing profile
        data = supabase.table("profiles").select("farm_name").eq("id", user_id).single().execute()
        if data.data:
            return data.data['farm_name']
        else:
            # If no profile exists yet, create default and return it
            supabase.table("profiles").insert({"id": user_id, "farm_name": "Ma Ferme"}).execute()
            return "Ma Ferme"
    except Exception:
        return "Ma Ferme"

def update_farm_name(user_id, new_name):
    try:
        # Use upsert to handle both insert (if missing) and update
        supabase.table("profiles").upsert({
            "id": user_id, 
            "farm_name": new_name
        }).execute()
        return True
    except Exception as e:
        print(e)
        return False

# --- EXISTING FUNCTIONS (UNCHANGED) ---
def get_dashboard_data(user_id):
    achats = supabase.table("achats")\
        .select("*, produits!achats_produit_id_fkey(nom, type_produit)")\
        .eq("user_id", user_id)\
        .execute().data

    traitements = supabase.table("traitements")\
        .select("*, produits!traitements_produit_id_fkey(nom, type_produit)")\
        .eq("user_id", user_id)\
        .execute().data
        
    produits = supabase.table("produits").select("*").eq("user_id", user_id).execute().data
    
    return achats, traitements, produits

def get_treatments_from_date(user_id, date_start):
    return supabase.table("traitements")\
        .select("*, produits!traitements_produit_id_fkey(nom, type_produit)")\
        .eq("user_id", user_id)\
        .gte("date_traitement", date_start)\
        .order("date_traitement", desc=True)\
        .execute().data

def obtenir_produits(user_id):
    return supabase.table("produits").select("*").eq("user_id", user_id).order("nom").execute().data

def obtenir_parcelles(user_id):
    return supabase.table("parcelles").select("*").eq("user_id", user_id).order("nom").execute().data

def ajouter_parcelle(user_id, nom, surface, culture):
    return supabase.table("parcelles").insert({
        "user_id": user_id, "nom": nom, "surface_ha": surface, "culture_type": culture
    }).execute()

def get_product_types(user_id):
    try:
        result = supabase.table("product_types").select("type_name").eq("user_id", user_id).execute()
        if result.data:
            return [r['type_name'] for r in result.data]
    except:
        pass
    return ["Herbicide", "Fongicide", "Insecticide", "Engrais", "Semence", "Autre"]

def add_product_type(user_id, type_name):
    try:
        return supabase.table("product_types").insert({
            "user_id": user_id,
            "type_name": type_name
        }).execute()
    except:
        return None

def delete_product_type(user_id, type_name):
    try:
        return supabase.table("product_types").delete()\
            .eq("user_id", user_id)\
            .eq("type_name", type_name)\
            .execute()
    except:
        return None

def get_user_stats(user_id):
    parcelles = len(supabase.table("parcelles").select("id").eq("user_id", user_id).execute().data)
    produits = len(supabase.table("produits").select("id").eq("user_id", user_id).execute().data)
    achats = len(supabase.table("achats").select("id").eq("user_id", user_id).execute().data)
    
    return {
        "parcelles": parcelles,
        "produits": produits,
        "achats": achats
    }

def enregistrer_achat_complet(data, user_id):
    prod_check = supabase.table("produits").select("*").eq("nom", data['nom']).eq("user_id", user_id).execute()
    
    if not prod_check.data:
        new_p = supabase.table("produits").insert({
            "nom": data['nom'], 
            "unite_reference": data['unite_ref'], 
            "stock_actuel": data['quantite'],
            "prix_moyen": data['prix_u_ht'],
            "type_produit": data.get('type_produit', 'Autre'),
            "user_id": user_id
        }).execute()
        prod_id = new_p.data[0]['id']
    else:
        curr = prod_check.data[0]
        prod_id = curr['id']
        old_stock = float(curr['stock_actuel'] or 0)
        old_price = float(curr['prix_moyen'] or 0)
        new_qty = float(data['quantite'])
        new_price = float(data['prix_u_ht'])
        
        total_stock = old_stock + new_qty
        if total_stock > 0:
            avg_price = ((old_stock * old_price) + (new_qty * new_price)) / total_stock
        else:
            avg_price = new_price

        supabase.table("produits").update({
            "stock_actuel": total_stock,
            "prix_moyen": avg_price,
            "type_produit": data.get('type_produit', curr.get('type_produit', 'Autre'))
        }).eq("id", prod_id).execute()

    total_ht = data['quantite'] * data['prix_u_ht']
    montant_tva = total_ht * (data['taux_tva'] / 100)
    
    return supabase.table("achats").insert({
        "user_id": user_id,
        "produit_id": prod_id, 
        "nom": data['nom'],
        "fournisseur": data['fournisseur'],
        "quantite_recue": data['quantite'],
        "unite_achat": data['unite_achat'],
        "prix_unitaire_ht": data['prix_u_ht'],
        "montant_tva": montant_tva,
        "montant_ttc": total_ht + montant_tva,
        "taux_tva": data['taux_tva'],
        "date_commande": data['date']
    }).execute()

def enregistrer_traitement_batch(liste_traitements):
    results = []
    for t in liste_traitements:
        prod_resp = supabase.table("produits").select("stock_actuel, prix_moyen").eq("id", t['produit_id']).single().execute()
        prod_data = prod_resp.data
        
        if prod_data:
            cout = float(t['quantite_utilisee']) * float(prod_data['prix_moyen'] or 0)
            t['cout_estime'] = cout
            
            new_stock = float(prod_data['stock_actuel'] or 0) - float(t['quantite_utilisee'])
            supabase.table("produits").update({"stock_actuel": new_stock}).eq("id", t['produit_id']).execute()
            
            results.append(t)
    
    if results:
        return supabase.table("traitements").insert(results).execute()
    return None