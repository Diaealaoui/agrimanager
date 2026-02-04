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
    produit?: string
  ) {
    try {
      // 🔧 FIX: Use produit_id foreign key explicitly
      let query = supabase
        .from('traitements')
        .select(`
          *,
          produits!traitements_produit_id_fkey (
            id,
            nom,
            type_produit,
            matiere_active,
            unite_reference
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

  async enregistrerAchatComplet(data: any, userId: string) {
    try {
      const {
        nom,
        type_produit,
        matiere_active,
        quantite,
        unite_ref,
        unite_achat,
        prix_u_ht,
        taux_tva,
        fournisseur,
        date,
        box_quantity,
        is_box_unit,
      } = data

      // Calculate actual stock for box units
      let actualQuantity = quantite
      if (is_box_unit && box_quantity) {
        actualQuantity = quantite * box_quantity
      }

      // Check if product exists
      const { data: existingProduct } = await supabase
        .from('produits')
        .select('*')
        .eq('nom', nom)
        .eq('user_id', userId)
        .single()

      let productId: string

      if (!existingProduct) {
        // Create new product
        const { data: newProduct, error: createError } = await supabase
          .from('produits')
          .insert({
            nom,
            unite_reference: unite_ref,
            stock_actuel: actualQuantity,
            prix_moyen: prix_u_ht,
            type_produit: type_produit || 'Autre',
            matiere_active: matiere_active || '',
            user_id: userId,
            box_quantity: box_quantity || null,
            is_box_unit: is_box_unit || false,
          })
          .select()
          .single()

        if (createError) throw createError
        productId = newProduct!.id
      } else {
        // Update existing product
        productId = existingProduct.id
        const oldStock = parseFloat((existingProduct.stock_actuel || 0).toString())
        const oldPrice = parseFloat((existingProduct.prix_moyen || 0).toString())
        const newQty = actualQuantity
        const newPrice = parseFloat(prix_u_ht.toString())

        const totalStock = oldStock + newQty
        let avgPrice = newPrice
        
        if (totalStock > 0) {
          avgPrice = ((oldStock * oldPrice) + (newQty * newPrice)) / totalStock
        }

        const { error: updateError } = await supabase
          .from('produits')
          .update({
            stock_actuel: totalStock,
            prix_moyen: avgPrice,
            type_produit: type_produit || existingProduct.type_produit || 'Autre',
            matiere_active: matiere_active || existingProduct.matiere_active || '',
            box_quantity: box_quantity || existingProduct.box_quantity,
            is_box_unit: is_box_unit !== undefined ? is_box_unit : existingProduct.is_box_unit,
          })
          .eq('id', productId)

        if (updateError) throw updateError
      }

      // Record purchase
      const totalHT = quantite * prix_u_ht
      const montantTVA = totalHT * (taux_tva / 100)
      const prixUnitaireTTC = prix_u_ht * (1 + (taux_tva / 100))

      const { error: purchaseError } = await supabase
        .from('achats')
        .insert({
          user_id: userId,
          produit_id: productId,
          nom,
          fournisseur,
          quantite_recue: quantite,
          unite_achat,
          prix_unitaire_ht: prix_u_ht,
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

  async enregistrerTraitementBatch(traitements: any[]) {
    try {
      const results = []
      
      for (const t of traitements) {
        const { data: productData, error: productError } = await supabase
          .from('produits')
          .select('stock_actuel, prix_moyen')
          .eq('id', t.produit_id)
          .single()

        if (productError) {
          console.error(`Error getting product ${t.produit_id}:`, productError)
          continue
        }

        const cout = parseFloat(t.quantite_utilisee) * parseFloat((productData!.prix_moyen || 0).toString())
        t.cout_estime = cout

        const newStock = parseFloat((productData!.stock_actuel || 0).toString()) - parseFloat(t.quantite_utilisee)
        
        const { error: updateError } = await supabase
          .from('produits')
          .update({ stock_actuel: newStock })
          .eq('id', t.produit_id)

        if (updateError) {
          console.error(`Error updating stock for ${t.produit_id}:`, updateError)
          continue
        }

        results.push(t)
      }

      if (results.length > 0) {
        const { error: insertError } = await supabase
          .from('traitements')
          .insert(results)

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
      
      // 🔧 FIX: Use explicit foreign key
      const { data: achats, error } = await supabase
        .from('achats')
        .select(`
          *,
          produits!achats_produit_id_fkey(type_produit)
        `)
        .eq('user_id', userId)
        .gte('date_commande', startDate)
        .lte('date_commande', endDate)

      if (error) throw error

      const stats = {
        par_mois: {},
        par_type: {},
        par_fournisseur: {}
      }

      achats?.forEach(achat => {
        const month = achat.date_commande.substring(0, 7)
        const type = achat.produits?.type_produit || 'Autre'
        const supplier = achat.fournisseur || 'Inconnu'
        
        stats.par_mois[month] = (stats.par_mois[month] || 0) + (achat.montant_ttc || 0)
        stats.par_type[type] = (stats.par_type[type] || 0) + (achat.montant_ttc || 0)
        stats.par_fournisseur[supplier] = (stats.par_fournisseur[supplier] || 0) + (achat.montant_ttc || 0)
      })

      return { success: true, stats }
    } catch (error) {
      console.error('Error getting stats:', error)
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