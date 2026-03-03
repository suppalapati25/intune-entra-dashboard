const express = require('express');
const axios = require('axios');
const { requireAuth, getAccessToken } = require('./auth');
const { analyzeDeviceIssues } = require('../services/issueEngine');
const router = express.Router();

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA = 'https://graph.microsoft.com/beta';

function graphHeaders(token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Get all Intune managed devices (with extra fields)
router.get('/intune', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/deviceManagement/managedDevices?$top=999`,
            { headers: graphHeaders(token) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('Intune devices error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to fetch Intune devices',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

// Get all Entra (Azure AD) devices
router.get('/entra', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/devices?$top=999`,
            { headers: graphHeaders(token) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('Entra devices error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to fetch Entra devices',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

// Get single device detail from Intune
router.get('/intune/:id', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/deviceManagement/managedDevices/${req.params.id}`,
            { headers: graphHeaders(token) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('Device detail error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to fetch device details',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

// Get aggregated summary/stats — ENHANCED with richer analytics
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/deviceManagement/managedDevices?$top=999`,
            { headers: graphHeaders(token) }
        );

        const devices = response.data.value || [];
        const now = new Date();

        // OS breakdown
        const osCounts = {};
        const complianceCounts = { compliant: 0, nonCompliant: 0, unknown: 0, inGracePeriod: 0 };
        const enrollmentCounts = {};
        const manufacturerCounts = {};
        const ownershipCounts = { company: 0, personal: 0, unknown: 0 };
        const managementCounts = {};
        let encryptedCount = 0;
        let supervisedCount = 0;
        let jailbrokenCount = 0;
        let autopilotRegistered = 0;
        let staleCount = 0;
        let totalStorage = 0;
        let totalFreeStorage = 0;
        let noUserCount = 0;

        // OS version tracking for freshness
        const osVersionCounts = {};

        // Enrollment date tracking (devices enrolled over time)
        const enrollmentTimeline = {};

        devices.forEach((d) => {
            // OS
            const os = d.operatingSystem || 'Unknown';
            osCounts[os] = (osCounts[os] || 0) + 1;

            // OS version detail
            const verKey = `${os} ${d.osVersion || 'Unknown'}`;
            osVersionCounts[verKey] = (osVersionCounts[verKey] || 0) + 1;

            // Compliance
            const state = d.complianceState || 'unknown';
            if (state === 'compliant') complianceCounts.compliant++;
            else if (state === 'noncompliant') complianceCounts.nonCompliant++;
            else if (state === 'inGracePeriod') complianceCounts.inGracePeriod++;
            else complianceCounts.unknown++;

            // Enrollment type
            const enrollment = d.deviceEnrollmentType || 'unknown';
            enrollmentCounts[enrollment] = (enrollmentCounts[enrollment] || 0) + 1;

            // Manufacturer
            const manufacturer = (d.manufacturer || 'Unknown').trim();
            manufacturerCounts[manufacturer] = (manufacturerCounts[manufacturer] || 0) + 1;

            // Ownership (company vs personal)
            const ownership = (d.managedDeviceOwnerType || 'unknown').toLowerCase();
            if (ownership === 'company') ownershipCounts.company++;
            else if (ownership === 'personal') ownershipCounts.personal++;
            else ownershipCounts.unknown++;

            // Management agent
            const agent = d.managementAgent || 'unknown';
            managementCounts[agent] = (managementCounts[agent] || 0) + 1;

            // Encryption
            if (d.isEncrypted) encryptedCount++;

            // Supervised (iOS)
            if (d.isSupervised) supervisedCount++;

            // Jailbroken
            if (d.jailBroken === 'True') jailbrokenCount++;

            // Autopilot
            if (d.autopilotEnrolled) autopilotRegistered++;

            // No primary user
            if (!d.userPrincipalName) noUserCount++;

            // Stale (>30 days since last sync)
            if (d.lastSyncDateTime) {
                const lastSync = new Date(d.lastSyncDateTime);
                const daysSince = (now - lastSync) / (1000 * 60 * 60 * 24);
                if (daysSince > 30) staleCount++;
            }

            // Storage
            if (d.totalStorageSpaceInBytes) totalStorage += d.totalStorageSpaceInBytes;
            if (d.freeStorageSpaceInBytes) totalFreeStorage += d.freeStorageSpaceInBytes;

            // Enrollment timeline (by month)
            if (d.enrolledDateTime) {
                const month = d.enrolledDateTime.substring(0, 7); // "2024-01"
                enrollmentTimeline[month] = (enrollmentTimeline[month] || 0) + 1;
            }
        });

        // Sort manufacturer counts and keep top 8
        const sortedManufacturers = Object.entries(manufacturerCounts)
            .sort((a, b) => b[1] - a[1]);
        const topManufacturers = Object.fromEntries(sortedManufacturers.slice(0, 8));
        if (sortedManufacturers.length > 8) {
            topManufacturers['Other'] = sortedManufacturers.slice(8).reduce((sum, [, v]) => sum + v, 0);
        }

        // Sort enrollment timeline
        const sortedTimeline = Object.fromEntries(
            Object.entries(enrollmentTimeline).sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
        );

        // Sort OS versions and keep top 10
        const topOsVersions = Object.fromEntries(
            Object.entries(osVersionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
        );

        res.json({
            totalDevices: devices.length,
            osCounts,
            complianceCounts,
            enrollmentCounts,
            manufacturerCounts: topManufacturers,
            ownershipCounts,
            managementCounts,
            encryptedCount,
            notEncryptedCount: devices.length - encryptedCount,
            supervisedCount,
            jailbrokenCount,
            autopilotRegistered,
            noUserCount,
            staleCount,
            activeCount: devices.length - staleCount,
            totalStorageGB: Math.round(totalStorage / (1024 * 1024 * 1024)),
            freeStorageGB: Math.round(totalFreeStorage / (1024 * 1024 * 1024)),
            enrollmentTimeline: sortedTimeline,
            topOsVersions,
        });
    } catch (err) {
        console.error('Summary error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to generate summary',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

// Get device issues and remediation
router.get('/issues', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/deviceManagement/managedDevices?$top=999`,
            { headers: graphHeaders(token) }
        );
        const devices = response.data.value || [];
        const issues = analyzeDeviceIssues(devices);
        res.json({ issues, totalDevicesAnalyzed: devices.length });
    } catch (err) {
        console.error('Issues error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to analyze device issues',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

// Get issues for a single device
router.get('/issues/:id', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/deviceManagement/managedDevices/${req.params.id}`,
            { headers: graphHeaders(token) }
        );
        const device = response.data;
        const issues = analyzeDeviceIssues([device]);
        res.json({ device: device.deviceName, issues });
    } catch (err) {
        console.error('Device issues error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to analyze device issues',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

module.exports = router;
