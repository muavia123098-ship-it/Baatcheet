// App Module
// Relying on global Auth, Store, and UI



const router = {
    currentPage: 'dashboard',

    init() {
        // Handle initial load
        this.navigate('dashboard');
    },

    navigate(page) {
        this.currentPage = page;
        this.updateActiveNav();
        this.renderPage(page);
    },

    updateActiveNav() {
        document.querySelectorAll('.nav-item').forEach(el => {
            const isDesktop = el.classList.contains('hover:bg-white/10');

            if (el.dataset.page === this.currentPage) {
                // Active State
                if (isDesktop) {
                    el.classList.add('bg-white/10', 'text-white');
                    el.classList.remove('text-gray-500', 'text-gray-300', 'text-primary');
                } else {
                    // Mobile Active
                    el.classList.add('text-primary');
                    el.classList.remove('text-gray-500');
                }
            } else {
                // Inactive State
                el.classList.remove('text-primary');

                if (isDesktop) {
                    el.classList.remove('bg-white/10', 'text-gray-500');
                    el.classList.add('text-gray-300'); // Slightly dim white for inactive
                } else {
                    // Mobile Inactive
                    el.classList.add('text-gray-500');
                }
            }
        });
    },

    renderPage(page) {
        const container = document.getElementById('app-container');
        container.innerHTML = UI.pages[page] ? UI.pages[page]() : UI.pages['404']();

        // After render hooks (attach listeners etc)
        if (UI.hooks[page]) UI.hooks[page]();
    }
};

// App State Management
const AppState = {
    async init() {
        // Initialize Auth (Stubbed)
        const user = await Auth.init();

        // Directly proceed to login logic (which now just initializes the app)
        await this.onUserLoggedIn(user);
    },

    async onUserLoggedIn(user) {
        console.log('App initialized as local-only');

        // Initialize Store
        Store.init();

        // Initialize router
        router.init();

        // Setup check on every route change
        window.addEventListener('hashchange', () => {
            const settings = Store.getSettings();
            if (!settings.setupFinished && window.location.hash !== '#setup') {
                window.location.hash = '#setup';
            }
        });

        // Initial check
        const settings = Store.getSettings();
        if (!settings.setupFinished) {
            window.location.hash = '#setup';
        }
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();

    // Global click listener for Searchable Selects
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.searchable-select')) {
            document.querySelectorAll('.searchable-select div[id^="dropdown-"]').forEach(d => d.classList.add('hidden'));
        }
    });
});

// Export for global access
window.router = router;
window.Auth = Auth;
