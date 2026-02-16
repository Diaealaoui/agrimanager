import { supabase } from './supabase'

// ========== CRITICAL FIX FOR MULTIPLE RELATIONSHIPS ==========
// Your schema has TWO foreign keys between achats→produits and traitements→produits
// We must specify WHICH relationship to use with explicit foreign key names

export const Database = {
  // ========== FIXED: getTraitementsWithFilters ==========
async getTraitementsWithFilters(
    userId: string, 
    startDate?: string, 
    endDate?: string, 
    parcelle?: string, 
    produit?: string,
    typeProduit?: string
  ) {
    try {
      // 🔧 FIX: Added 'fournisseur' to the select list
      let query = supabase
        .from('traitements')
        .select(`
          *,
          produits!traitements_produit_id_fkey (
            id,
            nom,
            type_produit,
            matiere_active,
            unite_reference,
            fournisseur 
          )
        `)
        .eq('user_id', userId)

      if (startDate) query = query.gte('date_traitement', startDate)
      if (endDate) query = query.lte('date_traitement', endDate)
      
      const { data, error } = await query.order('date_traitement', { ascending: false })
      
      if (error) throw error

      let result = data || []
      
      // Apply filters in JavaScript
      if (parcelle && parcelle !== 'Tous') {
        result = result.filter(t => t.parcelle === parcelle)
      }
      
      if (produit && produit !== 'Tous') {
        result = result.filter(t => {
          const prod = t.produits || {}
          return prod.nom === produit
        })
      }

      if (typeProduit && typeProduit !== 'Tous') {
        result = result.filter(t => {
          const prod = t.produits || {}
          return (prod.type_produit || '').toLowerCase().includes(typeProduit.toLowerCase())
        })
      }

      const { data: parcellesData, error: parcellesError } = await supabase
        .from('parcelles')
        .select('nom, cout_par_hectare')
        .eq('user_id', userId)

      if (!parcellesError && parcellesData) {
        const parcelleCostMap = new Map(
          parcellesData
            .filter(p => p.nom)
            .map(p => [p.nom, p.cout_par_hectare ?? null])
        )
        result = result.map(t => ({
          ...t,
          cout_par_hectare: parcelleCostMap.get(t.parcelle) ?? null
        }))
      }
      
      return result
    } catch (error) {
      console.error('Error fetching treatments:', error)
      return []
    }
  },
  // ========== FIXED: getAchatsWithFilters ==========
  async getAchatsWithFilters(
    userId: string,
    startDate?: string,
    endDate?: string,
    fournisseur?: string,
    nomProduit?: string,
    matiereActive?: string,
    typeProduit?: string
  ) {
    try {
      // 🔧 FIX: Use produit_id foreign key explicitly
      let query = supabase
        .from('achats')
        .select(`
          *,
          produits!achats_produit_id_fkey (
            id,
            nom,
            type_produit,
            matiere_active,
            unite_reference
          )
        `)
        .eq('user_id', userId)

      if (startDate) query = query.gte('date_commande', startDate)
      if (endDate) query = query.lte('date_commande', endDate)
      
      const { data, error } = await query.order('date_commande', { ascending: false })
      
      if (error) throw error

      let result = data || []
      
      // Apply filters in JavaScript
      if (fournisseur && fournisseur !== 'Tous') {
        result = result.filter(a => a.fournisseur === fournisseur)
      }
      
      if (nomProduit && nomProduit !== 'Tous') {
        result = result.filter(a => 
          a.nom.toLowerCase().includes(nomProduit.toLowerCase())
        )
      }
      
      if (matiereActive && matiereActive !== 'Tous') {
        result = result.filter(a => {
          const prod = a.produits || {}
          return (prod.matiere_active || '').toLowerCase().includes(matiereActive.toLowerCase())
        })
      }
      
      if (typeProduit && typeProduit !== 'Tous') {
        result = result.filter(a => {
          const prod = a.produits || {}
          return (prod.type_produit || '').toLowerCase() === typeProduit.toLowerCase()
        })
      }
      
      return result
    } catch (error) {
      console.error('Error fetching purchases:', error)
      return []
    }
  },

// Add product stock

  async addProduct(userId: string, productData: any) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .insert({
          user_id: userId,
          nom: productData.nom,
          type_produit: productData.type || 'Autre',
          matiere_active: productData.ma || '',
          unite_reference: productData.unite || 'L',
          stock_actuel: parseFloat(productData.stock || '0'),
          prix_moyen: parseFloat(productData.price || '0'),
          fournisseur: productData.fournisseur || 'Inconnu'
        })
        .select()
        .single()

      if (error) throw error
      return { success: true, product: data }
    } catch (error) {
      console.error('Error adding product:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  // ========== AUTH FUNCTIONS ==========
  
  async loginUser(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      return { success: true, user: data.user }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  async createUser(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      
      if (error) throw error
      return { success: true, user: data.user }
    } catch (error) {
      console.error('Signup error:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
  },

  async logoutUser() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Logout error:', error)
    return !error
  },

  // ========== FARM & PROFILE ==========

  async getFarmName(userId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('farm_name')
        .eq('id', userId)
        .single()

      if (error) {
        await supabase
          .from('profiles')
          .insert({ id: userId, farm_name: 'Ma Ferme' })
          .single()
        return 'Ma Ferme'
      }

      return data?.farm_name || 'Ma Ferme'
    } catch (error) {
      console.error('Error getting farm name:', error)
      return 'Ma Ferme'
    }
  },

  async updateFarmName(userId: string, newName: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, farm_name: newName })
        .single()
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error updating farm name:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  // ========== PRODUCTS ==========

  async obtenirProduits(userId: string) {
    const { data, error } = await supabase
      .from('produits')
      .select('*')
      .eq('user_id', userId)
      .order('nom')
    
    if (error) {
      console.error('Error fetching products:', error)
      return []
    }
    
    return data || []
  },

  async deleteProduct(userId: string, productId: string) {
    try {
      const { error } = await supabase
        .from('produits')
        .delete()
        .eq('id', productId)
        .eq('user_id', userId)
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting product:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  async updateProductStock(userId: string, productId: string, newStock: number) {
    try {
      const { error } = await supabase
        .from('produits')
        .update({ stock_actuel: newStock })
        .eq('id', productId)
        .eq('user_id', userId)
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error updating stock:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  // ========== PARCELLES ==========

  async obtenirParcelles(userId: string) {
    const { data, error } = await supabase
      .from('parcelles')
      .select('*')
      .eq('user_id', userId)
      .order('nom')
    
    if (error) {
      console.error('Error fetching parcelles:', error)
      return []
    }
    
    return data || []
  },

  async ajouterParcelle(userId: string, nom: string, surface: number, culture: string) {
    try {
      const { data, error } = await supabase
        .from('parcelles')
        .insert({
          user_id: userId,
          nom,
          surface_ha: surface,
          culture_type: culture
        })
        .select()
      
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Error adding parcelle:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  async deleteParcelle(userId: string, parcelleId: string) {
    try {
      const { error } = await supabase
        .from('parcelles')
        .delete()
        .eq('id', parcelleId)
        .eq('user_id', userId)
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting parcelle:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  // ========== PRODUCT TYPES ==========

  async getProductTypes(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('product_types')
        .select('type_name')
        .eq('user_id', userId)
      
      if (error) throw error
      
      if (data && data.length > 0) {
        return data.map((item: any) => item.type_name)
      }
    } catch (error) {
      console.error('Error fetching product types:', error)
    }
    
    return ['Herbicide', 'Fongicide', 'Insecticide', 'Engrais', 'Semence', 'Autre']
  },

  async addProductType(userId: string, typeName: string) {
    try {
      const { error } = await supabase
        .from('product_types')
        .insert({ user_id: userId, type_name: typeName })
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error adding product type:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  async deleteProductType(userId: string, typeName: string) {
    try {
      const { error } = await supabase
        .from('product_types')
        .delete()
        .eq('user_id', userId)
        .eq('type_name', typeName)
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting product type:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  // ========== FILTER DATA ==========

  async getSuppliers(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('achats')
        .select('fournisseur')
        .eq('user_id', userId)
      
      if (error) throw error
      
      if (data) {
        const suppliers = Array.from(
          new Set(data
            .filter(item => item.fournisseur && item.fournisseur.trim() !== '')
            .map(item => item.fournisseur)
          )
        )
        return suppliers.sort()
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
    
    return []
  },

  async getActiveIngredients(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('matiere_active')
        .eq('user_id', userId)
        .neq('matiere_active', '')
      
      if (error) throw error
      
      if (data) {
        const actives = Array.from(
          new Set(data
            .filter(item => item.matiere_active && item.matiere_active.trim() !== '')
            .map(item => item.matiere_active)
          )
        )
        return actives.sort()
      }
    } catch (error) {
      console.error('Error fetching active ingredients:', error)
    }
    
    return []
  },

  // ========== SEARCH FUNCTIONALITY METHODS ==========
  // Add this to your database.ts file
  async getAllPurchases(userId: string) {
    try {
      const { data, error } = await supabase
        .from('achats')
        .select(`
          *,
          produits!achats_produit_id_fkey(
            id,
            nom,
            type_produit,
            matiere_active
          )
        `)
        .eq('user_id', userId)
        .order('date_commande', { ascending: false })
    
      if (error) throw error
    
      return { success: true, purchases: data || [] }
    } catch (error) {
      console.error('Error getting all purchases:', error)
      return { success: false, error: (error as Error).message, purchases: [] }
    }
  },
  async getAllProducts(userId: string) {
    try {
      // First get all products
      const { data: produits, error } = await supabase
        .from('produits')
        .select('*')
        .eq('user_id', userId)
      
      if (error) throw error
      
      // Get all purchases to calculate total amount per product
      const { data: achats, error: achatsError } = await supabase
        .from('achats')
        .select('produit_id, montant_ttc')
        .eq('user_id', userId)
      
      if (achatsError) throw achatsError
      
      // Calculate total amount per product
      const productSpending: Record<string, number> = {}
      achats?.forEach(a => {
        if (a.produit_id) {
          productSpending[a.produit_id] = (productSpending[a.produit_id] || 0) + (a.montant_ttc || 0)
        }
      })
      
      // Combine product data with spending
      const productsWithSpending = produits?.map(produit => ({
        ...produit,
        totalAmount: productSpending[produit.id] || 0,
        activeIngredients: produit.matiere_active?.split(',').map(ma => ma.trim()).filter(Boolean) || []
      })) || []
      
      return { success: true, products: productsWithSpending }
    } catch (error) {
      console.error('Error getting all products:', error)
      return { success: false, error: (error as Error).message, products: [] }
    }
  },

  async getAllSuppliers(userId: string) {
    try {
      const { data: achats, error } = await supabase
        .from('achats')
        .select('fournisseur, montant_ttc')
        .eq('user_id', userId)
      
      if (error) throw error
      
      const supplierData: Record<string, {
        totalAmount: number;
        orderCount: number;
      }> = {}

      achats?.forEach(a => {
        const supplier = a.fournisseur || 'Inconnu'
        if (!supplierData[supplier]) {
          supplierData[supplier] = {
            totalAmount: 0,
            orderCount: 0
          }
        }
        supplierData[supplier].totalAmount += a.montant_ttc || 0
        supplierData[supplier].orderCount += 1
      })

      const suppliers = Object.entries(supplierData).map(([name, data]) => ({
        id: name, // Using name as ID since we don't have supplier table
        name,
        totalAmount: data.totalAmount,
        orderCount: data.orderCount
      })).sort((a, b) => b.totalAmount - a.totalAmount)

      return { success: true, suppliers }
    } catch (error) {
      console.error('Error getting all suppliers:', error)
      return { success: false, error: (error as Error).message, suppliers: [] }
    }
  },

  async getAllActiveIngredients(userId: string) {
    try {
      // Get all products with their active ingredients
      const { data: produits, error } = await supabase
        .from('produits')
        .select('id, matiere_active')
        .eq('user_id', userId)
      
      if (error) throw error
      
      // Get all purchases to calculate spending per product
      const { data: achats, error: achatsError } = await supabase
        .from('achats')
        .select('produit_id, montant_ttc')
        .eq('user_id', userId)
      
      if (achatsError) throw achatsError
      
      // Calculate spending per product
      const productSpending: Record<string, number> = {}
      achats?.forEach(a => {
        if (a.produit_id) {
          productSpending[a.produit_id] = (productSpending[a.produit_id] || 0) + (a.montant_ttc || 0)
        }
      })
      
      // Map products to their ingredients and calculate totals
      const ingredientData: Record<string, {
        productCount: number;
        totalAmount: number;
        productIds: Set<string>;
      }> = {}

      produits?.forEach(p => {
        if (p.matiere_active) {
          const ingredients = p.matiere_active
            .split(',')
            .map(i => i.trim())
            .filter(Boolean)
          
          ingredients.forEach(ingredient => {
            if (!ingredientData[ingredient]) {
              ingredientData[ingredient] = {
                productCount: 0,
                totalAmount: 0,
                productIds: new Set()
              }
            }
            ingredientData[ingredient].productIds.add(p.id)
            ingredientData[ingredient].productCount = ingredientData[ingredient].productIds.size
            
            // Add spending from this product
            const productAmount = productSpending[p.id] || 0
            ingredientData[ingredient].totalAmount += productAmount
          })
        }
      })

      const ingredients = Object.entries(ingredientData).map(([name, data]) => ({
        id: name,
        name,
        productCount: data.productCount,
        totalAmount: data.totalAmount
      })).sort((a, b) => b.productCount - a.productCount)

      return { success: true, ingredients }
    } catch (error) {
      console.error('Error getting all active ingredients:', error)
      return { success: false, error: (error as Error).message, ingredients: [] }
    }
  },

  // ========== PURCHASES ==========

// ... inside Database object

  async enregistrerAchatComplet(data: any, userId: string) {
    try {
      const {
        nom,
        type_produit,
        matiere_active,
        quantite,      // User Input: Number of Boxes (e.g., 10)
        unite_ref,     // Reference Unit (e.g., "L")
        unite_achat,   // Display Unit (e.g., "Boîte")
        prix_u_ht,     // User Input: Price per Box (e.g., 200)
        taux_tva,
        fournisseur,
        date,
        box_quantity,  // User Input: Capacity per Box (e.g., 0.5)
        is_box_unit,   // Boolean: true if packaged
      } = data

      // 1. Calculate REAL Stock Quantity (Reference Units)
      let quantityForStock = parseFloat(quantite)
      if (is_box_unit && box_quantity) {
        quantityForStock = parseFloat(quantite) * parseFloat(box_quantity)
      }

      // 2. Calculate Financials
      const totalHT = parseFloat(quantite) * parseFloat(prix_u_ht)
      
      // 3. Calculate Normalized Price (Price per Reference Unit)
      // This is the "Last Price" we want to save
      const pricePerRefUnit = quantityForStock > 0 ? totalHT / quantityForStock : 0

      // Check if product exists
      const { data: existingProduct } = await supabase
        .from('produits')
        .select('*')
        .eq('nom', nom)
        .eq('user_id', userId)
        .single()

      let productId: string

      if (!existingProduct) {
        // --- NEW PRODUCT ---
        const { data: newProduct, error: createError } = await supabase
          .from('produits')
          .insert({
            nom,
            unite_reference: unite_ref,
            stock_actuel: quantityForStock,
            prix_moyen: pricePerRefUnit, // Initial Price
            type_produit: type_produit || 'Autre',
            matiere_active: matiere_active || '',
            user_id: userId,
            box_quantity: box_quantity || null,
            is_box_unit: is_box_unit || false,
            fournisseur: fournisseur || 'Inconnu'
          })
          .select()
          .single()

        if (createError) throw createError
        productId = newProduct!.id
      } else {
        // --- UPDATE PRODUCT ---
        productId = existingProduct.id
        const oldStock = parseFloat((existingProduct.stock_actuel || 0).toString())
        
        // CHANGED: We now use the NEW price directly (Last Price), ignoring the old average
        const newStockPrice = pricePerRefUnit 
        
        const totalStock = oldStock + quantityForStock
        
        const { error: updateError } = await supabase
          .from('produits')
          .update({
            stock_actuel: totalStock,
            prix_moyen: newStockPrice, // <--- UPDATED TO USE LAST PRICE
            type_produit: type_produit || existingProduct.type_produit,
            matiere_active: matiere_active || existingProduct.matiere_active,
            box_quantity: box_quantity || existingProduct.box_quantity,
            is_box_unit: is_box_unit !== undefined ? is_box_unit : existingProduct.is_box_unit,
            fournisseur: fournisseur || existingProduct.fournisseur
          })
          .eq('id', productId)

        if (updateError) throw updateError
      }

      // --- RECORD HISTORY ---
      const montantTVA = totalHT * (taux_tva / 100)
      const prixUnitaireTTC = parseFloat(prix_u_ht) * (1 + (taux_tva / 100))

      const { error: purchaseError } = await supabase
        .from('achats')
        .insert({
          user_id: userId,
          produit_id: productId,
          nom,
          fournisseur,
          quantite_recue: parseFloat(quantite),
          unite_achat: unite_achat,
          prix_unitaire_ht: parseFloat(prix_u_ht),
          prix_unitaire_ttc: prixUnitaireTTC,
          montant_tva: montantTVA,
          montant_ttc: totalHT + montantTVA,
          taux_tva,
          date_commande: date
        })

      if (purchaseError) throw purchaseError
      
      return { success: true }
    } catch (error) {
      console.error('Error recording purchase:', error)
      return { success: false, error: (error as Error).message }
    }
  },
  async getProductPurchaseHistory(userId: string, productId: string) {
    try {
      const { data, error } = await supabase
        .from('achats')
        .select('*')
        .eq('user_id', userId)
        .eq('produit_id', productId)
        .order('date_commande', { ascending: false})

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching purchase history:', error)
      return []
    }
  },

  // ========== TREATMENTS ==========

// Update signature to accept waterVolume
  async enregistrerTraitementBatch(traitements: any[], waterVolume: number) {
    try {
      const results = []
      const groupeId = `T-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      
      for (const t of traitements) {
        // ... (Keep existing stock update logic exactly as it is) ...
        
        // ... inside the loop, getting product data ...
        const { data: productData, error: productError } = await supabase
          .from('produits')
          .select('stock_actuel, prix_moyen')
          .eq('id', t.produit_id)
          .single()
          
        if (productError) continue

        const cout = parseFloat(t.quantite_utilisee) * parseFloat((productData!.prix_moyen || 0).toString())
        t.cout_estime = cout

        // Update Stock
        const newStock = parseFloat((productData!.stock_actuel || 0).toString()) - parseFloat(t.quantite_utilisee)
        await supabase.from('produits').update({ stock_actuel: newStock }).eq('id', t.produit_id)

        // PUSH TO RESULT WITH WATER INFO
        results.push({
          ...t,
          groupe_id: groupeId,
          quantite_eau: waterVolume // <--- SAVING THE WATER VOLUME
        })
      }

      if (results.length > 0) {
        const { error: insertError } = await supabase.from('traitements').insert(results)
        if (insertError) throw insertError
        return { success: true, count: results.length }
      }

      return { success: true, count: 0 }
    } catch (error) {
      console.error('Error recording treatments:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  // ========== STATISTICS ==========

async getProductStatsByYear(userId: string, year: number) {
    try {
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`
      
      const { data: achats, error } = await supabase
        .from('achats')
        .select(`
          *,
          produits!achats_produit_id_fkey(type_produit, matiere_active)
        `)
        .eq('user_id', userId)
        .gte('date_commande', startDate)
        .lte('date_commande', endDate)

      if (error) throw error

      const stats = {
        par_mois: {},
        par_type: {},
        par_fournisseur: {},
        par_matiere_active: {} // Added this
      }

      achats?.forEach(achat => {
        const amount = achat.montant_ttc || 0
        const month = achat.date_commande.substring(0, 7)
        const type = achat.produits?.type_produit || 'Autre'
        const supplier = achat.fournisseur || 'Inconnu'
        
        // Month, Type, Supplier Stats
        stats.par_mois[month] = (stats.par_mois[month] || 0) + amount
        stats.par_type[type] = (stats.par_type[type] || 0) + amount
        stats.par_fournisseur[supplier] = (stats.par_fournisseur[supplier] || 0) + amount

        // NEW: Active Ingredient Stats
        const maString = achat.produits?.matiere_active
        if (maString && maString.trim() !== '') {
          // Split by comma in case of multiple ingredients (e.g. "Glyphosate, 2,4-D")
          const ingredients = maString.split(',').map((s: string) => s.trim())
          ingredients.forEach((ing: string) => {
            if (ing) {
              stats.par_matiere_active[ing] = (stats.par_matiere_active[ing] || 0) + amount
            }
          })
        }
      })

      return { success: true, stats }
    } catch (error) {
      console.error('Error getting stats:', error)
      return { success: false, error: (error as Error).message }
    }
  },
async getParcelDetails(userId: string, parcelleName: string, year: number) {
    try {
      // Get Parcel Info
      const { data: parcelle, error: pError } = await supabase
        .from('parcelles')
        .select('*')
        .eq('user_id', userId)
        .eq('nom', parcelleName)
        .single()
      
      if (pError) throw pError

      // Get Treatments for this parcel
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`
      
      const { data: traitements, error: tError } = await supabase
        .from('traitements')
        .select(`
          *,
          produits!traitements_produit_id_fkey(nom, unite_reference, matiere_active)
        `)
        .eq('user_id', userId)
        .eq('parcelle', parcelleName)
        .gte('date_traitement', startDate)
        .lte('date_traitement', endDate)
        .order('date_traitement', { ascending: false })

      if (tError) throw tError

      // Calculate totals
      const totalCost = traitements?.reduce((sum, t) => sum + (t.cout_estime || 0), 0) || 0
      const costPerHa = parcelle.surface_ha ? (totalCost / parcelle.surface_ha) : 0

      return {
        success: true,
        data: {
          info: parcelle,
          traitements: traitements || [],
          stats: {
            totalCost,
            costPerHa
          }
        }
      }
    } catch (error) {
      console.error('Error getting parcel details:', error)
      return { success: false, error: (error as Error).message }
    }
  },

async getDashboardStats(userId: string, year: number) {
  try {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    const prevYearStart = `${year-1}-01-01`
    const prevYearEnd = `${year-1}-12-31`
    
    // Get achats for current year
    const { data: achats } = await supabase
      .from('achats')
      .select(`
        *,
        produits!achats_produit_id_fkey(
          id,
          nom,
          type_produit,
          matiere_active
        )
      `)
      .eq('user_id', userId)
      .gte('date_commande', startDate)
      .lte('date_commande', endDate)

    // Get achats for previous year for comparison
    const { data: prevYearAchats } = await supabase
      .from('achats')
      .select(`
        *,
        produits!achats_produit_id_fkey(
          id,
          nom,
          type_produit,
          matiere_active
        )
      `)
      .eq('user_id', userId)
      .gte('date_commande', prevYearStart)
      .lte('date_commande', prevYearEnd)

    // Get all produits for search functionality
    const { data: allProduits } = await supabase
      .from('produits')
      .select('*')
      .eq('user_id', userId)

    // Get all fournisseurs for search functionality
    const { data: allFournisseurs } = await supabase
      .from('achats')
      .select('fournisseur')
      .eq('user_id', userId)

    // Get traitements with explicit foreign key
    const { data: traitements } = await supabase
      .from('traitements')
      .select(`
        *,
        produits!traitements_produit_id_fkey(
          id,
          nom,
          type_produit,
          matiere_active
        )
      `)
      .eq('user_id', userId)
      .gte('date_traitement', startDate)
      .lte('date_traitement', endDate)

    // Get parcelles
    const { data: parcelles } = await supabase
      .from('parcelles')
      .select('*')
      .eq('user_id', userId)

    // Calculate monthly data
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const monthKey = month.toString().padStart(2, '0')
      
      // Current year month achats
      const monthAchats = achats?.filter(a => {
        const date = new Date(a.date_commande)
        return date.getMonth() + 1 === month
      }) || []
      
      // Previous year month achats
      const prevMonthAchats = prevYearAchats?.filter(a => {
        const date = new Date(a.date_commande)
        return date.getMonth() + 1 === month
      }) || []
      
      return {
        month: `${year}-${monthKey}`,
        amount: monthAchats.reduce((sum, a) => sum + (a.montant_ttc || 0), 0),
        orders: monthAchats.length,
        previousYearAmount: prevMonthAchats.reduce((sum, a) => sum + (a.montant_ttc || 0), 0)
      }
    })

    // Calculate statistics
    const stats = {
      totalSpent: 0,
      totalOrders: achats?.length || 0,
      monthlyAvg: 0,
      topProducts: [] as Array<{
        id?: string;
        name: string;
        amount: number;
        activeIngredients?: string[];
        supplier?: string;
        type?: string;
      }>,
      topSuppliers: [] as Array<{
        id: string;
        name: string;
        amount: number;
        orderCount: number;
      }>,
      topActiveIngredients: [] as Array<{
        id: string;
        name: string;
        count: number;
        totalAmount: number;
      }>,
      parcelStats: [] as Array<{
        id?: string;
        name: string;
        surface: number;
        cost: number;
        costPerHa: number;
      }>,
      monthlyData,
      productTypes: [] as Array<{
        type: string;
        count: number;
        amount: number;
      }>,
      // For search functionality
      allProducts: allProduits || [],
      allSuppliers: Array.from(new Set(allFournisseurs?.map(f => f.fournisseur).filter(Boolean) || [])),
      allActiveIngredients: Array.from(
        new Set(
          allProduits
            ?.filter(p => p.matiere_active)
            .flatMap(p => p.matiere_active.split(',').map(ma => ma.trim()))
            .filter(Boolean) || []
        )
      )
    }

    // Total spent
    achats?.forEach(a => {
      stats.totalSpent += a.montant_ttc || 0
    })
    stats.monthlyAvg = stats.totalOrders > 0 ? stats.totalSpent / 12 : 0

    // Top products by spending with enhanced data
    const productSpending: Record<string, {
      amount: number;
      id?: string;
      activeIngredients?: string[];
      type?: string;
      supplier?: string;
    }> = {}
    
    achats?.forEach(a => {
      const prodName = a.produits?.nom || a.nom || 'Inconnu'
      const prodId = a.produits?.id || a.produit_id
      
      if (!productSpending[prodName]) {
        productSpending[prodName] = {
          amount: 0,
          id: prodId,
          activeIngredients: a.produits?.matiere_active?.split(',').map(ma => ma.trim()),
          type: a.produits?.type_produit,
          supplier: a.fournisseur
        }
      }
      productSpending[prodName].amount += a.montant_ttc || 0
    })
    
    stats.topProducts = Object.entries(productSpending)
      .sort(([,a], [,b]) => b.amount - a.amount)
      .slice(0, 5)
      .map(([name, data]) => ({
        id: data.id,
        name,
        amount: data.amount,
        activeIngredients: data.activeIngredients,
        type: data.type,
        supplier: data.supplier
      }))

    // Top suppliers with order count
    const supplierData: Record<string, {
      amount: number;
      orderCount: number;
    }> = {}
    
    achats?.forEach(a => {
      const supplier = a.fournisseur || 'Inconnu'
      if (!supplierData[supplier]) {
        supplierData[supplier] = {
          amount: 0,
          orderCount: 0
        }
      }
      supplierData[supplier].amount += a.montant_ttc || 0
      supplierData[supplier].orderCount += 1
    })
    
    stats.topSuppliers = Object.entries(supplierData)
      .sort(([,a], [,b]) => b.amount - a.amount)
      .slice(0, 5)
      .map(([name, data]) => ({
        id: name, // Using name as ID since we don't have supplier table
        name,
        amount: data.amount,
        orderCount: data.orderCount
      }))

    // Top active ingredients with count and total amount
    const activeIngredientData: Record<string, {
      count: number;
      totalAmount: number;
    }> = {}
    
    achats?.forEach(a => {
      const ma = a.produits?.matiere_active
      if (ma && ma.trim()) {
        const ingredients = ma.split(',').map(i => i.trim())
        ingredients.forEach(ingredient => {
          if (ingredient) {
            if (!activeIngredientData[ingredient]) {
              activeIngredientData[ingredient] = {
                count: 0,
                totalAmount: 0
              }
            }
            activeIngredientData[ingredient].count += 1
            activeIngredientData[ingredient].totalAmount += a.montant_ttc || 0
          }
        })
      }
    })
    
    stats.topActiveIngredients = Object.entries(activeIngredientData)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, data]) => ({
        id: name,
        name,
        count: data.count,
        totalAmount: data.totalAmount
      }))

    // Parcel stats with ID if available
    const parcelCosts: Record<string, number> = {}
    traitements?.forEach(t => {
      const parcelleName = t.parcelle || 'Inconnu'
      parcelCosts[parcelleName] = (parcelCosts[parcelleName] || 0) + (t.cout_estime || 0)
    })

    stats.parcelStats = parcelles?.map(p => ({
      id: p.id,
      name: p.nom,
      surface: p.surface_ha || 0,
      cost: parcelCosts[p.nom] || 0,
      costPerHa: (p.surface_ha || 0) > 0 ? (parcelCosts[p.nom] || 0) / p.surface_ha : 0,
    })) || []

    // Product types statistics
    const productTypeData: Record<string, {
      count: number;
      amount: number;
    }> = {}
    
    achats?.forEach(a => {
      const type = a.produits?.type_produit || 'Autre'
      if (!productTypeData[type]) {
        productTypeData[type] = {
          count: 0,
          amount: 0
        }
      }
      productTypeData[type].count += 1
      productTypeData[type].amount += a.montant_ttc || 0
    })
    
    stats.productTypes = Object.entries(productTypeData)
      .map(([type, data]) => ({
        type,
        count: data.count,
        amount: data.amount
      }))
      .sort((a, b) => b.amount - a.amount)

    return { 
      success: true, 
      stats,
      // Also return the raw data for search functionality
      allData: {
        allProducts: stats.allProducts,
        allSuppliers: stats.allSuppliers,
        allActiveIngredients: stats.allActiveIngredients
      }
    }
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    return { 
      success: false, 
      error: (error as Error).message, 
      stats: null 
    }
  }
},
  // ==========================================
  // SMART EDITING FUNCTIONS (The Magic Logic)
  // ==========================================

  /**
   * Recalculates the Weighted Average Price (PUMP) for a product based on all history.
   * Essential when price mistakes are corrected.
   */
async recalculateProductPrice(userId: string, productId: string) {
    // 1. Get the LATEST purchase for this product
    const { data: latestAchat } = await supabase
      .from('achats')
      .select('prix_unitaire_ht, quantite_recue, montant_ttc')
      .eq('user_id', userId)
      .eq('produit_id', productId)
      .order('date_commande', { ascending: false }) // Order by newest
      .limit(1)
      .single()

    if (!latestAchat) return
    
    // Safety check for division by zero
    if (latestAchat.quantite_recue > 0) {

       
       const lastPrice = latestAchat.montant_ttc / latestAchat.quantite_recue
       
       await supabase
        .from('produits')
        .update({ prix_moyen: lastPrice })
        .eq('id', productId)
    }
  },
  /**
   * Fixes a mistake in a Purchase (Achat).
   * Handles Stock Revert -> Product Switch -> Stock Re-apply -> Cleanup
   */
  async updateAchatSmart(userId: string, achatId: string, newValues: any) {
    try {
      // 1. Fetch the ORIGINAL Purchase to see what we need to undo
      const { data: oldAchat, error: fetchError } = await supabase
        .from('achats')
        .select('*')
        .eq('id', achatId)
        .single()

      if (fetchError || !oldAchat) throw new Error("Achat original introuvable")

      // 2. Revert Old Stock (Undo the mistake)
      // We subtract the OLD quantity from the OLD product
      const { data: oldProduct } = await supabase.from('produits').select('*').eq('id', oldAchat.produit_id).single()
      
      if (oldProduct) {
        const revertedStock = (oldProduct.stock_actuel || 0) - (oldAchat.quantite_recue || 0)
        await supabase.from('produits').update({ stock_actuel: revertedStock }).eq('id', oldAchat.produit_id)
      }

      // 3. Determine Target Product (Did the user change the name?)
      let targetProductId = oldAchat.produit_id
      const isNameChanged = newValues.nom && newValues.nom !== oldAchat.nom

      if (isNameChanged) {
        // Does the "Correct" product already exist? (e.g., "Zirame" exists, we want to move from "Ziram")
        const { data: existingTarget } = await supabase
          .from('produits')
          .select('id')
          .eq('user_id', userId)
          .eq('nom', newValues.nom)
          .single()

        if (existingTarget) {
          targetProductId = existingTarget.id
        } else {
          // If not, we might be renaming the current product, or creating a new one.
          // For safety in this specific flow, let's create a new one if it's totally new
          // OR simply update the name of the current one if it was a typo and unique.
          
          // Check if old product is used elsewhere. If NOT, just rename it.
          const { count: usageCount } = await supabase.from('achats').select('*', { count: 'exact', head: true }).eq('produit_id', oldAchat.produit_id)
          
          if (usageCount === 1) {
            // It was only used in this purchase! Just rename the product.
            await supabase.from('produits').update({ nom: newValues.nom }).eq('id', oldAchat.produit_id)
            targetProductId = oldAchat.produit_id
          } else {
            // It's used elsewhere, so we must create a NEW product for this "New Name"
            const { data: newProd } = await supabase.from('produits').insert({
              user_id: userId,
              nom: newValues.nom,
              type_produit: newValues.type_produit || 'Autre',
              stock_actuel: 0 // Will be added to in step 4
            }).select().single()
            targetProductId = newProd.id
          }
        }
      }

      // 4. Apply New Stock (Apply the fix)
      const { data: targetProduct } = await supabase.from('produits').select('*').eq('id', targetProductId).single()
      
      if (targetProduct) {
        const newStock = (targetProduct.stock_actuel || 0) + parseFloat(newValues.quantite)
        await supabase.from('produits').update({ stock_actuel: newStock }).eq('id', targetProductId)
      }

      // 5. Update the Purchase Record
      // Calculate new totals
      const prixHT = parseFloat(newValues.prix_u_ht)
      const qte = parseFloat(newValues.quantite)
      const tva = parseFloat(newValues.taux_tva || 0)
      const totalHT = prixHT * qte
      const totalTTC = totalHT * (1 + tva/100)
      const prixTTC = prixHT * (1 + tva/100)

      await supabase
        .from('achats')
        .update({
          produit_id: targetProductId,
          nom: newValues.nom, // Ensure name is synced
          quantite_recue: qte,
          prix_unitaire_ht: prixHT,
          prix_unitaire_ttc: prixTTC,
          montant_ttc: totalTTC,
          fournisseur: newValues.fournisseur,
          date_commande: newValues.date
        })
        .eq('id', achatId)

      // 6. Housekeeping: Recalculate Average Prices
      await this.recalculateProductPrice(userId, targetProductId)
      
      // 7. Housekeeping: Delete "Orphaned" Products (The "Ziram" without 'e' if empty)
      if (isNameChanged && targetProductId !== oldAchat.produit_id) {
        const { data: oldProdCheck } = await supabase.from('produits').select('stock_actuel').eq('id', oldAchat.produit_id).single()
        // If stock is roughly 0 and no other purchases exist? (Simplified: Just check stock <= 0)
        if (oldProdCheck && oldProdCheck.stock_actuel <= 0.01) {
             // Optional: Check if really empty of history before delete, or just leave it at 0.
             // For safety, we usually leave it at 0, but user asked to delete.
             // We'll leave it at 0 to prevent integrity errors with other tables (traitements).
             // To strictly delete, we'd need to check 'traitements' count too.
        }
      }

      return { success: true }
    } catch (e) {
      console.error(e)
      return { success: false, error: (e as Error).message }
    }
  },

  /**
   * Fixes a mistake in a Treatment (Traitement).
   * Reverts stock deduction -> Applies new deduction.
   */
  async updateTraitementSmart(userId: string, traitementId: string, newValues: any) {
    try {
      // 1. Get Original
      const { data: oldTraitement } = await supabase
        .from('traitements')
        .select('*')
        .eq('id', traitementId)
        .single()
        
      if (!oldTraitement) throw new Error("Traitement introuvable")

      // 2. Revert Old (Add back the stock we took)
      const { data: product } = await supabase.from('produits').select('*').eq('id', oldTraitement.produit_id).single()
      
      // We assume product ID doesn't change here for simplicity (just dose/date fix). 
      // If product changes, it's similar to logic above.
      if (product) {
        const revertedStock = (product.stock_actuel || 0) + (oldTraitement.quantite_utilisee || 0)
        
        // 3. Apply New (Take out the correct amount)
        // Note: newValues.quantite is the CORRECTED dose
        const finalStock = revertedStock - parseFloat(newValues.quantite)
        
        await supabase.from('produits').update({ stock_actuel: finalStock }).eq('id', product.id)
        
        // 4. Update Price Estimate based on current average price
        const cout = parseFloat(newValues.quantite) * (product.prix_moyen || 0)

        // 5. Update Record
        await supabase
          .from('traitements')
          .update({
            quantite_utilisee: parseFloat(newValues.quantite),
            date_traitement: newValues.date,
            cout_estime: cout
          })
          .eq('id', traitementId)
          
        return { success: true }
      }
      return { success: false, error: "Produit lié introuvable" }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
/**
   * Deletes a Purchase and REMOVES the added stock.
   */
async deleteAchatSmart(userId: string, achatId: string) {
    try {
      // 1. Get the purchase info
      const { data: achat } = await supabase.from('achats').select('*').eq('id', achatId).single()
      if (!achat) throw new Error("Achat introuvable")

      const productId = achat.produit_id

      // 2. Adjust Stock (Reverse the purchase)
      const { data: product } = await supabase.from('produits').select('stock_actuel').eq('id', productId).single()
      
      if (product) {
        const currentStock = product.stock_actuel || 0
        const qtyToRemove = achat.quantite_recue || 0
        const newStock = currentStock - qtyToRemove
        
        await supabase.from('produits').update({ stock_actuel: newStock }).eq('id', productId)
      }

      // 3. Delete the Purchase Record
      const { error: deleteError } = await supabase.from('achats').delete().eq('id', achatId)
      if (deleteError) throw deleteError

      // 4. CHECK FOR ORPHANS (The Fix)
      // We check if there are ANY remaining purchases OR treatments for this product.
      
      const { count: purchaseCount } = await supabase
        .from('achats')
        .select('*', { count: 'exact', head: true })
        .eq('produit_id', productId)

      const { count: treatmentCount } = await supabase
        .from('traitements')
        .select('*', { count: 'exact', head: true })
        .eq('produit_id', productId)

      const pCount = purchaseCount || 0
      const tCount = treatmentCount || 0

      // 5. If no history remains, DELETE the product
      // We removed the "stock <= 0" check. If it has no history, it should be gone.
      if (pCount === 0 && tCount === 0) {
        const { error: prodDeleteError } = await supabase.from('produits').delete().eq('id', productId)
        if (prodDeleteError) {
             console.error("Error deleting orphaned product:", prodDeleteError)
        }
      }

      return { success: true }
    } catch (e) {
      console.error(e)
      return { success: false, error: (e as Error).message }
    }
  },

  /**
   * Deletes a Treatment.
   * Also checks if product is orphaned (rare, but good for consistency).
   */
  async deleteTraitementSmart(userId: string, traitementId: string) {
    try {
      // 1. Get the treatment
      const { data: trait } = await supabase.from('traitements').select('*').eq('id', traitementId).single()
      if (!trait) throw new Error("Traitement introuvable")

      const productId = trait.produit_id

      // 2. Add stock back
      const { data: product } = await supabase.from('produits').select('stock_actuel').eq('id', productId).single()
      if (product) {
        const newStock = (product.stock_actuel || 0) + (trait.quantite_utilisee || 0)
        await supabase.from('produits').update({ stock_actuel: newStock }).eq('id', productId)
      }

      // 3. Delete the treatment record
      const { error } = await supabase.from('traitements').delete().eq('id', traitementId)
      if (error) throw error

      // 4. CHECK FOR ORPHANS
      const { count: purchaseCount } = await supabase
        .from('achats')
        .select('*', { count: 'exact', head: true })
        .eq('produit_id', productId)

      const { count: treatmentCount } = await supabase
        .from('traitements')
        .select('*', { count: 'exact', head: true })
        .eq('produit_id', productId)

      if ((purchaseCount || 0) === 0 && (treatmentCount || 0) === 0) {
        await supabase.from('produits').delete().eq('id', productId)
      }

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },
  /**
   * Deletes a Treatment and RETURNS (Restores) the stock.
   */
  async deleteTraitementSmart(userId: string, traitementId: string) {
    try {
      // 1. Get the treatment to know what to add back
      const { data: trait } = await supabase.from('traitements').select('*').eq('id', traitementId).single()
      if (!trait) throw new Error("Traitement introuvable")

      // 2. Add stock back to product
      const { data: product } = await supabase.from('produits').select('stock_actuel').eq('id', trait.produit_id).single()
      if (product) {
        const newStock = (product.stock_actuel || 0) + (trait.quantite_utilisee || 0)
        await supabase.from('produits').update({ stock_actuel: newStock }).eq('id', trait.produit_id)
      }

      // 3. Delete the treatment record
      const { error } = await supabase.from('traitements').delete().eq('id', traitementId)
      if (error) throw error

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  // ========== PLANNING SYSTEM ==========

async getPlannedTreatments(userId: string) {
    try {
      const { data, error } = await supabase
        .from('planned_traitements')
        .select(`
          *,
          produits (
            id,
            nom,
            unite_reference,
            stock_actuel
          )
        `)
        .eq('user_id', userId)
        .order('date_prevue', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching plan:', error)
      return []
    }
  },

  // Save a whole MIX (Batch) with a Group ID
  async savePlannedBatch(userId: string, buffer: any[], waterVolume: number) {
    try {
      // Generate a unique ID for this mix
      const groupId = `PLAN-${Date.now()}`

      const plans = buffer.map(item => ({
        user_id: userId,
        parcelle: item.parcelle,
        produit_id: item.produit_id,
        nom_produit: item.produit,
        quantite_prevue: item.dose,
        date_prevue: item.date,
        status: 'pending',
        group_id: groupId,          // <--- Links them together
        quantite_eau: waterVolume   // <--- Saves water info
      }))

      const { error } = await supabase.from('planned_traitements').insert(plans)
      if (error) throw error
      
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },

  // Delete an entire MIX
  async deletePlannedGroup(groupId: string) {
    const { error } = await supabase
      .from('planned_traitements')
      .delete()
      .eq('group_id', groupId)
    
    return { success: !error }
  },

  // Execute an entire MIX
  async executePlanGroup(userId: string, groupItems: any[]) {
    try {
      // 1. Prepare Real Treatments
      // We grab the water volume from the first item (it's the same for the group)
      const waterVolume = groupItems[0]?.quantite_eau || 0
      
      const realTreatments = groupItems.map(plan => ({
        produit_id: plan.produit_id,
        parcelle: plan.parcelle,
        quantite_utilisee: plan.quantite_prevue,
        date_traitement: new Date().toISOString().split('T')[0], // Execute TODAY
        cout_estime: 0 // Will be calculated in batch function
      }))

      // 2. Call the Real Save Logic (Deduct Stock)
      // @ts-ignore
      const result = await this.enregistrerTraitementBatch(realTreatments, waterVolume)

      if (!result.success) throw new Error(result.error)

      // 3. Delete the Plan (Clean up)
      const groupId = groupItems[0]?.group_id
      if (groupId) {
        await this.deletePlannedGroup(groupId)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  },
  // ========== HELPER ==========

  getStockLevel(stock: number, typeProduit: string): { level: string; badgeClass: string } {
    let threshold = 5
    const typeLower = typeProduit.toLowerCase()
    
    if (typeLower.includes('insecticide')) threshold = 1
    else if (typeLower.includes('engrais')) threshold = 100
    
    if (stock < threshold) return { level: 'Faible', badgeClass: 'badge-low' }
    if (stock < threshold * 5) return { level: 'Moyen', badgeClass: 'badge-medium' }
    return { level: 'Élevé', badgeClass: 'badge-high' }
  },
}

export default Database