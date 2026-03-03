const express = require('express');
const msal = require('@azure/msal-node');
const router = express.Router();

let cca = null;

function getMsalClient() {
    if (!cca) {
        cca = new msal.ConfidentialClientApplication({
            auth: {
                clientId: process.env.CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
                clientSecret: process.env.CLIENT_SECRET,
            },
        });
    }
    return cca;
}

const SCOPES = [
    'User.Read',
    'DeviceManagementManagedDevices.Read.All',
    'DeviceManagementConfiguration.Read.All',
    'Device.Read.All',
    'Directory.Read.All',
];

// Build redirect URI dynamically from the incoming request
function getRedirectUri(req) {
    const protocol = req.protocol; // respects trust proxy
    const host = req.get('host');  // includes port
    return `${protocol}://${host}/api/auth/callback`;
}

// Login — redirect to Microsoft
router.get('/login', async (req, res) => {
    try {
        const redirectUri = getRedirectUri(req);
        console.log('Login redirect URI:', redirectUri);

        // Store redirect URI in session so callback uses the same one
        req.session.redirectUri = redirectUri;

        const authUrl = await getMsalClient().getAuthCodeUrl({
            scopes: SCOPES,
            redirectUri: redirectUri,
            prompt: 'select_account',
        });
        res.redirect(authUrl);
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Failed to initiate login', details: err.message });
    }
});

// Callback — exchange code for tokens
router.get('/callback', async (req, res) => {
    try {
        // Use the same redirect URI that was used in the login request
        const redirectUri = req.session.redirectUri || getRedirectUri(req);
        console.log('Callback redirect URI:', redirectUri);

        const tokenResponse = await getMsalClient().acquireTokenByCode({
            code: req.query.code,
            scopes: SCOPES,
            redirectUri: redirectUri,
        });

        req.session.accessToken = tokenResponse.accessToken;
        req.session.account = {
            name: tokenResponse.account?.name || 'User',
            username: tokenResponse.account?.username || '',
            tenantId: tokenResponse.account?.tenantId || '',
        };
        req.session.tokenExpiry = tokenResponse.expiresOn;
        delete req.session.redirectUri; // cleanup

        res.redirect('/');
    } catch (err) {
        console.error('Auth callback error:', err);
        res.status(500).send(`Authentication failed: ${err.message}<br><br><a href="/">Go back</a>`);
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Current user info
router.get('/me', (req, res) => {
    if (!req.session.accessToken) {
        return res.json({ authenticated: false });
    }
    res.json({
        authenticated: true,
        user: req.session.account,
        tokenExpiry: req.session.tokenExpiry,
    });
});

// Middleware to check auth for API routes
function requireAuth(req, res, next) {
    if (!req.session.accessToken) {
        return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }
    next();
}

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.getAccessToken = (req) => req.session.accessToken;
