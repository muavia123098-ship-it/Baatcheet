// UI Module
// Relying on global Store and Auth


const UI = {
    currentPartyId: '',
    // Utility to format currency

    formatMoney(amount) {
        return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10 flex items-center gap-3 animate-toast-in pointer-events-auto ${type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
            }`;

        toast.innerHTML = `
            <i class="${type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-xl"></i>
            <span class="font-bold text-sm tracking-wide">${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('animate-toast-in');
            toast.classList.add('animate-toast-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    pages: {
        setup: () => {
            const settings = Store.getSettings();
            const isEdit = settings.setupFinished;

            return `
                <div class="fixed inset-0 bg-cardBg z-[100] flex flex-col items-center justify-center p-6 overflow-y-auto">
                    ${isEdit ? `
                        <button onclick="router.navigate('dashboard')" class="absolute top-6 left-6 w-12 h-12 rounded-2xl bg-cardBg border border-white/10 flex items-center justify-center shadow-lg hover:bg-white/5 transition-all active:scale-95 text-slate-400">
                            <i class="ri-arrow-left-line text-2xl"></i>
                        </button>
                    ` : ''}
                    <div class="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-300">
                        <div class="text-center">
                            <div class="mb-6 transform rotate-6 hover:rotate-12 transition-transform duration-500">
                                <img src="icon.png" class="w-24 h-24 rounded-[2rem] mx-auto shadow-xl shadow-primary/20">
                            </div>

                            <h1 class="text-3xl font-bold text-white">${isEdit ? 'Update Profile' : 'Khush Amdeed!'}</h1>
                            <p class="text-slate-400 mt-2">${isEdit ? 'Apni details tabdeel karein.' : 'Apne karobar ki details enter karein takay hum start kar sakein.'}</p>
                        </div>

                        <form id="setupForm" class="space-y-5 bg-cardBg p-8 rounded-2xl border border-white/5 shadow-xl" onsubmit="event.preventDefault(); UI.hooks.saveSetup();">
                            <div>
                                <label class="block text-sm font-semibold text-gray-200 mb-1.5">Business / Shop Name</label>
                                <input type="text" id="setupBizName" required value="${settings.businessName || ''}"
                                    class="w-full px-4 py-3 rounded-xl border border-white/5 bg-white text-black focus:ring-primary/20">
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-200 mb-1.5">Phone Number</label>
                                <input type="tel" id="setupPhone" placeholder="" value="${settings.phone || ''}"
                                    class="w-full px-4 py-3 rounded-xl border border-white/5 bg-white text-black focus:ring-primary/20">
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-200 mb-1.5">Your Name (Owner)</label>
                                <input type="text" id="setupOwner" value="${settings.owner || ''}"
                                    class="w-full px-4 py-3 rounded-xl border border-white/5 bg-white text-black focus:ring-primary/20">
                            </div>

                            <button type="submit" 
                                class="w-full bg-primary hover:bg-sky-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 text-lg">
                                ${isEdit ? 'Save Changes' : 'Create Business'} <i class="ri-arrow-right-line"></i>
                            </button>
                        </form>
                        
                        <p class="text-center text-xs text-slate-500">Aap in details ko baad mein settings se change kar sakte hain.</p>
                        
                        <div class="pt-8 border-t border-white/5 text-center">
                            <button onclick="UI.openModal('resetConfirmModal')" class="text-red-500 hover:text-red-400 text-sm font-bold flex items-center justify-center gap-2 mx-auto transition-colors">
                                <i class="ri-refresh-line"></i> Reset App & Delete All Data
                            </button>
                        </div>
                    </div>
                </div>

                ${UI.components.modal('resetConfirmModal', 'Confirm Reset', `
                    <div class="text-center space-y-6">
                        <div class="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="ri-error-warning-line text-4xl"></i>
                        </div>
                        <p class="text-slate-300">Kia aap waqai sara data reset karna chahte hain? Isse aapka sara record delete ho jaega aur aap wapis login screen par chale jaenge.</p>
                        <div class="flex gap-4">
                            <button onclick="UI.closeModal('resetConfirmModal')" class="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl font-bold hover:bg-white/10 transition-all">Cancel</button>
                            <button onclick="UI.hooks.resetApp()" class="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-900/20 active:scale-95 transition-all">Yes, Reset Result</button>
                        </div>
                    </div>
                `)}
            `;
        },

        dashboard: () => {
            const settings = Store.getSettings();
            if (!settings.setupFinished) {
                return UI.pages.setup();
            }

            // Simple migration: if date doesn't exist, set it
            UI.dashboardDate = UI.dashboardDate || new Date().toISOString().split('T')[0];

            // Get stats and invoices
            const partiesList = Store.getParties();
            const invoices = Store.get('hk_invoices');
            const productsList = Store.getProducts();

            // Filter by selected date
            const selectedDateStr = new Date(UI.dashboardDate).toDateString();

            const filteredInvoices = invoices
                .filter(inv => new Date(inv.date).toDateString() === selectedDateStr);
            const saleTotal = filteredInvoices
                .filter(i => i.type === 'SALE')
                .reduce((sum, inv) => sum + inv.total, 0);

            const purchases = Store.get(Store.KEYS.PURCHASES) || [];
            const purchaseTotal = purchases
                .filter(p => new Date(p.date).toDateString() === selectedDateStr)
                .reduce((sum, p) => sum + p.total, 0);

            const expenses = Store.get(Store.KEYS.EXPENSES) || [];
            const expenseTotal = expenses
                .filter(e => new Date(e.date).toDateString() === selectedDateStr)
                .reduce((sum, e) => sum + e.amount, 0);

            // Calculate Totals
            const toCollect = partiesList.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
            const stockVal = productsList.reduce((sum, p) => sum + (p.stock * (p.cost || p.price)), 0);

            // Recent 3 transactions for display
            const recentTransactions = filteredInvoices.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

            return `
                <div class="space-y-6 pb-32">
                    <div class="-mx-4 md:mx-0 -mt-4 md:mt-0 mb-6 p-6 bg-cardBg/90 backdrop-blur-xl text-white shadow-2xl flex justify-between items-center rounded-b-[2.5rem] md:rounded-3xl border-b border-white/10 relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
                    <div class="relative z-10">
                        <h2 class="text-2xl md:text-4xl font-black tracking-tight leading-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">${settings.businessName}</h2>
                        <div class="flex items-center gap-2 text-primary text-sm mt-2 font-bold bg-white/5 py-1.5 px-4 rounded-full w-fit backdrop-blur-md border border-white/5 shadow-inner">
                            <i class="ri-user-star-fill"></i>
                            <span>${settings.owner}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 relative z-10">
                        <!-- Language Toggle -->
                        <div class="flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-xl">
                            <button onclick="i18n.setLanguage('en')" class="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${i18n.currentLang === 'en' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}">EN</button>
                            <button onclick="i18n.setLanguage('ur')" class="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${i18n.currentLang === 'ur' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}">اردو</button>
                        </div>
                        <button onclick="router.navigate('setup')" class="bg-white/5 p-3 rounded-2xl backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all shadow-lg active:scale-95" title="${i18n.t('updateProfile')}">
                            <i class="ri-edit-line text-2xl text-primary"></i>
                        </button>
                    </div>
                </div>

                <div class="space-y-6">
                    <!-- Today's Summary Card (Improved for Vibrancy) -->
                    <div class="bg-cardBg rounded-3xl p-6 text-white shadow-xl border border-white/5 relative overflow-hidden group">
                        <!-- Decorative Gradient Glow -->
                        <div class="absolute -right-20 -top-20 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/30 transition-all duration-700"></div>
                        
                        <div class="flex justify-between items-center mb-6 relative z-10">
                            <h3 class="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <i class="ri-flashlight-line text-primary"></i>
                                ${i18n.t('todaysSummary')}
                            </h3>
                            <span class="text-[10px] font-bold bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-slate-300 backdrop-blur-md">${UI.dashboardDate}</span>
                        </div>

                        <div class="grid grid-cols-2 gap-4 relative z-10">
                            <div class="space-y-1">
                                <div class="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">${i18n.t('dailySales')}</div>
                                <div class="text-2xl font-black text-white">${UI.formatMoney(saleTotal)}</div>
                            </div>
                            <div class="space-y-1">
                                <div class="text-[10px] font-bold text-sky-400 uppercase tracking-tighter">${i18n.t('purchased')}</div>
                                <div class="text-2xl font-black text-white">${UI.formatMoney(purchaseTotal)}</div>
                            </div>
                            <div class="space-y-1">
                                <div class="text-[10px] font-bold text-amber-400 uppercase tracking-tighter">${i18n.t('stockValue')}</div>
                                <div class="text-2xl font-black text-white">${UI.formatMoney(stockVal)}</div>
                            </div>
                            <div class="space-y-1">
                                <div class="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">${i18n.t('expenses')}</div>
                                <div class="text-2xl font-black text-white">${UI.formatMoney(expenseTotal)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Secondary Stats -->
                    <div class="grid grid-cols-2 gap-4">
                         <div class="bg-cardBg p-4 rounded-3xl shadow-sm border border-white/5 flex items-center gap-3 group hover:border-red-500/30 transition-all">
                            <div class="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
                                <i class="ri-hand-coin-line text-2xl"></i>
                            </div>
                            <div>
                                <div class="text-slate-500 text-[10px] uppercase font-black tracking-tighter">${i18n.t('toCollect')}</div>
                                <div class="text-lg font-black text-white">${UI.formatMoney(toCollect)}</div>
                            </div>
                        </div>
                        <div class="bg-cardBg p-4 rounded-3xl shadow-sm border border-white/5 flex items-center gap-3 cursor-pointer group hover:border-primary/30 transition-all" onclick="document.getElementById('dashDateInput').showPicker()">
                            <div class="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                <i class="ri-calendar-event-line text-2xl"></i>
                            </div>
                            <div class="flex-1">
                                <div class="text-slate-500 text-[10px] uppercase font-black tracking-tighter">${i18n.t('date')}</div>
                                <input type="date" id="dashDateInput" value="${UI.dashboardDate}" class="text-sm font-black text-white bg-transparent outline-none w-full" onchange="UI.hooks.updateDashboardDate(this.value)">
                            </div>
                        </div>
                    </div>

                    <!-- Sales Graph Card -->
                    <div class="bg-cardBg rounded-3xl p-6 text-white shadow-xl border border-white/5 relative overflow-hidden group">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <i class="ri-pie-chart-2-line text-fuchsia-500"></i>
                                ${i18n.t('businessInsights')}
                            </h3>
                        </div>
                        <div class="h-48 w-full">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>

                    <!-- Quick Navigation Grid (Vibrant Style) -->

        <div class="grid grid-cols-2 gap-4">
            <!-- Row 1 -->
            <button onclick="router.navigate('new-sale')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-emerald-500/10 hover:border-emerald-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-shopping-cart-2-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('newSale')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('bikriKarein')}</span>
                </div>
            </button>
            <button onclick="router.navigate('new-purchase')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-sky-500/10 hover:border-sky-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-sky-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-shopping-bag-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('purchase')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('maalMangwayein')}</span>
                </div>
            </button>

            <!-- Row 2 -->
            <button onclick="router.navigate('parties')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-amber-500/10 hover:border-amber-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-team-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('parties')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('ledgerDekhein')}</span>
                </div>
            </button>
            <button onclick="router.navigate('stock')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-indigo-500/10 hover:border-indigo-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-box-3-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('products')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('stockCheck')}</span>
                </div>
            </button>

            <!-- Row 3 -->
            <button onclick="router.navigate('sales')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-primary/10 hover:border-primary/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-list-check-2 text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('salesList')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('billsHistory')}</span>
                </div>
            </button>
            <button onclick="router.navigate('purchases')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-teal-500/10 hover:border-teal-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-teal-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-file-list-3-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('purchaseList')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('maalRecord')}</span>
                </div>
            </button>

            <!-- Row 4 -->
            <button onclick="router.navigate('dues')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-rose-500/10 hover:border-rose-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-money-dollar-box-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('duesList')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('udhaarWasooli')}</span>
                </div>
            </button>
            <button onclick="router.navigate('profitLoss')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-lime-500/10 hover:border-lime-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-lime-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-lime-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-line-chart-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('profitLoss')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('kamayiCheck')}</span>
                </div>
            </button>

            <!-- Row 5 -->
            <button onclick="router.navigate('expenses')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-red-600/10 hover:border-red-600/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-600/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-wallet-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('expense')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('kharcheLikhein')}</span>
                </div>
            </button>
            <button onclick="router.navigate('reports')" class="bg-cardBg p-4 rounded-[2rem] shadow-sm border border-white/5 flex flex-col gap-3 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 active:scale-95 transition-all text-left group">
                <div class="w-12 h-12 rounded-2xl bg-fuchsia-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-fuchsia-500/20 group-hover:rotate-6 transition-transform">
                    <i class="ri-file-chart-line text-2xl"></i>
                </div>
                <div class="space-y-0.5">
                    <span class="text-sm font-black text-white leading-tight block">${i18n.t('reports')}</span>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${i18n.t('mukammalHisab')}</span>
                </div>
            </button>
        </div>

        <!-- Recent Transactions -->
        <div class="bg-cardBg rounded-xl shadow-sm border border-white/5 overflow-hidden">
            <div class="p-4 border-b border-gray-50 flex justify-between items-center">
                <h3 class="font-bold text-gray-200">${i18n.t('transactions')}</h3>
                <div class="flex items-center gap-3">
                    <input type="date" value="${UI.dashboardDate}"
                        onchange="UI.hooks.updateDashboardDate(this.value)"
                        class="px-2 py-1 border border-white/10 rounded text-xs text-slate-500 bg-appBg focus:outline-none focus:ring-1 focus:ring-primary">
                        <a href="#" onclick="router.navigate('sales')" class="text-xs text-primary font-medium">${i18n.t('viewAll')}</a>
                </div>
            </div>
            <div class="divide-y divide-gray-50">
                ${recentTransactions.length === 0 ? `
                                <div class="p-8 text-center text-slate-500 text-sm">
                                    ${i18n.t('noTransactions')}
                                </div>
                            ` : recentTransactions.map(inv => {
                const party = partiesList.find(p => p.id === inv.partyId) || { name: 'Cash Sale' };
                const isPayment = inv.type === 'PAYMENT';
                return `
                                    <div class="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer" onclick="${isPayment ? `UI.hooks.viewPartyLedger('${inv.partyId}')` : `UI.hooks.viewInvoiceDetail('${inv.id}')`}">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg ${isPayment ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'} flex items-center justify-center">
                                                <i class="${isPayment ? 'ri-hand-coin-line' : 'ri-bill-line'}"></i>
                                            </div>
                                             <div>
                                                <div class="font-bold text-white">${party.name === 'Cash Sale' ? i18n.t('cashSale') : party.name}</div>
                                                <div class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                    ${isPayment ? i18n.t('cashReceipt') : `${inv.items.length} ${i18n.t('items')} • ${i18n.t('bill')}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-black text-sm ${isPayment ? 'text-emerald-500' : 'text-white'}">
                                                ${isPayment ? '+ ' : ''}${UI.formatMoney(isPayment ? inv.amount : inv.total)}
                                            </div>
                                            <div class="text-[10px] font-black uppercase tracking-tighter ${isPayment ? 'text-emerald-600' : (inv.due > 0 ? 'text-red-500' : 'text-emerald-500')}">
                                                ${isPayment ? i18n.t('received') : (inv.due > 0 ? i18n.t('unpaid') : i18n.t('paid'))}
                                            </div>
                                        </div>
                                    </div>
                                `;
            }).join('')}
            </div>
        </div>
    </div>
`;
        },

        parties: () => {
            const parties = Store.getParties();
            return `
                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                                <i class="ri-arrow-left-line text-xl"></i>
                            </button>
                            <h2 class="text-2xl font-bold text-white">${i18n.t('parties')}</h2>
                        </div>
                        <button onclick="UI.openModal('addPartyModal')" class="bg-primary text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all">
                            <i class="ri-user-add-line"></i> ${i18n.t('addNew')}
                        </button>
                    </div>

                    <!-- Search & Filter Bar -->
                    <div class="bg-cardBg p-3 rounded-2xl shadow-sm border border-white/5 flex gap-2">
                        <div class="relative flex-1">
                            <i class="ri-search-line absolute left-3 top-2.5 text-slate-500"></i>
                            <input type="text" id="partySearch" oninput="UI.hooks.filterParties()" placeholder="${i18n.t('search')}" class="w-full pl-10 pr-4 py-2 rounded-xl bg-appBg border-none focus:ring-2 focus:ring-primary/20 text-sm">
                        </div>
                        <select id="partyTypeFilter" onchange="UI.hooks.filterParties()" class="bg-appBg border-none rounded-xl text-xs font-bold text-slate-500 px-3 focus:ring-2 focus:ring-primary/20">
                            <option value="ALL">${i18n.t('allTypes')}</option>
                            <option value="CUSTOMER">${i18n.t('customer')}</option>
                            <option value="SUPPLIER">${i18n.t('supplier')}</option>
                        </select>
                    </div>

                    <div class="bg-cardBg rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
                        ${parties.length === 0 ? `
                            <div class="p-16 text-center">
                                <div class="w-20 h-20 bg-appBg rounded-full flex items-center justify-center mx-auto mb-4">
                                    <i class="ri-group-line text-3xl text-gray-300"></i>
                                </div>
                                <h3 class="text-white font-bold">${i18n.t('noParties')}</h3>
                                <p class="text-slate-500 text-sm mt-1">${i18n.t('noPartiesDesc')}</p>
                            </div>
                        ` : `
                            <div id="partiesList" class="divide-y divide-gray-50">
                                ${parties.map(p => `
                                    <div class="party-item p-4 hover:bg-white/5 flex justify-between items-center group transition-colors cursor-pointer" 
                                         data-type="${p.type}" 
                                         data-name="${p.name.toLowerCase()}"
                                         onclick="UI.hooks.viewPartyLedger('${p.id}')">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${p.type === 'CUSTOMER' ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-red-600'} text-white flex items-center justify-center font-black text-lg shadow-md">
                                                ${p.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">${p.name}</div>
                                                <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold ${p.type === 'CUSTOMER' ? 'text-blue-500' : 'text-orange-500'}">
                                                    <span>${p.type}</span>
                                                    <span class="text-gray-300">•</span>
                                                    <span class="text-slate-500">${p.phone || 'No Phone'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right flex flex-col items-end gap-1">
                                            <div class="text-lg font-black ${p.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}">
                                                ${UI.formatMoney(Math.abs(p.balance))}
                                            </div>
                                            <div class="text-[10px] font-bold px-2 py-0.5 rounded-full ${p.balance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-50 text-red-500'}">
                                                ${p.balance >= 0 ? i18n.t('receivable') : i18n.t('payable')}
                                            </div>
                                            <button onclick="event.stopPropagation(); UI.hooks.deleteParty('${p.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 p-1">
                                                <i class="ri-delete-bin-line"></i>
                                            </button>
                                        </div>
                                    </div>

                                `).join('')}
                            </div>
                            <div id="noPartyMatch" class="p-16 text-center hidden">
                                <i class="ri-search-line text-4xl text-slate-500 mb-2 block"></i>
                                <div class="text-slate-500 font-medium">No matches found!</div>
                            </div>
                        `}
                    </div>
                </div>

                ${UI.components.modal('addPartyModal', i18n.t('addParty'), `
                    <form id="addPartyForm" class="space-y-4" onsubmit="event.preventDefault(); UI.hooks.saveParty();">
                        <div>
                            <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('fullName')}</label>
                            <input type="text" id="partyName" required placeholder="" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-primary/20 outline-none">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('phoneNumber')}</label>
                            <input type="tel" id="partyPhone" placeholder="" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-primary/20 outline-none">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">Type</label>
                                <select id="partyType" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-primary/20 outline-none font-bold">
                                    <option value="CUSTOMER">${i18n.t('customer')}</option>
                                    <option value="SUPPLIER">${i18n.t('supplier')}</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('openingBalance')}</label>
                                <input type="number" id="partyBalance" value="0" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-primary/20 outline-none">
                            </div>
                        </div>
                        <button type="submit" class="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 mt-4 active:scale-95 transition-all">
                            ${i18n.t('saveParty')}
                        </button>
                    </form>
                `)}
            `;
        },

        // Placeholders for other pages
        stock: () => {
            const products = Store.getProducts();
            const lowStockCount = products.filter(p => p.stock <= (p.minStock || 5)).length;

            return `
                <div class="space-y-4 pb-32">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                                <i class="ri-arrow-left-line text-xl"></i>
                            </button>
                            <h2 class="text-2xl font-bold text-white">${i18n.t('inventory')}</h2>
                        </div>
                        <button onclick="UI.openModal('addProductModal')" class="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-indigo-900/20 flex items-center gap-2 active:scale-95 transition-all">
                            <i class="ri-add-line"></i> ${i18n.t('addProduct')}
                        </button>
                    </div>

                    <!-- Search & Alerts Bar -->
                    <div class="flex flex-col md:flex-row gap-3">
                        <div class="bg-cardBg p-3 rounded-2xl shadow-sm border border-white/5 flex-1 flex gap-2">
                             <div class="relative flex-1">
                                <i class="ri-search-line absolute left-3 top-2.5 text-slate-500"></i>
                                <input type="text" placeholder="${i18n.t('search')}" class="w-full pl-10 pr-4 py-2 rounded-xl bg-appBg border-none focus:ring-2 focus:ring-indigo-500/20 text-sm">
                            </div>
                        </div>
                        ${lowStockCount > 0 ? `
                            <div class="bg-red-50 p-3 rounded-2xl border border-red-100 flex items-center gap-3 px-6 animate-pulse">
                                <i class="ri-error-warning-fill text-red-500 text-xl"></i>
                                <div class="text-xs font-black text-red-600 uppercase tracking-tighter">${lowStockCount} ${i18n.t('lowStock')}</div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="bg-cardBg rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
                        ${products.length === 0 ? `
                            <div class="p-16 text-center">
                                <div class="w-20 h-20 bg-appBg rounded-full flex items-center justify-center mx-auto mb-4">
                                    <i class="ri-box-3-line text-3xl text-gray-300"></i>
                                </div>
                                <h3 class="text-white font-bold">${i18n.t('noProducts')}</h3>
                                <p class="text-slate-500 text-sm mt-1">${i18n.t('noProductsDesc')}</p>
                            </div>
                        ` : `
                            <div class="divide-y divide-gray-50">
                                ${products.map(p => `
                                    <div class="p-4 hover:bg-white/5 flex justify-between items-center group transition-colors">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md">
                                                <i class="ri-box-3-line"></i>
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">${p.name}</div>
                                                <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                    <span class="text-indigo-500">${i18n.t('price')}: ${UI.formatMoney(p.price)}</span>
                                                    <span>•</span>
                                                    <span>${i18n.t('cost')}: ${UI.formatMoney(p.cost || 0)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right flex flex-col items-end gap-1">
                                            <div class="text-lg font-black ${p.stock <= (p.minStock || 5) ? 'text-red-500' : 'text-emerald-600'}">
                                                ${p.stock} <span class="text-[10px] font-bold text-slate-500 uppercase">${p.unit}</span>
                                            </div>
                                            <div class="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div class="h-full ${p.stock <= (p.minStock || 5) ? 'bg-red-500' : 'bg-emerald-500'}" style="width: ${Math.min(100, (p.stock / 20) * 100)}%"></div>
                                            </div>
                                            <button onclick="UI.hooks.deleteProduct('${p.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 p-1">
                                                <i class="ri-delete-bin-line"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>

                ${UI.components.modal('addProductModal', i18n.t('addProduct'), `
                    <form id="addProductForm" class="space-y-4" onsubmit="event.preventDefault(); UI.hooks.saveProduct();">
                        <div>
                            <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('productName') || 'Product Name'}</label>
                            <input type="text" id="prodName" required placeholder="" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-indigo-500/20 outline-none">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('price')}</label>
                                <input type="number" id="prodPrice" required placeholder="0" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-indigo-500/20 outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('cost')}</label>
                                <input type="number" id="prodCost" required placeholder="0" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-indigo-500/20 outline-none">
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('unit')}</label>
                                <select id="prodUnit" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold">
                                    <option value="bottles">Bottles</option>
                                    <option value="kg">Kg</option>
                                    <option value="ltr">Ltr</option>
                                    <option value="box">Box</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('initialStock')}</label>
                                <input type="number" id="prodStock" value="0" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-indigo-500/20 outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('alertQty')}</label>
                                <input type="number" id="prodMin" value="5" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-indigo-500/20 outline-none">
                            </div>
                        </div>
                        <button type="submit" class="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-900/20 mt-4 active:scale-95 transition-all">
                            ${i18n.t('saveProduct')}
                        </button>
                    </form>
                `)}
            `;
        },
        reports: () => {
            const invoices = Store.get('hk_invoices');
            const parties = Store.getParties();
            const products = Store.getProducts();

            const now = new Date();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();

            // 1. Monthly Sales
            const monthlyInvoices = invoices.filter(inv => {
                const date = new Date(inv.date);
                return inv.type === 'SALE' && date.getMonth() === thisMonth && date.getFullYear() === thisYear;
            });
            const monthlySalesTotal = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);

            // 2. Total Udhaar (Receivables)
            const totalUdhaar = parties.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);

            // 3. Stock Value (Based on Cost)
            const stockValue = products.reduce((sum, p) => sum + (p.stock * (p.cost || p.price)), 0);

            // 4. Profit Calculation
            let totalProfit = 0;
            invoices.filter(i => i.type === 'SALE').forEach(inv => {
                inv.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product && product.cost) {
                        const cost = product.cost || 0;
                        const profitPerItem = item.price - cost;
                        totalProfit += (profitPerItem * item.qty);
                    }
                });
                totalProfit -= (inv.discount || 0);
            });

            // 5. Low Stock Alerts
            const lowStockItems = products.filter(p => p.stock <= (p.minStock || 5));

            return `
                <div class="space-y-6 pb-32">
                    <div class="flex items-center gap-3">
                        <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                            <i class="ri-arrow-left-line text-xl"></i>
                        </button>
                        <h2 class="text-2xl font-bold text-white">${i18n.t('businessReports')}</h2>
                    </div>

                    <!-- Stats Overview -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-[2.5rem] text-white shadow-xl border border-white/10 relative overflow-hidden group">
                           <div class="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                            <div class="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10">${i18n.t('monthlySales')}</div>
                            <div class="text-2xl font-black relative z-10">${UI.formatMoney(monthlySalesTotal)}</div>
                            <div class="text-[10px] text-blue-100/70 mt-3 font-bold relative z-10 flex items-center gap-1">
                                <i class="ri-bill-line"></i>
                                ${monthlyInvoices.length} ${i18n.t('billsThisMonth')}
                            </div>
                        </div>
                        <div class="bg-gradient-to-br from-rose-500 to-red-700 p-5 rounded-[2.5rem] text-white shadow-xl border border-white/10 relative overflow-hidden group">
                             <div class="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                            <div class="text-red-100 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10">${i18n.t('toCollect')}</div>
                            <div class="text-2xl font-black relative z-10">${UI.formatMoney(totalUdhaar)}</div>
                            <div class="text-[10px] text-red-100/70 mt-3 font-bold relative z-10 flex items-center gap-1">
                                <i class="ri-user-follow-line"></i>
                                ${i18n.t('marketReceivables')}
                            </div>
                        </div>
                        <div class="bg-gradient-to-br from-emerald-500 to-teal-700 p-5 rounded-[2.5rem] text-white shadow-xl border border-white/10 relative overflow-hidden group">
                             <div class="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                            <div class="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10">${i18n.t('stockValue')}</div>
                            <div class="text-2xl font-black relative z-10">${UI.formatMoney(stockValue)}</div>
                            <div class="text-[10px] text-emerald-100/70 mt-3 font-bold relative z-10 uppercase tracking-tighter">${i18n.t('currentInventory')}</div>
                        </div>
                        <div class="bg-gradient-to-br from-amber-500 to-orange-700 p-5 rounded-[2.5rem] text-white shadow-xl border border-white/10 relative overflow-hidden group">
                             <div class="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                            <div class="text-amber-100 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10">${i18n.t('tentativeProfit')}</div>
                            <div class="text-2xl font-black relative z-10">${UI.formatMoney(totalProfit)}</div>
                            <div class="text-[10px] text-amber-100/70 mt-3 font-bold relative z-10 uppercase tracking-tighter">${i18n.t('basedOnCost')}</div>
                        </div>
                    </div>

                    <!-- Stock Alerts -->
                    <div class="bg-cardBg rounded-2xl shadow-sm border border-white/5 overflow-hidden">
                        <div class="p-4 border-b border-gray-50 flex items-center gap-2">
                            <i class="ri-error-warning-line text-orange-500 text-xl"></i>
                            <h3 class="font-bold text-gray-200">${i18n.t('stockAlerts')}</h3>
                        </div>
                        <div class="divide-y divide-gray-50">
                            ${lowStockItems.length === 0 ? `
                                <div class="p-8 text-center text-slate-500 text-sm">${i18n.t('allStocked')}</div>
                            ` : lowStockItems.map(p => `
                                <div class="p-4 flex justify-between items-center">
                                    <div>
                                        <div class="font-medium text-white">${p.name}</div>
                                        <div class="text-xs text-slate-500">${i18n.t('unit')}: ${p.unit}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-red-500 font-bold">${p.stock} ${i18n.t('left')}</div>
                                        <div class="text-[10px] text-slate-500">${i18n.t('target')}: ${p.minStock || 5}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Quick Insights (Refined for Dark Theme) -->
                    <div class="bg-cardBg/50 rounded-3xl p-6 border border-white/5 backdrop-blur-md">
                        <h3 class="font-black text-amber-500 mb-4 ml-1 flex items-center gap-2 uppercase tracking-widest text-xs">
                            <i class="ri-lightbulb-flash-line"></i> ${i18n.t('businessInsights')}
                        </h3>
                        <div class="space-y-4">
                            <div class="flex items-start gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                                <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                                    <i class="ri-information-line"></i>
                                </div>
                                <p class="text-[13px] text-slate-300 leading-relaxed">
                                    ${i18n.t('insightUdhaar', { amount: UI.formatMoney(totalUdhaar) })}
                                </p>
                            </div>
                            <div class="flex items-start gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                                <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                                    <i class="ri-error-warning-line"></i>
                                </div>
                                <p class="text-[13px] text-slate-300 leading-relaxed">
                                    ${i18n.t('insightLowStock', { count: lowStockItems.length })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },
        sales: () => {
            const allInvoices = Store.get('hk_invoices').sort((a, b) => new Date(b.date) - new Date(a.date));
            const invoices = allInvoices.filter(i => i.type === 'SALE');
            const parties = Store.getParties();

            return `
                <div class="space-y-4 pb-32">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                             <button onclick="router.navigate('dashboard')" class="text-slate-500 hover:text-white"><i class="ri-arrow-left-line text-2xl"></i></button>
                            <h2 class="text-xl font-bold text-white">${i18n.t('salesAndBills')}</h2>
                        </div>
                        </div>
                    </div>

                    <div class="bg-cardBg rounded-xl shadow-sm border border-white/5 overflow-hidden">
                        ${invoices.length === 0 ? `
                            <div class="p-10 text-center text-slate-500 font-medium">${i18n.t('noSalesRecorded')}</div>
                        ` : `
                            <div class="divide-y divide-white/5">
                                ${(() => {
                    const partyGroups = {};
                    invoices.forEach(inv => {
                        const pid = inv.partyId || 'CASH';
                        if (!partyGroups[pid]) {
                            partyGroups[pid] = {
                                id: pid,
                                name: inv.partyName || i18n.t('cashSale'),
                                total: 0,
                                due: 0,
                                count: 0,
                                lastDate: inv.date
                            };
                        }
                        partyGroups[pid].total += inv.total;
                        partyGroups[pid].due += inv.due;
                        partyGroups[pid].count++;
                        if (new Date(inv.date) > new Date(partyGroups[pid].lastDate)) {
                            partyGroups[pid].lastDate = inv.date;
                        }
                    });


                    return Object.values(partyGroups)
                        .sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate))
                        .map(group => `
                                        <div class="p-5 hover:bg-white/5 flex justify-between items-center group transition-colors cursor-pointer" onclick="${group.id === 'CASH' ? '' : `UI.hooks.viewPartyLedger('${group.id}')`}">
                                            <div class="flex items-center gap-4">
                                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center text-xl shadow-lg">
                                                    <i class="ri-user-received-2-line"></i>
                                                </div>
                                                <div>
                                                    <div class="font-bold text-white">${group.name}</div>
                                                    <div class="text-[10px] text-slate-400 font-medium uppercase tracking-wider">${group.count} Bills • Last: ${new Date(group.lastDate).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                            <div class="text-right flex flex-col items-end gap-1">
                                                <div class="flex items-center gap-3">
                                                    <div class="flex flex-col items-end">
                                                        <div class="font-black text-white text-lg">${UI.formatMoney(group.total)}</div>
                                                        <div class="text-[10px] font-black ${group.due > 0 ? 'text-red-500' : 'text-emerald-500'} uppercase">
                                                            ${group.due > 0 ? 'Total Due: ' + UI.formatMoney(group.due) : 'All Paid'}
                                                        </div>
                                                    </div>
                                                    <button onclick="event.stopPropagation(); UI.hooks.deleteInvoiceGroup('${group.id}')" class="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-lg">
                                                        <i class="ri-delete-bin-line text-lg"></i>
                                                    </button>
                                                </div>
                                                ${group.id !== 'CASH' ? `<div class="text-[9px] text-primary font-bold uppercase mt-1 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">View Ledger</div>` : ''}
                                            </div>
                                        </div>
                                    `).join('');
                })()}
                            </div>
                        `}
                    </div>

                </div>

                ${UI.components.modal('receivePaymentModal', 'Receive Payment', `
                    <form id="receivePaymentForm" class="space-y-4" onsubmit="event.preventDefault(); UI.hooks.processPayment()">
                        <input type="hidden" id="payInvoiceId">
                        <div>
                            <label class="block text-sm font-bold text-gray-200 mb-1.5">Amount Due</label>
                            <input type="text" id="payDueDisplay" disabled class="w-full px-4 py-3 border border-white/5 rounded-xl bg-appBg text-slate-400 font-black">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-200 mb-1.5">Amount Received (Now)</label>
                            <div class="relative">
                                <span class="absolute left-4 top-3.5 text-slate-500 font-bold">Rs</span>
                                <input type="number" id="payAmount" required min="1" class="w-full pl-12 pr-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-black text-lg">
                            </div>
                        </div>
                        <div class="pt-4 flex gap-3">
                            <button type="button" onclick="UI.closeModal('receivePaymentModal')" class="flex-1 py-3 border border-white/10 rounded-xl text-slate-400 font-bold">Cancel</button>
                            <button type="submit" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20">Confirm Pay</button>
                        </div>
                    </form>
                `)}
            `;
        },

        'new-sale': () => {
            const parties = Store.getParties();
            const products = Store.getProducts();

            // Initialize cart in UI if not exists
            UI.cartState = UI.cartState || { items: [], partyId: '', paid: 0 };

            return `
                <div class="h-full flex flex-col">
                    <!-- Header -->
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center gap-3">
                            <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                                <i class="ri-arrow-left-line text-xl"></i>
                            </button>
                            <h2 class="text-2xl font-bold text-white">${i18n.t('newSale')}</h2>
                        </div>
                        <div class="text-sm text-slate-400 font-medium bg-cardBg px-3 py-1.5 rounded-xl border border-white/5 shadow-sm">
                             <input type="date" id="invoiceDate" value="${new Date().toISOString().split('T')[0]}" class="bg-transparent outline-none">
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto space-y-4 pb-24">
                        <div class="bg-cardBg p-5 rounded-3xl shadow-sm border border-white/5">
                            <label class="block text-xs font-black text-slate-500 uppercase tracking-tighter mb-2">${i18n.t('customer')}</label>
                            <div class="flex gap-2">
                                ${UI.components.searchableSelect('saleParty', i18n.t('cashSale'), [
                { value: '', label: i18n.t('cashSale') },
                ...parties.map(p => ({ value: p.id, label: p.name, subLabel: p.phone }))
            ], 'UI.cartState.partyId = value')}
                                <button onclick="UI.openModal('addPartyModal')" class="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center active:scale-95 transition-all border border-emerald-500/20">
                                    <i class="ri-add-line text-2xl"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Item Entry -->
                        <div class="bg-cardBg p-5 rounded-3xl shadow-sm border border-white/5">
                            <h3 class="text-xs font-black text-slate-500 uppercase tracking-tighter mb-4">${i18n.t('addItems')}</h3>
                            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
                                <div class="md:col-span-6">
                                    ${UI.components.searchableSelect('itemSelect', i18n.t('selectProduct'), [
                ...products.map(p => ({ value: p.id, label: p.name, subLabel: `Stock: ${p.stock}` }))
            ], (val) => {
                const p = products.find(x => x.id === val);
                if (p) {
                    document.getElementById('itemPrice').value = p.price;
                    document.getElementById('itemQty').focus();
                }
            })}
                                </div>
                                <div class="grid grid-cols-2 gap-3 md:col-span-4">
                                    <input type="number" id="itemPrice" placeholder="Price" class="w-full p-3 rounded-xl bg-appBg border-none focus:ring-2 focus:ring-primary/20 font-bold text-gray-200">
                                    <input type="number" id="itemQty" placeholder="Qty" value="1" class="w-full p-3 rounded-xl bg-appBg border-none focus:ring-2 focus:ring-primary/20 font-bold text-gray-200">
                                </div>
                                <div class="md:col-span-2">
                                    <button onclick="UI.hooks.addItemToCart()" class="w-full h-12 bg-emerald-500 text-white rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                        ${i18n.t('addNew').toUpperCase()}
                                    </button>
                                </div>
                            </div>

                            <!-- Cart Table -->
                            <div class="rounded-2xl border border-gray-50 overflow-hidden">
                                <table class="w-full text-xs text-left">
                                    <thead class="text-[10px] font-black text-slate-500 uppercase bg-appBg tracking-wider">
                                        <tr>
                                            <th class="px-4 py-3">${i18n.t('items')}</th>
                                            <th class="px-4 py-3 text-center">${i18n.t('unit')}</th>
                                            <th class="px-4 py-3 text-right">${i18n.t('price')}</th>
                                            <th class="px-4 py-3 text-right">Total</th>
                                            <th class="px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="cartTableBody">
                                        <!-- Injected -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Totals Section -->
                        <div class="bg-cardBg p-6 rounded-3xl shadow-sm border border-white/5 space-y-4">
                            <div class="flex justify-between items-center text-sm font-medium">
                                <span class="text-slate-500">${i18n.t('subTotal')}</span>
                                <span id="cartSubTotal" class="text-gray-200">Rs 0</span>
                            </div>
                            <div class="flex justify-between items-center text-sm font-medium">
                                <span class="text-slate-500">${i18n.t('discountKatt')}</span>
                                <input type="number" id="cartDiscount" value="0" class="w-24 p-2 rounded-lg bg-appBg border-none text-right font-bold focus:ring-2 focus:ring-primary/20" oninput="UI.hooks.updateCartTotals()">
                            </div>
                            <div class="pt-4 border-t flex justify-between items-center">
                                <span class="text-lg font-black text-white">Total</span>
                                <span id="cartTotal" class="text-2xl font-black text-primary">Rs 0</span>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-emerald-500/10 p-4 rounded-3xl border border-emerald-500/20">
                                    <label class="block text-[10px] font-black text-emerald-400 uppercase mb-1">${i18n.t('receivedNaqad')}</label>
                                    <input type="number" id="cartPaid" class="w-full bg-transparent border-none p-0 text-xl font-black text-white focus:ring-0" placeholder="0" oninput="UI.hooks.updateCartTotals()">
                                </div>
                                <div class="bg-red-500/10 p-4 rounded-3xl border border-red-500/20">
                                    <label id="cartBalanceLabel" class="block text-[10px] font-black text-red-400 uppercase mb-1">${i18n.t('balanceUdhaar')}</label>
                                    <div id="cartBalance" class="text-xl font-black text-white">Rs 0</div>
                                </div>
                            </div>

                            <button onclick="UI.hooks.saveInvoice()" class="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-900/40 active:scale-95 transition-all text-lg mt-4">
                                ${i18n.t('completeSale').toUpperCase()}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },
        expenses: () => {
            const expenses = Store.get(Store.KEYS.EXPENSES);
            const summaryExpenses = [...expenses].reverse();

            return `
                <div class="space-y-4 pb-32">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                                <i class="ri-arrow-left-line text-xl"></i>
                            </button>
                            <h2 class="text-2xl font-bold text-white">${i18n.t('expense')}</h2>
                        </div>
                        <button onclick="UI.openModal('addExpenseModal')" class="bg-red-500 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-red-900/20 flex items-center gap-2 active:scale-95 transition-all">
                            <i class="ri-add-line"></i> ${i18n.t('addNew')}
                        </button>
                    </div>

                    <div class="bg-cardBg rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
                        ${summaryExpenses.length === 0 ? `
                            <div class="p-16 text-center text-slate-500 font-medium">${i18n.t('noExpenses') || 'No expenses recorded yet'}</div>
                        ` : `
                            <div class="divide-y divide-gray-50">
                                ${summaryExpenses.map(exp => `
                                    <div class="p-5 flex justify-between items-center group hover:bg-white/5 transition-colors">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 text-white flex items-center justify-center text-xl shadow-lg">
                                                <i class="ri-wallet-3-line"></i>
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">${exp.reason}</div>
                                                <div class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                                    ${new Date(exp.date).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-4">
                                            <div class="text-right">
                                                <div class="text-lg font-black text-red-500">${UI.formatMoney(exp.amount)}</div>
                                                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Debit</div>
                                            </div>
                                            <button onclick="UI.hooks.deleteExpense('${exp.id}')" class="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-400 hover:bg-red-50 rounded-xl" title="Delete">
                                                <i class="ri-delete-bin-line text-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>

                ${UI.components.modal('addExpenseModal', 'Add Expense', `
                    <form id="addExpenseForm" class="space-y-4" onsubmit="event.preventDefault(); UI.hooks.saveExpense();">
                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('reason') || 'Reason'}</label>
                                <input type="text" id="expReason" required placeholder="" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-primary/20 outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-gray-200 mb-1.5">${i18n.t('amount')} (Rs)</label>
                                <input type="number" id="expAmount" required placeholder="0" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white text-black focus:ring-2 focus:ring-primary/20 outline-none">
                            </div>
                        </div>
                        <button type="submit" class="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 mt-4 active:scale-95 transition-all">
                            ${(i18n.t('saveExpense') || 'Save Expense').toUpperCase()}
                        </button>
                    </form>
                `)}
            `;
        },
        dues: () => {
            const parties = Store.getParties().filter(p => p.balance > 0);
            return `
                <div class="space-y-4 pb-32">
                    <div class="flex items-center gap-3">
                        <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                            <i class="ri-arrow-left-line text-xl"></i>
                        </button>
                        <h2 class="text-2xl font-bold text-white">${i18n.t('duesList')}</h2>
                    </div>

                    <div class="bg-cardBg rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
                        ${parties.length === 0 ? `
                            <div class="p-16 text-center text-slate-500 font-medium">${i18n.t('noDues')}</div>
                        ` : `
                            <div class="divide-y divide-gray-50">
                                ${parties.map(p => `
                                    <div class="p-5 flex justify-between items-center group hover:bg-white/5 transition-colors" onclick="router.navigate('parties')">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-600 text-white flex items-center justify-center text-xl shadow-lg font-black">
                                                ${p.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">${p.name}</div>
                                                <div class="text-[10px] text-slate-500 font-medium tracking-wider uppercase">${p.phone || 'No phone'}</div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-lg font-black text-red-500">${UI.formatMoney(p.balance)}</div>
                                            <div class="text-[10px] font-bold text-slate-500 uppercase">${i18n.t('receivable')}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;
        },

        purchases: () => {
            const purchases = Store.get(Store.KEYS.PURCHASES) || [];
            const summaryPurchases = [...purchases].reverse();
            return `
                <div class="space-y-4 pb-32">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                                <i class="ri-arrow-left-line text-xl"></i>
                            </button>
                            <h2 class="text-2xl font-bold text-white">${i18n.t('purchaseHistory')}</h2>
                        </div>
                        <button onclick="router.navigate('new-purchase')" class="bg-sky-500 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-sky-500/20 flex items-center gap-2 active:scale-95 transition-all">
                            <i class="ri-add-line"></i> ${i18n.t('purchase')}
                        </button>
                    </div>

                    <div class="bg-cardBg rounded-[2rem] shadow-sm border border-white/5 overflow-hidden">
                        ${summaryPurchases.length === 0 ? `
                            <div class="p-16 text-center text-slate-500">${i18n.t('noPurchases')}</div>
                        ` : `
                            <div class="divide-y divide-gray-50">
                                ${summaryPurchases.map(pur => `
                                    <div class="p-5 flex justify-between items-center group hover:bg-white/5 transition-colors">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 text-white flex items-center justify-center text-xl shadow-lg">
                                                <i class="ri-truck-line"></i>
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">${pur.supplier || 'Cash Purchase'}</div>
                                                <div class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                                    ${new Date(pur.date).toLocaleDateString()} • ${pur.items.length} Items
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-4">
                                            <div class="text-right">
                                                <div class="text-lg font-black text-white">${UI.formatMoney(pur.total)}</div>
                                                ${pur.paid < pur.total ? `<div class="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Due: ${UI.formatMoney(pur.total - pur.paid)}</div>` : `<div class="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Paid Full</div>`}
                                            </div>
                                            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onclick="UI.openPurchasePaymentModal('${pur.id}')" class="p-2 text-primary hover:bg-primary/10 rounded-xl" title="Payment">
                                                    <i class="ri-hand-coin-line text-lg"></i>
                                                </button>
                                                <button onclick="UI.hooks.deletePurchase('${pur.id}')" class="p-2 text-red-400 hover:bg-red-50 rounded-xl" title="Delete">
                                                    <i class="ri-delete-bin-line text-lg"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>

                ${UI.components.modal('receivePurchasePaymentModal', 'Pay Supplier', `
                    <form id="receivePurchasePaymentForm" class="space-y-4" onsubmit="event.preventDefault(); UI.hooks.processPurchasePayment()">
                        <input type="hidden" id="payPurchaseId">
                        <div>
                            <label class="block text-sm font-bold text-gray-200 mb-1.5">Amount Due to Supplier</label>
                            <input type="text" id="payPurDueDisplay" disabled class="w-full px-4 py-3 border border-white/5 rounded-xl bg-appBg text-slate-400 font-black">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-200 mb-1.5">Amount Paying (Now)</label>
                            <div class="relative">
                                <span class="absolute left-4 top-3.5 text-slate-500 font-bold">Rs</span>
                                <input type="number" id="payPurAmount" required min="1" class="w-full pl-12 pr-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-black text-lg">
                            </div>
                        </div>
                        <div class="pt-4 flex gap-3">
                            <button type="button" onclick="UI.closeModal('receivePurchasePaymentModal')" class="flex-1 py-3 border border-white/10 rounded-xl text-slate-400 font-bold">Cancel</button>
                            <button type="submit" class="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20">Confirm Pay</button>
                        </div>
                    </form>
                `)}
            `;
        },
        'new-purchase': () => {
            const products = Store.getProducts();
            UI.purchaseState = UI.purchaseState || { items: [] };

            return `
                <div class="space-y-4 pb-32">
                    <div class="flex items-center gap-3">
                        <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                            <i class="ri-arrow-left-line text-xl"></i>
                        </button>
                        <h2 class="text-2xl font-bold text-white">${i18n.t('purchase')}</h2>
                    </div>

                    <div class="bg-cardBg p-6 rounded-[2rem] shadow-sm border border-white/5 space-y-5">
                        <div>
                            <label class="block text-xs font-black text-slate-500 uppercase tracking-tighter mb-2">${i18n.t('supplierName')}</label>
                            <input type="text" id="purSupplier" placeholder="${i18n.t('supplierName')}" class="w-full p-3 rounded-xl bg-appBg border-none font-bold text-gray-200">
                        </div>

                        <div class="pt-4 border-t">
                            <label class="block text-xs font-black text-slate-500 uppercase tracking-tighter mb-2">${i18n.t('selectProduct')}</label>
                            <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                                <div class="md:col-span-8">
                                    ${UI.components.searchableSelect('purProduct', i18n.t('selectProduct'), [
                ...products.map(p => ({ value: p.id, label: p.name, subLabel: `Stock: ${p.stock}` }))
            ])}
                                </div>
                                <div class="md:col-span-2">
                                    <input type="number" id="purQty" placeholder="Qty" value="1" class="w-full p-4 rounded-xl bg-appBg border-none font-bold text-gray-200 focus:ring-2 focus:ring-primary/20">
                                </div>
                                <div class="md:col-span-2">
                                    <button onclick="UI.hooks.addItemToPurchase()" class="w-full h-[56px] bg-sky-500 text-white rounded-xl font-black active:scale-95 transition-all shadow-lg shadow-sky-900/40">
                                        ${i18n.t('addNew').toUpperCase()}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div id="purchaseCartContent" class="mt-4">
                            <div class="text-center py-10 text-slate-500 text-sm">No items added to list</div>
                        </div>
                    </div>
                </div>
            `;
        },
        profitLoss: () => {
            const invoices = Store.get('hk_invoices');
            const expenses = Store.get(Store.KEYS.EXPENSES);
            const products = Store.getProducts();

            const now = new Date();
            const todayStr = now.toDateString();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();

            let todayGross = 0;
            let monthlyGross = 0;
            let yearlyGross = 0;

            invoices.filter(i => i.type === 'SALE').forEach(inv => {
                let invProfit = 0;
                inv.items.forEach(item => {
                    const prod = products.find(p => p.id === item.productId);
                    if (prod && (prod.cost || prod.price)) {
                        const cost = prod.cost || 0;
                        invProfit += (item.price - cost) * item.qty;
                    }
                });
                invProfit -= (inv.discount || 0);

                const invDate = new Date(inv.date);
                if (invDate.toDateString() === todayStr) todayGross += invProfit;
                if (invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear) monthlyGross += invProfit;
                if (invDate.getFullYear() === thisYear) yearlyGross += invProfit;
            });

            const monthlyExpenses = expenses
                .filter(e => {
                    const d = new Date(e.date);
                    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
                })
                .reduce((sum, e) => sum + e.amount, 0);

            const todaySales = invoices
                .filter(inv => inv.type === 'SALE' && new Date(inv.date).toDateString() === todayStr)
                .reduce((sum, inv) => sum + inv.total, 0);

            return `
                <div class="space-y-6 pb-24">
                    <div class="flex items-center gap-3">
                        <button onclick="router.navigate('dashboard')" class="w-10 h-10 rounded-full bg-cardBg shadow-sm flex items-center justify-center text-slate-500">
                            <i class="ri-arrow-left-line text-xl"></i>
                        </button>
                        <h2 class="text-2xl font-bold text-white">Loss / Profit</h2>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-gradient-to-br ${todayGross < 0 ? 'from-red-500 to-rose-700' : 'from-emerald-500 to-teal-600'} p-4 md:p-6 rounded-2xl md:rounded-3xl text-white shadow-lg relative overflow-hidden">
                            ${todayGross < 0 ? '<div class="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div>' : ''}
                            <div class="${todayGross < 0 ? 'text-red-100' : 'text-emerald-100'} text-xs mb-1 uppercase tracking-wider font-bold relative z-10">${todayGross < 0 ? i18n.t('loss') : i18n.t('profit')}</div>
                            <div class="text-2xl md:text-3xl font-black relative z-10">${UI.formatMoney(todayGross)}</div>
                            ${todayGross < 0 ? `<div class="text-xs text-red-100/80 mt-2 font-bold relative z-10 flex items-center gap-1"><i class="ri-error-warning-line"></i> ${i18n.t('todayLossMsg')}</div>` : ''}
                        </div>

                        <div class="bg-cardBg p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 shadow-sm">
                            <div class="text-slate-500 text-xs mb-1 uppercase tracking-wider font-bold">${i18n.t('thisMonthGross')}</div>
                            <div class="text-2xl font-black text-white">${UI.formatMoney(monthlyGross)}</div>
                            <div class="mt-4 flex justify-between items-center text-xs">
                                <span class="text-slate-400">${i18n.t('expenses')}:</span>
                                <span class="text-red-500 font-bold">-${UI.formatMoney(monthlyExpenses)}</span>
                            </div>
                            <div class="mt-2 pt-2 border-t flex justify-between items-center font-bold">
                                <span class="text-white">${i18n.t('netProfit')}:</span>
                                <span class="text-primary">${UI.formatMoney(monthlyGross - monthlyExpenses)}</span>
                            </div>
                        </div>

                        <!-- Expense Distribution Chart -->
                    <div class="bg-cardBg p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 shadow-sm">
                        <h3 class="font-bold text-white mb-4 flex items-center gap-2">
                            <i class="ri-pie-chart-2-line text-primary"></i>
                            ${i18n.t('expenseDistribution')}
                        </h3>
                        <div class="h-48 w-full">
                            <canvas id="expenseChart"></canvas>
                        </div>
                    </div>

                    <div class="bg-indigo-600 p-4 md:p-6 rounded-2xl md:rounded-3xl text-white shadow-lg">

                            <div class="text-indigo-100 text-xs mb-1 uppercase tracking-wider font-bold">${i18n.t('yearlyEarnings')}</div>
                            <div class="text-2xl font-black">${UI.formatMoney(yearlyGross)}</div>
                        </div>
                    </div>

                    ${todayGross < 0 ? `
                    <!-- Loss Alert Banner -->
                    <div class="bg-gradient-to-r from-red-500 to-rose-600 p-4 md:p-6 rounded-2xl md:rounded-3xl text-white shadow-xl border border-red-400/30 animate-pulse">
                        <div class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                <i class="ri-error-warning-fill text-3xl"></i>
                            </div>
                            <div class="flex-1">
                                <h3 class="font-black text-xl mb-2 flex items-center gap-2">
                                    ⚠️ ${i18n.t('lossAlert')}
                                </h3>
                                <p class="text-red-100 text-sm leading-relaxed">
                                    ${i18n.t('lossAdvice', { amount: UI.formatMoney(Math.abs(todayGross)) })}
                                </p>
                                <div class="mt-3 flex gap-2 text-xs">
                                    <span class="bg-white/20 px-3 py-1 rounded-full font-bold">💡 ${i18n.t('tipKharcheKam')}</span>
                                    <span class="bg-white/20 px-3 py-1 rounded-full font-bold">📈 ${i18n.t('tipSalesBarhaein')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div class="bg-blue-50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-blue-100">
                        <h3 class="font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <i class="ri-pie-chart-line"></i> ${i18n.t('performance')}
                        </h3>
                        <div class="space-y-4">
                            <div class="flex justify-between items-center bg-cardBg/60 p-4 rounded-2xl">
                                <div class="text-sm font-medium text-gray-200">${i18n.t('profitMargin')}</div>
                                <div class="text-lg font-bold text-emerald-600">${todaySales > 0 ? Math.round((todayGross / todaySales) * 100) : 0}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },
        partyLedger: () => {
            if (!UI.currentPartyId) return `<div class="p-20 text-center font-bold text-slate-500">Party not selected</div>`;

            const parties = Store.getParties();
            const invoices = Store.get(Store.KEYS.INVOICES);
            const party = parties.find(p => p.id === UI.currentPartyId);

            if (!party) return `<div class="p-20 text-center font-bold text-slate-500">Party not found</div>`;

            const partyInvoices = invoices
                .filter(inv => inv.partyId === party.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            const totalSold = partyInvoices.filter(i => i.type === 'SALE').reduce((sum, inv) => sum + inv.total, 0);
            const totalPaid = partyInvoices.filter(i => i.type === 'SALE').reduce((sum, inv) => sum + inv.paid, 0) +
                partyInvoices.filter(i => i.type === 'PAYMENT').reduce((sum, p) => sum + p.amount, 0);
            const balance = party.balance;

            return `
                <div class="space-y-6 pb-40">
                    <div class="flex justify-between items-center bg-cardBg p-6 rounded-[2rem] border border-white/5 shadow-xl">
                        <div class="flex items-center gap-4">
                            <button onclick="router.navigate('parties')" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                <i class="ri-arrow-left-line text-xl"></i>
                            </button>
                            <div>
                                <h1 class="text-2xl font-black text-white leading-tight">${party.name}</h1>
                                <p class="text-[10px] font-black uppercase tracking-widest text-primary">${party.phone || 'No Phone'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-1">Total Balance</div>
                            <div class="text-2xl font-black ${balance > 0 ? 'text-red-500' : 'text-emerald-500'}">${UI.formatMoney(balance)}</div>
                        </div>
                    </div>

                    <!-- Summary Stats -->
                    <div class="grid grid-cols-3 gap-3">
                        <div class="bg-cardBg p-4 rounded-3xl border border-white/5 shadow-sm">
                            <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Sold</div>
                            <div class="text-xs font-black text-white">${UI.formatMoney(totalSold)}</div>
                        </div>
                        <div class="bg-cardBg p-4 rounded-3xl border border-white/5 shadow-sm">
                            <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Recd.</div>
                            <div class="text-xs font-black text-white">${UI.formatMoney(totalPaid)}</div>
                        </div>
                        <div class="bg-cardBg p-4 rounded-3xl border border-white/5 shadow-sm">
                            <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Items Sort</div>
                            <div class="text-xs font-black text-white">${partyInvoices.length}</div>
                        </div>
                    </div>

                    <!-- History List -->
                    <div class="bg-cardBg rounded-3xl border border-white/5 shadow-xl overflow-hidden">
                        <div class="p-5 border-b border-white/5 flex justify-between items-center">
                            <h3 class="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2">
                                <i class="ri-history-line text-primary"></i>
                                Transaction History
                            </h3>
                        </div>
                        <div class="divide-y divide-white/5">
                            ${partyInvoices.length === 0 ? `
                                <div class="p-10 text-center text-slate-500 text-sm font-medium">No transactions found</div>
                            ` : partyInvoices.map(inv => {
                const isPayment = inv.type === 'PAYMENT';
                return `
                                <div class="p-5 hover:bg-white/5 transition-colors cursor-pointer" onclick="${isPayment ? '' : `UI.hooks.viewInvoiceDetail('${inv.id}')`}">
                                    <div class="flex justify-between items-center mb-1">
                                        <div class="font-bold text-white text-sm flex items-center gap-2">
                                            <span class="w-1.5 h-1.5 rounded-full ${isPayment ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                                            ${isPayment ? 'Cash Received' : `Bill #${inv.id.slice(-6)}`}
                                        </div>
                                        <div class="font-black ${isPayment ? 'text-emerald-500' : 'text-red-500'}">
                                            ${isPayment ? '+ ' + UI.formatMoney(inv.amount) : '- ' + UI.formatMoney(inv.total)}
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center text-[10px]">
                                        <div class="text-slate-500 font-medium">${new Date(inv.date).toLocaleDateString()} ${isPayment ? '' : `• ${inv.items.length} Items`}</div>
                                        <div class="${isPayment ? 'text-emerald-500/60' : (inv.due > 0 ? 'text-red-500' : 'text-emerald-500')} font-black uppercase">
                                            ${isPayment ? 'Direct Payment' : (inv.due > 0 ? 'Due: ' + UI.formatMoney(inv.due) : 'Paid Full')}
                                        </div>
                                    </div>
                                </div>
                            `}).join('')}
                        </div>
                    </div>

                    <!-- Quick Actions Bottom Bar -->
                    <div class="fixed bottom-24 left-4 right-4 max-w-5xl mx-auto flex gap-3 z-40">
                        <button onclick="UI.hooks.openQuickSale()" class="flex-1 bg-gradient-to-r from-red-600 to-rose-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-900/40 flex items-center justify-center gap-2 transform active:scale-95 transition-all">
                            <i class="ri-bill-line text-xl"></i>
                            GIVE SALE (RED)
                        </button>
                        <button onclick="UI.hooks.openQuickReceive()" class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transform active:scale-95 transition-all">
                            <i class="ri-hand-coin-line text-xl"></i>
                            RECIEVE (GREEN)
                        </button>
                    </div>
                </div>
            `;
        },
        '404': () => `<div class="p-20 text-center font-bold text-slate-500">404 - Page Not Found</div>`

    },

    components: {
        modal: (id, title, content) => `
            <div id="${id}" class="fixed inset-0 z-[100] hidden overflow-y-auto bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div class="min-h-screen px-4 flex items-center justify-center">
                    <div class="bg-cardBg w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div class="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 class="text-xl font-black text-white uppercase tracking-tight">${title}</h3>
                            <button onclick="UI.closeModal('${id}')" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all">
                                <i class="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <div class="p-6">
                            ${content}
                        </div>
                    </div>
                </div>
            </div>
        `,
        searchableSelect: (id, placeholder, options, onSelectChange = '') => {
            return `
                <div class="relative searchable-select" id="wrapper-${id}">
                    <div class="relative group">
                        <i class="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors"></i>
                        <input type="text" 
                               id="search-${id}" 
                               placeholder="${placeholder}" 
                               autocomplete="off"
                               class="w-full pl-11 pr-10 py-4 rounded-2xl bg-appBg border-none font-bold text-white focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                               onfocus="this.nextElementSibling.classList.remove('hidden')"
                               oninput="UI.hooks.filterSearchSelect('${id}', this.value)">
                        <i class="ri-arrow-down-s-line absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none transition-transform group-focus-within:rotate-180"></i>
                        <div id="dropdown-${id}" class="absolute left-0 right-0 top-full mt-2 bg-cardBg border border-white/5 rounded-2xl shadow-2xl z-[150] max-h-[300px] overflow-y-auto hidden divide-y divide-white/5 backdrop-blur-xl">
                            ${options.map(opt => `
                                <div class="px-5 py-3.5 hover:bg-white/5 cursor-pointer flex flex-col transition-colors searchable-item" 
                                     data-value="${opt.value}" 
                                     data-search="${opt.label.toLowerCase()} ${opt.subLabel ? opt.subLabel.toLowerCase() : ''}"
                                     onclick="UI.hooks.selectSearchItem('${id}', '${opt.value}', '${opt.label.replace(/'/g, "\\'")}', '${onSelectChange}')">
                                    <div class="font-bold text-white text-sm">${opt.label}</div>
                                    ${opt.subLabel ? `<div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">${opt.subLabel}</div>` : ''}
                                </div>
                            `).join('')}
                            <div class="p-8 text-center text-slate-500 text-xs font-bold no-results hidden">
                                <i class="ri-search-eye-line text-2xl mb-1 block opacity-50"></i>
                                NO MATCHES FOUND
                            </div>
                        </div>
                    </div>
                    <input type="hidden" id="${id}" value="">
                </div>
            `;
        }
    },

    // Modal Logic
    openModal(id) {
        const modal = document.getElementById(id);
        const content = document.getElementById(id + '-content');
        if (modal) {
            modal.classList.remove('hidden');
            // Small timeout for transition
            setTimeout(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
        }
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        const content = document.getElementById(id + '-content');
        if (modal) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    },

    // State for New Purchase
    purchaseState: {
        items: []
    },

    // Hooks (Event Listeners)
    hooks: {
        dashboard: () => {
            const canvas = document.getElementById('salesChart');
            if (!canvas || typeof Chart === 'undefined') return;

            const invoices = Store.get(Store.KEYS.INVOICES);
            const days = [];
            const data = [];

            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                days.push(dayName);

                const dayTotal = invoices
                    .filter(inv => inv.type === 'SALE' && new Date(inv.date).toDateString() === date.toDateString())
                    .reduce((sum, inv) => sum + inv.total, 0);
                data.push(dayTotal);
            }

            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Sales',
                        data: data,
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#F59E0B',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1E293B',
                            titleColor: '#F59E0B',
                            bodyColor: '#fff',
                            displayColors: false,
                            padding: 12,
                            cornerRadius: 12
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#64748b', font: { size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#64748b', font: { size: 10 } }
                        }
                    }
                }
            });
        },

        profitLoss: () => {
            const canvas = document.getElementById('expenseChart');
            if (!canvas || typeof Chart === 'undefined') return;

            const expenses = Store.get(Store.KEYS.EXPENSES);
            const now = new Date();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();

            const monthlyExp = expenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
            });

            // Group by reason
            const grouped = {};
            monthlyExp.forEach(e => {
                const reason = e.reason || 'General';
                grouped[reason] = (grouped[reason] || 0) + e.amount;
            });

            const labels = Object.keys(grouped);
            const data = Object.values(grouped);

            if (labels.length === 0) {
                new Chart(canvas, {
                    type: 'doughnut',
                    data: {
                        labels: ['No Expenses'],
                        datasets: [{
                            data: [1],
                            backgroundColor: ['rgba(255,255,255,0.05)'],
                            borderWidth: 0
                        }]
                    },
                    options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
                return;
            }

            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'
                        ],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#94a3b8', font: { size: 10, weight: 'bold' }, padding: 10 }
                        },
                        tooltip: {
                            backgroundColor: '#1E293B',
                            padding: 12,
                            cornerRadius: 12
                        }
                    }
                }
            });
        },

        saveSetup: () => {


            const settings = {
                businessName: document.getElementById('setupBizName').value,
                phone: document.getElementById('setupPhone').value,
                owner: document.getElementById('setupOwner').value,
                setupFinished: true
            };
            Store.saveSettings(settings);
            window.location.reload();
        },

        resetApp: () => {
            Store.reset();
        },

        saveExpense: () => {
            const reason = document.getElementById('expReason').value;
            const amount = Number(document.getElementById('expAmount').value);
            if (!reason || amount <= 0) return UI.showToast('Invalid Details', 'error');

            const expenses = Store.get(Store.KEYS.EXPENSES);
            expenses.push({
                id: Date.now().toString(),
                reason,
                amount,
                date: new Date().toISOString()
            });
            Store.save(Store.KEYS.EXPENSES, expenses);
            UI.closeModal('addExpenseModal');
            router.navigate('expenses');
        },

        saveParty: () => {
            const name = document.getElementById('partyName').value;
            const phone = document.getElementById('partyPhone').value;
            const type = document.getElementById('partyType').value;
            const balance = Number(document.getElementById('partyBalance').value) || 0;

            if (!name) return UI.showToast('Pehle naam enter karein', 'error');

            Store.addParty({ name, phone, type, balance });
            UI.closeModal('addPartyModal');
            router.navigate('parties');
        },

        saveProduct: () => {
            const name = document.getElementById('prodName').value;
            const price = Number(document.getElementById('prodPrice').value);
            const cost = Number(document.getElementById('prodCost').value);
            const stock = Number(document.getElementById('prodStock').value);
            const unit = document.getElementById('prodUnit').value;
            const minStock = Number(document.getElementById('prodMin').value) || 5;

            if (!name || price <= 0) return UI.showToast('Details sahi se bharein', 'error');

            Store.addProduct({ name, price, cost, stock, unit, minStock, category: 'General' });
            UI.closeModal('addProductModal');
            router.navigate('stock');
        },

        addItemToPurchase: () => {
            const productId = document.getElementById('purProduct').value;
            const qty = Number(document.getElementById('purQty').value);

            if (!productId || qty <= 0) return UI.showToast('Pehle product aur quantity select karein', 'error');

            const products = Store.getProducts();
            const product = products.find(p => p.id === productId);
            if (!product) return;

            UI.purchaseState.items.push({
                productId,
                name: product.name,
                qty,
                price: product.cost || product.price,
                total: (product.cost || product.price) * qty
            });

            UI.hooks.renderPurchaseCart();
        },

        renderPurchaseCart: () => {
            const container = document.getElementById('purchaseCartContent');
            if (!container) return;

            if (UI.purchaseState.items.length === 0) {
                container.innerHTML = `<div class="text-center py-10 text-slate-500 text-sm">No items added to list</div>`;
                return;
            }

            const total = UI.purchaseState.items.reduce((sum, i) => sum + i.total, 0);

            container.innerHTML = `
                <div class="space-y-4">
                    <div class="divide-y divide-gray-100 bg-appBg rounded-2xl p-4">
                        ${UI.purchaseState.items.map((item, index) => `
                            <div class="py-3 flex justify-between items-center text-sm">
                                <div>
                                    <div class="font-bold text-white">${item.name}</div>
                                    <div class="text-[10px] text-slate-400">${item.qty} x ${UI.formatMoney(item.price)}</div>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="font-black text-white">${UI.formatMoney(item.total)}</div>
                                    <button onclick="UI.purchaseState.items.splice(${index}, 1); UI.hooks.renderPurchaseCart();" class="text-red-400 hover:text-red-600 p-2 bg-cardBg rounded-xl shadow-sm"><i class="ri-delete-bin-line"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="p-5 bg-primary/5 rounded-2xl flex justify-between items-center">
                        <span class="font-bold text-slate-500">${i18n.t('purchase')}:</span>
                        <span class="text-2xl font-black text-sky-500">${UI.formatMoney(total)}</span>
                    </div>
                    <button onclick="UI.hooks.savePurchase()" class="w-full py-4 bg-sky-600 text-white rounded-2xl font-black shadow-lg shadow-sky-900/40 active:scale-95 transition-all text-lg">
                        ${i18n.t('completePurchase').toUpperCase()}
                    </button>
                </div>
            `;
        },

        savePurchase: () => {
            if (UI.purchaseState.items.length === 0) return UI.showToast('Koi item to add karein!', 'error');

            const supplier = document.getElementById('purSupplier').value;
            const total = UI.purchaseState.items.reduce((sum, i) => sum + i.total, 0);

            const purchase = {
                id: Date.now().toString(),
                supplier: supplier || 'Cash Purchase',
                date: new Date().toISOString(),
                items: [...UI.purchaseState.items],
                total
            };

            const purchases = Store.get(Store.KEYS.PURCHASES);
            purchases.push(purchase);
            Store.save(Store.KEYS.PURCHASES, purchases);

            const products = Store.getProducts();
            purchase.items.forEach(item => {
                const prod = products.find(p => p.id === item.productId);
                if (prod) prod.stock += item.qty;
            });
            Store.save(Store.KEYS.PRODUCTS, products);

            UI.showToast('Purchase Recorded & Stock Updated!');
            UI.purchaseState.items = [];
            router.navigate('purchases');
        },

        deleteExpense: (id) => {
            // Removed confirmation for faster workflow
            let expenses = Store.get(Store.KEYS.EXPENSES);
            expenses = expenses.filter(e => e.id !== id);
            Store.save(Store.KEYS.EXPENSES, expenses);
            router.navigate('expenses');
        },

        deletePurchase: (id) => {
            // Removed confirmation for faster workflow
            const purchases = Store.get(Store.KEYS.PURCHASES);
            const pur = purchases.find(p => p.id === id);
            if (pur) {
                const products = Store.getProducts();
                pur.items.forEach(item => {
                    const prod = products.find(p => p.id === item.productId);
                    if (prod) prod.stock -= item.qty;
                });
                Store.save(Store.KEYS.PRODUCTS, products);
                const newPurchases = purchases.filter(p => p.id !== id);
                Store.save(Store.KEYS.PURCHASES, newPurchases);
            }
            router.navigate('purchases');
        },

        deleteParty: (id) => {
            // Removed confirmation for faster workflow
            Store.deleteParty(id);
            router.navigate('parties');
        },

        deleteProduct: (id) => {
            // Removed confirmation for faster workflow
            Store.deleteProduct(id);
            router.navigate('stock');
        },

        onProductSelect: (select) => {
            const option = select.options[select.selectedIndex];
            if (option.value) {
                document.getElementById('itemPrice').value = option.dataset.price;
                document.getElementById('itemQty').focus();
            }
        },

        addItemToCart: () => {
            const select = document.getElementById('itemSelect');
            const qtyInput = document.getElementById('itemQty');
            const priceInput = document.getElementById('itemPrice');

            const productId = select.value;
            if (!productId) return UI.showToast('Select a product', 'error');

            const option = select.options[select.selectedIndex];
            const name = option.dataset.name;
            const qty = Number(qtyInput.value);
            const price = Number(priceInput.value);

            if (qty <= 0) return UI.showToast('Invalid Qty', 'error');

            const existing = UI.cartState.items.find(i => i.productId === productId);
            if (existing) {
                existing.qty += qty;
                existing.price = price;
                existing.total = existing.qty * price;
            } else {
                UI.cartState.items.push({ productId, name, qty, price, total: qty * price });
            }

            select.value = "";
            qtyInput.value = 1;
            priceInput.value = "";
            UI.hooks.renderCart();
            UI.hooks.updateCartTotals();
        },

        removeItemFromCart: (index) => {
            UI.cartState.items.splice(index, 1);
            UI.hooks.renderCart();
            UI.hooks.updateCartTotals();
        },

        renderCart: () => {
            const tbody = document.getElementById('cartTableBody');
            if (!tbody) return;
            if (UI.cartState.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-slate-500">Cart is empty</td></tr>';
                return;
            }
            tbody.innerHTML = UI.cartState.items.map((item, idx) => `
                <tr class="border-b border-gray-50 hover:bg-white/5 transition-colors">
                    <td class="px-4 py-4 font-bold text-white">${item.name}</td>
                    <td class="px-4 py-4 text-center text-slate-400 font-medium">${item.qty}</td>
                    <td class="px-4 py-4 text-right text-slate-500 font-medium">${item.price}</td>
                    <td class="px-4 py-4 text-right font-black text-white">${item.total}</td>
                    <td class="px-4 py-4 text-center">
                        <button onclick="UI.hooks.removeItemFromCart(${idx})" class="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors"><i class="ri-delete-bin-line"></i></button>
                    </td>
                </tr>
            `).join('');
        },

        updateCartTotals: () => {
            const subTotal = UI.cartState.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const discount = Number(document.getElementById('cartDiscount')?.value || 0);
            const grandTotal = Math.max(0, subTotal - discount);
            const paidInput = document.getElementById('cartPaid');

            // Removed auto-fill logic - user should manually enter payment amount

            const paid = Number(paidInput?.value || 0);
            const balance = grandTotal - paid;

            if (document.getElementById('cartSubTotal')) document.getElementById('cartSubTotal').textContent = UI.formatMoney(subTotal);
            if (document.getElementById('cartTotal')) document.getElementById('cartTotal').textContent = UI.formatMoney(grandTotal);

            const balEl = document.getElementById('cartBalance');
            const labelEl = document.getElementById('cartBalanceLabel');
            if (balEl) {
                balEl.textContent = UI.formatMoney(Math.abs(balance));
                if (balance > 0) {
                    balEl.className = "text-xl font-black text-red-700";
                    if (labelEl) labelEl.textContent = "Balance (Udhaar)";
                } else {
                    balEl.className = "text-xl font-black text-emerald-700";
                    if (labelEl) labelEl.textContent = "Change (Wapis)";
                }
            }
        },

        saveInvoice: () => {
            if (UI.cartState.items.length === 0) return UI.showToast('Cart is empty!', 'error');
            const partyId = document.getElementById('saleParty').value;
            const subTotal = UI.cartState.items.reduce((sum, item) => sum + item.total, 0);
            const discount = Number(document.getElementById('cartDiscount')?.value || 0);
            const grandTotal = Math.max(0, subTotal - discount);
            const paid = Number(document.getElementById('cartPaid')?.value || 0);
            const due = Math.max(0, grandTotal - paid);

            const invoice = {
                id: Date.now().toString(),
                date: document.getElementById('invoiceDate').value ? new Date(document.getElementById('invoiceDate').value).toISOString() : new Date().toISOString(),
                partyId: partyId || null,
                partyName: partyId ? document.querySelector(`#saleParty option[value="${partyId}"]`).textContent.split('(')[0].trim() : 'Cash Sale',
                items: [...UI.cartState.items],
                subTotal, discount, total: grandTotal, paid, due,
                type: 'SALE'
            };

            const invoices = Store.get(Store.KEYS.INVOICES);
            invoices.push(invoice);
            Store.save(Store.KEYS.INVOICES, invoices);

            const products = Store.getProducts();
            invoice.items.forEach(item => {
                const prod = products.find(p => p.id === item.productId);
                if (prod) prod.stock -= item.qty;
            });
            Store.save(Store.KEYS.PRODUCTS, products);

            if (partyId) {
                const parties = Store.getParties();
                const party = parties.find(p => p.id === partyId);
                if (party) party.balance += due;
                Store.save(Store.KEYS.PARTIES, parties);
            }

            UI.showToast('Sale Saved!');
            UI.cartState.items = [];
            router.navigate('dashboard');
        },

        deleteInvoice: (id) => {
            // Removed confirmation for faster workflow
            const invoices = Store.get(Store.KEYS.INVOICES);
            const inv = invoices.find(i => i.id === id);

            if (inv) {
                // Restore Stock (Only if it was a Sale)
                if (inv.items) {
                    const products = Store.getProducts();
                    inv.items.forEach(item => {
                        const prod = products.find(p => p.id === item.productId);
                        if (prod) prod.stock += item.qty;
                    });
                    Store.save(Store.KEYS.PRODUCTS, products);
                }

                // Restore Balance
                if (inv.partyId) {
                    const parties = Store.getParties();
                    const party = parties.find(p => p.id === inv.partyId);
                    if (party) {
                        if (inv.type === 'SALE' && inv.due > 0) {
                            party.balance -= inv.due;
                        } else if (inv.type === 'PAYMENT') {
                            party.balance += inv.amount;
                        }
                    }
                    Store.save(Store.KEYS.PARTIES, parties);
                }

                Store.deleteInvoice(id);
                UI.showToast('Transaction Deleted');
            }
            router.navigate('sales');
        },

        deleteInvoiceGroup: (partyId) => {
            const invoices = Store.get(Store.KEYS.INVOICES);
            const groupInvoices = invoices.filter(inv => (inv.partyId || 'CASH') === partyId);

            if (groupInvoices.length === 0) return;

            const products = Store.getProducts();
            const parties = Store.getParties();
            const party = parties.find(p => p.id === partyId);

            groupInvoices.forEach(inv => {
                // 1. Restore Stock
                if (inv.items) {
                    inv.items.forEach(item => {
                        const prod = products.find(p => p.id === item.productId);
                        if (prod) prod.stock += item.qty;
                    });
                }

                // 2. Restore Balance
                if (party) {
                    if (inv.type === 'SALE' && inv.due > 0) {
                        party.balance -= inv.due;
                    } else if (inv.type === 'PAYMENT') {
                        party.balance += inv.amount;
                    }
                }
            });

            // Save state
            Store.save(Store.KEYS.PRODUCTS, products);
            if (party) Store.save(Store.KEYS.PARTIES, parties);

            // Bulk Delete
            const remainingInvoices = invoices.filter(inv => (inv.partyId || 'CASH') !== partyId);
            Store.save(Store.KEYS.INVOICES, remainingInvoices);

            UI.showToast(`${groupInvoices.length} Bills Deleted & Stock Restored!`);
            router.navigate('sales');
        },

        openPaymentModal: (id, due) => {
            document.getElementById('payInvoiceId').value = id;
            document.getElementById('payDueDisplay').value = UI.formatMoney(due);
            document.getElementById('payAmount').value = due;
            UI.openModal('receivePaymentModal');
        },

        processPayment: () => {
            const invoiceId = document.getElementById('payInvoiceId').value;
            const amount = Number(document.getElementById('payAmount').value);
            if (amount <= 0) return UI.showToast('Invalid Amount', 'error');

            const invoices = Store.get(Store.KEYS.INVOICES);
            const invoice = invoices.find(inv => inv.id === invoiceId);
            if (!invoice) return;

            invoice.paid += amount;
            invoice.due -= amount;
            Store.save(Store.KEYS.INVOICES, invoices);

            if (invoice.partyId) {
                const parties = Store.getParties();
                const party = parties.find(p => p.id === invoice.partyId);
                if (party) party.balance -= amount;
                Store.save(Store.KEYS.PARTIES, parties);
            }
            UI.closeModal('receivePaymentModal');
            router.navigate('sales');
        },

        openPurchasePaymentModal: (id) => {
            const purchases = Store.get(Store.KEYS.PURCHASES);
            const pur = purchases.find(p => p.id === id);
            if (!pur) return;
            const due = pur.total - (pur.paid || 0);
            document.getElementById('payPurchaseId').value = id;
            document.getElementById('payPurDueDisplay').value = UI.formatMoney(due);
            document.getElementById('payPurAmount').value = due;
            UI.openModal('receivePurchasePaymentModal');
        },

        processPurchasePayment: () => {
            const purchaseId = document.getElementById('payPurchaseId').value;
            const amount = Number(document.getElementById('payPurAmount').value);
            if (amount <= 0) return UI.showToast('Invalid Amount', 'error');

            const purchases = Store.get(Store.KEYS.PURCHASES);
            const pur = purchases.find(p => p.id === purchaseId);
            if (!pur) return;

            pur.paid = (pur.paid || 0) + amount;
            Store.save(Store.KEYS.PURCHASES, purchases);

            UI.closeModal('receivePurchasePaymentModal');
            router.navigate('purchases');
        },

        viewInvoiceDetail: (id) => {
            const invoices = Store.get(Store.KEYS.INVOICES);
            const inv = invoices.find(i => i.id === id);
            if (!inv) return;

            const modalId = 'invoiceDetailModal';
            const settings = Store.getSettings();

            const modalContent = `
                <div id="printableBill" class="p-6 bg-white text-black rounded-lg">
                    <!-- Bill Header -->
                    <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
                        <div>
                            <h2 class="text-2xl font-black uppercase text-slate-900">${settings.businessName || 'Hisab Kitab'}</h2>
                            <p class="text-sm font-bold text-slate-600">${settings.owner || ''}</p>
                            <p class="text-xs text-slate-500">${settings.phone || ''}</p>
                        </div>
                        <div class="text-right">
                            <h3 class="text-lg font-black text-slate-900">INVOICE</h3>
                            <p class="text-xs font-bold text-slate-500">#${inv.id.slice(-6)}</p>
                            <p class="text-xs font-medium">${new Date(inv.date).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <!-- Bill Body -->
                    <div class="mb-4">
                        <div class="text-xs font-bold text-slate-400 mb-1 uppercase">Customer</div>
                        <div class="text-sm font-black text-slate-800">${inv.partyName || 'Cash Sale'}</div>
                    </div>

                    <table class="w-full text-sm mb-4">
                        <thead>
                            <tr class="border-b-2 border-slate-200">
                                <th class="text-left py-2">Item</th>
                                <th class="text-center py-2">Qty</th>
                                <th class="text-right py-2">Price</th>
                                <th class="text-right py-2">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inv.items.map(item => `
                                <tr class="border-b border-slate-100">
                                    <td class="py-2 font-bold">${item.name}</td>
                                    <td class="py-2 text-center">${item.qty}</td>
                                    <td class="py-2 text-right">${UI.formatMoney(item.price)}</td>
                                    <td class="py-2 text-right font-black">${UI.formatMoney(item.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- Bill Footer -->
                    <div class="space-y-1 text-right">
                        <div class="flex justify-between text-xs font-bold text-slate-500">
                            <span>Subtotal:</span>
                            <span>${UI.formatMoney(inv.subTotal)}</span>
                        </div>
                        ${inv.discount ? `
                            <div class="flex justify-between text-xs font-bold text-red-500">
                                <span>Discount:</span>
                                <span>-${UI.formatMoney(inv.discount)}</span>
                            </div>
                        ` : ''}
                        <div class="flex justify-between text-lg font-black text-slate-900 pt-2 border-t">
                            <span>Total Amount:</span>
                            <span>${UI.formatMoney(inv.total)}</span>
                        </div>
                        <div class="flex justify-between text-xs font-bold text-emerald-600">
                            <span>Amount Paid:</span>
                            <span>${UI.formatMoney(inv.paid)}</span>
                        </div>
                        ${inv.due > 0 ? `
                            <div class="flex justify-between text-sm font-black text-red-600">
                                <span>Balance Due:</span>
                                <span>${UI.formatMoney(inv.due)}</span>
                            </div>
                        ` : ''}
                    </div>

                    <div class="mt-8 pt-4 border-t border-dashed text-center">
                        <p class="text-[10px] font-bold text-slate-400">Thank you for your business!</p>
                        <p class="text-[8px] text-slate-300">Generated by Hisab Kitab App</p>
                    </div>
                </div>

                <div class="mt-6 flex gap-3">
                    <button onclick="UI.hooks.downloadBillPDF('${inv.id}')" class="flex-1 bg-primary text-white py-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                        <i class="ri-download-cloud-2-line text-xl"></i>
                        DOWNLOAD PDF
                    </button>
                    <button onclick="UI.hooks.shareBill('${inv.id}')" class="w-14 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
                        <i class="ri-whatsapp-line text-2xl"></i>
                    </button>
                </div>
            `;

            // If modal container doesn't exist, create it once
            if (!document.getElementById(modalId)) {
                const modalDiv = document.createElement('div');
                modalDiv.innerHTML = UI.components.modal(modalId, 'Bill Detail', '<div id="invoiceDetailContainer"></div>');
                document.body.appendChild(modalDiv.firstElementChild);
            }

            document.getElementById('invoiceDetailContainer').innerHTML = modalContent;
            UI.openModal(modalId);
        },

        downloadBillPDF: (id) => {
            const element = document.getElementById('printableBill');
            const options = {
                margin: 10,
                filename: `Invoice_${id.slice(-6)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(options).from(element).save();
        },

        shareBill: (id) => {
            const invoices = Store.get(Store.KEYS.INVOICES);
            const inv = invoices.find(i => i.id === id);
            if (!inv) return;
            const settings = Store.getSettings();

            const message = `*${settings.businessName} - Bill Summary*\n\n` +
                `Invoice: #${id.slice(-6)}\n` +
                `Date: ${new Date(inv.date).toLocaleDateString()}\n` +
                `Customer: ${inv.partyName || 'Cash Sale'}\n` +
                `-------------------\n` +
                `Total: ${UI.formatMoney(inv.total)}\n` +
                `Paid: ${UI.formatMoney(inv.paid)}\n` +
                `Balance: ${UI.formatMoney(inv.due)}\n\n` +
                `Shukriya for Business!`;

            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        },

        viewPartyLedger: (id) => {
            UI.currentPartyId = id;
            router.navigate('partyLedger');
        },

        openQuickSale: () => {
            if (!UI.currentPartyId) return;
            UI.cartState = { items: [], partyId: UI.currentPartyId, paid: 0 };
            router.navigate('new-sale');
        },

        openQuickReceive: () => {
            const parties = Store.getParties();
            const party = parties.find(p => p.id === UI.currentPartyId);
            if (!party) return;

            const modalId = 'quickReceiveModal';
            const modalContent = `
                <div class="space-y-4">
                    <div class="bg-cardBg p-4 rounded-2xl border border-white/5 shadow-sm mb-4">
                        <div class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Balance</div>
                        <div class="text-xl font-black ${party.balance > 0 ? 'text-red-500' : 'text-emerald-500'}">${UI.formatMoney(party.balance)}</div>
                    </div>
                    <div>
                        <label class="block text-xs font-black text-slate-500 uppercase tracking-tighter mb-2">Receive Amount (Kitne Paise Diye?)</label>
                        <input type="number" id="quickRecAmount" class="w-full p-4 rounded-xl bg-appBg border-none text-2xl font-black text-white focus:ring-2 focus:ring-emerald-500/20" value="${Math.max(0, party.balance)}">
                    </div>
                    <div>
                        <label class="block text-xs font-black text-slate-500 uppercase tracking-tighter mb-2">Date</label>
                        <input type="date" id="quickRecDate" class="w-full p-4 rounded-xl bg-appBg border-none font-bold text-gray-200" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <button onclick="UI.hooks.processQuickReceive()" class="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-900/20 active:scale-95 transition-all text-lg mt-4">
                        CONFIRM RECEIPT ✅
                    </button>
                </div>
            `;

            // If modal container doesn't exist, create it once
            if (!document.getElementById(modalId)) {
                const modalDiv = document.createElement('div');
                modalDiv.innerHTML = UI.components.modal(modalId, 'Receive Cash', '<div id="quickRecContainer"></div>');
                document.body.appendChild(modalDiv.firstElementChild);
            }

            document.getElementById('quickRecContainer').innerHTML = modalContent;
            UI.openModal(modalId);
        },

        processQuickReceive: () => {
            const amount = Number(document.getElementById('quickRecAmount').value);
            const date = document.getElementById('quickRecDate').value;
            if (amount <= 0) return UI.showToast('Sahi amount likhein', 'error');

            const parties = Store.getParties();
            const party = parties.find(p => p.id === UI.currentPartyId);
            if (!party) return;

            // Update Party Balance
            party.balance -= amount;
            Store.save(Store.KEYS.PARTIES, parties);

            // Save as a Payment Record in Invoices (Ledger entry)
            const invoices = Store.get(Store.KEYS.INVOICES);
            invoices.push({
                id: 'PAY-' + Date.now(),
                partyId: party.id,
                partyName: party.name,
                amount: amount,
                date: new Date(date).toISOString(),
                type: 'PAYMENT',
                note: 'Quick Receive from Ledger'
            });
            Store.save(Store.KEYS.INVOICES, invoices);

            UI.showToast('Paisa Jama Ho Gaya! (Payment Received)');
            UI.closeModal('quickReceiveModal');
            router.navigate('partyLedger');
        },
        filterParties: () => {
            const searchTerm = document.getElementById('partySearch').value.toLowerCase();
            const filterType = document.getElementById('partyTypeFilter').value;
            const items = document.querySelectorAll('.party-item');
            let visibleCount = 0;

            items.forEach(item => {
                const name = item.dataset.name;
                const type = item.dataset.type;

                const matchesSearch = name.includes(searchTerm);
                const matchesType = filterType === 'ALL' || type === filterType;

                if (matchesSearch && matchesType) {
                    item.classList.remove('hidden');
                    visibleCount++;
                } else {
                    item.classList.add('hidden');
                }
            });

            const noResults = document.getElementById('noPartyMatch');
            if (noResults) {
                if (visibleCount === 0 && items.length > 0) {
                    noResults.classList.remove('hidden');
                } else {
                    noResults.classList.add('hidden');
                }
            }
        },

        filterSearchSelect: (id, query) => {
            const container = document.getElementById(`dropdown-${id}`);
            const items = container.querySelectorAll('.searchable-item');
            const noResults = container.querySelector('.no-results');
            const q = query.toLowerCase();
            let visibleCount = 0;

            items.forEach(item => {
                const search = item.dataset.search;
                if (search.includes(q)) {
                    item.classList.remove('hidden');
                    visibleCount++;
                } else {
                    item.classList.add('hidden');
                }
            });

            if (visibleCount === 0) noResults.classList.remove('hidden');
            else noResults.classList.add('hidden');

            container.classList.remove('hidden');
        },

        selectSearchItem: (id, value, label, onSelectChange = '') => {
            const input = document.getElementById(`search-${id}`);
            const hidden = document.getElementById(id);
            const container = document.getElementById(`dropdown-${id}`);

            input.value = label;
            hidden.value = value;
            container.classList.add('hidden');

            if (onSelectChange) {
                // Execute callback string or function
                if (typeof onSelectChange === 'function') {
                    onSelectChange(value);
                } else {
                    // Try to execute as a hook call
                    try {
                        const parts = onSelectChange.split('=');
                        if (parts.length === 2 && parts[0].trim() === 'UI.cartState.partyId') {
                            UI.cartState.partyId = value;
                        } else {
                            eval(onSelectChange);
                        }
                    } catch (e) { console.error('Callback error:', e); }
                }
            }
        }
    },



    cartState: { items: [], partyId: '', paid: 0 },
    purchaseState: { items: [] }
};

// Make it globally available
window.UI = UI;


// Also make it globally available for backward compatibility
window.UI = UI;
