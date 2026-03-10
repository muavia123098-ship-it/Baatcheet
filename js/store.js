// Store Module
// Using global 'db', 'Auth'


const Store = {
    // Keys
    KEYS: {
        PARTIES: 'hk_parties',
        PRODUCTS: 'hk_products',
        INVOICES: 'hk_invoices',
        EXPENSES: 'hk_expenses',
        PURCHASES: 'hk_purchases',
        SETTINGS: 'hk_settings'
    },

    // Initialize with default data if empty
    init() {
        if (!localStorage.getItem(this.KEYS.PARTIES)) localStorage.setItem(this.KEYS.PARTIES, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.PRODUCTS)) localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.INVOICES)) localStorage.setItem(this.KEYS.INVOICES, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.EXPENSES)) localStorage.setItem(this.KEYS.EXPENSES, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.PURCHASES)) localStorage.setItem(this.KEYS.PURCHASES, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.SETTINGS)) localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify({}));
    },

    // Generic Get
    get(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;
        try {
            return JSON.parse(item);
        } catch (e) {
            return null;
        }
    },

    // Generic Save (with cloud sync)
    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        // Dispatch event for reactivity if needed
        window.dispatchEvent(new Event('store-updated'));
    },

    // Settings Helpers
    getSettings() {
        return this.get(this.KEYS.SETTINGS) || {};
    },
    saveSettings(settings) {
        this.save(this.KEYS.SETTINGS, settings);
    },

    // Helpers for Specific Modules
    getParties() { return this.get(this.KEYS.PARTIES); },
    addParty(party) {
        const parties = this.getParties();
        party.id = Date.now().toString(); // Simple ID
        parties.push(party);
        this.save(this.KEYS.PARTIES, parties);
        return party;
    },
    deleteParty(id) {
        let parties = this.getParties();
        parties = parties.filter(p => p.id !== id);
        this.save(this.KEYS.PARTIES, parties);
    },

    getProducts() { return this.get(this.KEYS.PRODUCTS); },
    addProduct(product) {
        const products = this.getProducts();
        product.id = Date.now().toString();
        products.push(product);
        this.save(this.KEYS.PRODUCTS, products);
        return product;
    },
    deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id !== id);
        this.save(this.KEYS.PRODUCTS, products);
    },

    // reset db (for testing)
    deleteInvoice(id) {
        let invoices = this.get(this.KEYS.INVOICES);
        invoices = invoices.filter(inv => inv.id !== id);
        this.save(this.KEYS.INVOICES, invoices);
    },
    reset() {
        localStorage.clear();
        this.init();
        window.location.reload();
    },

};

// Make it globally available
window.Store = Store;


// Also make it globally available for backward compatibility
window.Store = Store;
