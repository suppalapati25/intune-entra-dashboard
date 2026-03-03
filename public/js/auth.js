/**
 * Auth Module — handles login/logout flow and session checking
 */
window.Auth = (() => {
    let currentUser = null;

    async function checkAuth() {
        try {
            const resp = await fetch('/api/auth/me');
            const data = await resp.json();
            if (data.authenticated) {
                currentUser = data.user;
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    function getUser() {
        return currentUser;
    }

    function showLogin() {
        document.getElementById('loginView').style.display = '';
        document.getElementById('appShell').style.display = 'none';
    }

    function showApp() {
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('appShell').style.display = '';

        // Populate user info
        if (currentUser) {
            const name = currentUser.name || 'User';
            document.getElementById('userName').textContent = name;
            document.getElementById('userEmail').textContent = currentUser.username || '';
            document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
        }
    }

    return { checkAuth, getUser, showLogin, showApp };
})();
