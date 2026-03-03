# 🖥️ Intune & Entra Device Dashboard

A comprehensive web dashboard for monitoring and managing devices via **Microsoft Intune** and **Entra Admin Center** (Azure AD). Built with Node.js, Express, and vanilla JavaScript.

![Dashboard](https://img.shields.io/badge/Dashboard-Intune%20%26%20Entra-blue) ![Node.js](https://img.shields.io/badge/Node.js-18%2B-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 📊 Dashboard
- **8 KPI cards** — Total devices, compliance, encryption, ownership, storage, stale devices, jailbroken/supervised counts
- **6 interactive charts** — OS distribution, compliance status, top manufacturers, ownership breakdown, encryption, enrollment timeline
- **Recent critical issues** feed with severity badges

### 💻 Device Inventory
- **11-column sortable table** — Device name, user, OS, version, compliance, encryption, ownership, manufacturer, model, serial number, last sync
- **Search** across device name, user, model, serial number, manufacturer
- **Filters** by OS and compliance status
- **CSV export** with 20+ fields including IMEI, MAC address, storage, enrollment type

### 🔍 Device Detail Panel
- **Slide-out panel** with comprehensive device info (hardware, network, OS, user, enrollment, storage, security)
- **Health status badges** — compliance, encryption, supervised, jailbroken, autopilot, Azure AD
- **Compliance grace period countdown**
- **Inline remediation steps** for detected issues
- **Raw JSON data viewer** for full Microsoft Graph response

### ⚠️ Issues & Remediation
- **8 automated issue detection rules** — Non-compliant, outdated OS, stale, not encrypted, jailbroken, low storage, not supervised, no primary user
- **Severity levels** — Critical, High, Medium, Low
- **Step-by-step remediation** with Microsoft Learn links

### 🛡️ Compliance
- **Policy breakdown** with device status per policy
- **Progress bars** showing compliant/non-compliant/error counts

### 🔑 Entra Devices
- **Azure AD registered devices** view with search

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **Azure AD App Registration** with the following delegated permissions:
  - `User.Read`
  - `DeviceManagementManagedDevices.Read.All`
  - `DeviceManagementConfiguration.Read.All`
  - `Device.Read.All`
  - `Directory.Read.All`

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/intune-entra-dashboard.git
cd intune-entra-dashboard

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Azure AD credentials

# 4. Start the server
npm start
```

Open http://localhost:3001 and sign in with your Microsoft account.

### Environment Variables

| Variable | Description |
|---|---|
| `TENANT_ID` | Azure AD tenant ID |
| `CLIENT_ID` | App registration client ID |
| `CLIENT_SECRET` | App registration client secret |
| `PORT` | Server port (default: 3001) |
| `REDIRECT_URI` | OAuth callback URL |
| `SESSION_SECRET` | Express session secret |

## 🏗️ Architecture

```
intune-entra-dashboard/
├── server/
│   ├── index.js              # Express server entry point
│   ├── routes/
│   │   ├── auth.js           # MSAL OAuth 2.0 authentication
│   │   ├── devices.js        # Intune & Entra device API routes
│   │   └── compliance.js     # Compliance policy routes
│   └── services/
│       └── issueEngine.js    # Device issue detection engine
├── public/
│   ├── index.html            # Single-page app shell
│   ├── css/styles.css        # Dark theme design system
│   └── js/
│       ├── app.js            # Router & navigation
│       ├── auth.js           # Auth state management
│       ├── dashboard.js      # KPI cards & Chart.js charts
│       ├── devices.js        # Device inventory table
│       ├── deviceDetail.js   # Slide-out detail panel
│       ├── issues.js         # Issues & remediation view
│       └── compliance.js     # Compliance policies view
├── setup-permissions.ps1     # Azure AD permission setup script
├── deploy-compliance-policies.ps1  # Intune compliance policy deployment
├── deploy-conditional-access.ps1   # Conditional Access policy deployment
├── policy-manager.ps1        # Policy audit, rollback & management tool
├── .env.example
└── package.json
```

## 🛠️ PowerShell Scripts

| Script | Purpose |
|---|---|
| `setup-permissions.ps1` | Add required API permissions to your Azure AD app registration |
| `deploy-compliance-policies.ps1` | Deploy enterprise compliance policies for Windows, iOS, and Android |
| `deploy-conditional-access.ps1` | Deploy 5 Conditional Access policies (MFA, compliant device, block legacy auth, etc.) |
| `policy-manager.ps1` | Interactive tool to audit, simulate impact, disable, or rollback all deployed policies |

## 🌐 Deployment

### Cloudflare Tunnel (Quick)

```bash
# Install cloudflared
winget install cloudflare.cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:3001
```

Update your Azure AD app registration redirect URI with the generated tunnel URL.

## 📄 License

MIT
