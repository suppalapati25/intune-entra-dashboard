const express = require('express');
const axios = require('axios');
const { requireAuth, getAccessToken } = require('./auth');
const router = express.Router();

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function graphHeaders(token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Get all compliance policies
router.get('/policies', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/deviceManagement/deviceCompliancePolicies`,
            { headers: graphHeaders(token) }
        );

        const policies = response.data.value || [];

        // For each policy, try to get device status overview
        const enriched = await Promise.all(
            policies.map(async (policy) => {
                try {
                    const statusResp = await axios.get(
                        `${GRAPH_BASE}/deviceManagement/deviceCompliancePolicies/${policy.id}/deviceStatusOverview`,
                        { headers: graphHeaders(token) }
                    );
                    return { ...policy, statusOverview: statusResp.data };
                } catch {
                    return { ...policy, statusOverview: null };
                }
            })
        );

        res.json({ value: enriched });
    } catch (err) {
        console.error('Compliance policies error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to fetch compliance policies',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

// Get compliance policy device statuses
router.get('/policies/:id/statuses', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);
        const response = await axios.get(
            `${GRAPH_BASE}/deviceManagement/deviceCompliancePolicies/${req.params.id}/deviceStatuses`,
            { headers: graphHeaders(token) }
        );
        res.json(response.data);
    } catch (err) {
        console.error('Policy statuses error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to fetch policy statuses',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

// Get overall compliance summary
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const token = getAccessToken(req);

        // Get all policies and their overviews
        const policiesResp = await axios.get(
            `${GRAPH_BASE}/deviceManagement/deviceCompliancePolicies`,
            { headers: graphHeaders(token) }
        );
        const policies = policiesResp.data.value || [];

        const summaries = await Promise.all(
            policies.map(async (policy) => {
                try {
                    const overviewResp = await axios.get(
                        `${GRAPH_BASE}/deviceManagement/deviceCompliancePolicies/${policy.id}/deviceStatusOverview`,
                        { headers: graphHeaders(token) }
                    );
                    const o = overviewResp.data;
                    return {
                        policyId: policy.id,
                        policyName: policy.displayName,
                        platform: policy['@odata.type']?.replace('#microsoft.graph.', '') || 'unknown',
                        compliant: o.compliantDeviceCount || 0,
                        nonCompliant: o.nonCompliantDeviceCount || 0,
                        error: o.errorDeviceCount || 0,
                        conflict: o.conflictDeviceCount || 0,
                        notApplicable: o.notApplicableDeviceCount || 0,
                        inGracePeriod: o.inGracePeriodCount || 0,
                    };
                } catch {
                    return {
                        policyId: policy.id,
                        policyName: policy.displayName,
                        platform: 'unknown',
                        compliant: 0,
                        nonCompliant: 0,
                        error: 0,
                        conflict: 0,
                        notApplicable: 0,
                        inGracePeriod: 0,
                    };
                }
            })
        );

        res.json({
            totalPolicies: policies.length,
            policies: summaries,
        });
    } catch (err) {
        console.error('Compliance summary error:', err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            error: 'Failed to generate compliance summary',
            details: err.response?.data?.error?.message || err.message,
        });
    }
});

module.exports = router;
