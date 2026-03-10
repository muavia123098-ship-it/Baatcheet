// Authentication Module
// Simplified for local storage usage (Google Login Removed)

const Auth = {
    currentUser: {
        uid: 'local-user',
        email: 'local@business.com'
    },

    // Initialize auth state
    init() {
        return Promise.resolve(this.currentUser);
    },

    // Check if user is logged in
    isLoggedIn() {
        return true;
    },

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    },

    // Get user ID
    getUserId() {
        return this.currentUser.uid;
    }
};

window.Auth = Auth;
