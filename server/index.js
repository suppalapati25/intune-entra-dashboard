require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const complianceRoutes = require('./routes/compliance');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.set('trust proxy', 1); // Trust Cloudflare Tunnel / reverse proxy
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: 'auto', // auto-detect: true behind HTTPS proxy, false on localhost
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 2, // 2 hours
            sameSite: 'lax',
        },
    })
);

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/compliance', complianceRoutes);

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n  ✦ Intune & Entra Device Dashboard`);
    console.log(`  ➜ http://localhost:${PORT}\n`);

    if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'your-client-id-here') {
        console.log('  ⚠  Azure AD not configured. Copy .env.example to .env and fill in your credentials.\n');
    }
});
