/**
 * CSV Export Service - FiberOMS Insight PWA
 * Handles exporting subscriber data to CSV format with proper formatting and error handling
 */

import { subscriberDataService } from '../dataService.js';

export class CSVExportService {

    /**
     * Export TA5K node reports with higher-level metrics
     * @returns {Promise<boolean>} - Success status
     */
    static async exportTA5KNodeReports() {
        try {
            // Import NodeSiteMetricsService dynamically
            const { NodeSiteMetricsService } = await import('../services/NodeSiteMetricsService.js');
            const nodeMetricsService = new NodeSiteMetricsService();

            // Get all node sites to extract node names
            const nodeSitesData = await subscriberDataService.getNodeSites();

            if (!nodeSitesData?.features || nodeSitesData.features.length === 0) {
                throw new Error('No node sites found to generate reports');
            }

            // Extract node site names from the features
            const nodeSiteNames = nodeSitesData.features
                .map(feature => feature.properties?.Name || feature.attributes?.Name)
                .filter(name => name && name.trim() !== '');

            if (nodeSiteNames.length === 0) {
                throw new Error('No valid node site names found');
            }

            // Production-safe logging for report generation
            if (import.meta.env.DEV) {
                console.log(`📊 Generating reports for ${nodeSiteNames.length} TA5K node sites`);
            }

            // Get metrics for all node sites
            const allMetrics = await nodeMetricsService.getMultipleNodeSiteMetrics(nodeSiteNames);

            // Format data for CSV export
            const reportData = [];

            // Process each node site
            for (const [nodeSiteName, metrics] of Object.entries(allMetrics)) {
                if (metrics.error) {
                    // Include error entries with basic info
                    reportData.push({
                        'Node Site': nodeSiteName,
                        'Status': 'ERROR',
                        'Error Message': metrics.error,
                        'Total Subscribers': 0,
                        'Online Subscribers': 0,
                        'Offline Subscribers': 0,
                        'Unknown Status': 0,
                        'Online Percentage': 0,
                        'Offline Percentage': 0,
                        'Residential Count': 0,
                        'Business Count': 0,
                        'Health Status': 'No Data',
                        'Recent Activity (24h)': 0,
                        'TA5K Nodes': '',
                        'Multi-Node Site': 'No',
                        'TA5K Breakdown': '',
                        'Last Updated': new Date().toLocaleString()
                    });
                    continue;
                }

                // Process TA5K breakdown for multi-node sites
                let ta5kBreakdownText = '';
                if (metrics.ta5kBreakdown && Object.keys(metrics.ta5kBreakdown).length > 0) {
                    const breakdownParts = [];
                    for (const [ta5k, data] of Object.entries(metrics.ta5kBreakdown)) {
                        breakdownParts.push(`${ta5k}: ${data.total} total (${data.online} online, ${data.offline} offline, ${data.residential} res, ${data.business} bus)`);
                    }
                    ta5kBreakdownText = breakdownParts.join('; ');
                }

                reportData.push({
                    'Node Site': metrics.nodeSiteName || nodeSiteName,
                    'Status': 'OK',
                    'Error Message': '',
                    'Total Subscribers': metrics.totalSubscribers || 0,
                    'Online Subscribers': metrics.onlineSubscribers || 0,
                    'Offline Subscribers': metrics.offlineSubscribers || 0,
                    'Unknown Status': metrics.unknownSubscribers || 0,
                    'Online Percentage': metrics.onlinePercentage || 0,
                    'Offline Percentage': metrics.offlinePercentage || 0,
                    'Residential Count': metrics.residentialCount || 0,
                    'Business Count': metrics.businessCount || 0,
                    'Health Status': metrics.healthStatus || 'Unknown',
                    'Recent Activity (24h)': metrics.recentActivity || 0,
                    'TA5K Nodes': (metrics.ta5kNodes || []).join(', '),
                    'Multi-Node Site': (metrics.ta5kNodes && metrics.ta5kNodes.length > 1) ? 'Yes' : 'No',
                    'TA5K Breakdown': ta5kBreakdownText,
                    'Last Updated': metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString() : new Date().toLocaleString()
                });
            }

            // Sort by total subscribers descending, then by node site name
            reportData.sort((a, b) => {
                if (b['Total Subscribers'] !== a['Total Subscribers']) {
                    return b['Total Subscribers'] - a['Total Subscribers'];
                }
                return a['Node Site'].localeCompare(b['Node Site']);
            });

            const headers = [
                'Node Site',
                'Status',
                'Error Message',
                'Total Subscribers',
                'Online Subscribers',
                'Offline Subscribers',
                'Unknown Status',
                'Online Percentage',
                'Offline Percentage',
                'Residential Count',
                'Business Count',
                'Health Status',
                'Recent Activity (24h)',
                'TA5K Nodes',
                'Multi-Node Site',
                'TA5K Breakdown',
                'Last Updated'
            ];

            await this.exportToCSV(reportData, headers, 'ta5k_node_reports');

            // Production-safe logging for successful export
            if (import.meta.env.DEV) {
                console.log(`✅ TA5K node reports exported successfully: ${reportData.length} nodes`);
            }
            return true;

        } catch (error) {
            console.error('TA5K node reports export failed:', error);
            throw error;
        }
    }

    /**
 * Export offline subscribers to CSV
 * @returns {Promise<boolean>} - Success status
 */
    static async exportOfflineSubscribers() {
        try {
            const offlineResponse = await subscriberDataService.getOfflineSubscribers();
            const offlineData = offlineResponse?.data || offlineResponse;

            if (!offlineData || !Array.isArray(offlineData) || offlineData.length === 0) {
                throw new Error('No offline subscribers found to export');
            }

            const headers = [
                'Subscriber Name',
                'Account Number',
                'Account Type',
                'Service Address',
                'City',
                'County',
                'State',
                'Zip Code',
                'Phone',
                'Email',
                'Status',
                'Last Update',
                'TA5K',
                'Comments'
            ];

            const formattedData = this.formatSubscriberData(offlineData);
            await this.exportToCSV(formattedData, headers, 'offline_subscribers');

            return true;
        } catch (error) {
            console.error('CSV export failed:', error);
            throw error;
        }
    }

    /**
 * Format subscriber data for CSV export
 * @param {Array} subscribers - Raw subscriber data
 * @returns {Array} - Formatted subscriber data
 */
    static formatSubscriberData(subscribers) {
        const sortedSubscribers = subscribers.sort((a, b) => {
            const ta5kA = (a.ta5k || '').toString().toLowerCase();
            const ta5kB = (b.ta5k || '').toString().toLowerCase();

            if (!ta5kA && !ta5kB) return 0;
            if (!ta5kA) return 1;
            if (!ta5kB) return -1;

            return ta5kA.localeCompare(ta5kB);
        });

        return sortedSubscribers.map(subscriber => ({
            'Subscriber Name': subscriber.name || subscriber.subscriber_name || '',
            'Account Number': subscriber.account_number || subscriber.account || '',
            'Account Type': subscriber.service_type || '',
            'Service Address': subscriber.service_address || '',
            'City': subscriber.city || '',
            'County': subscriber.county || '',
            'State': subscriber.state || '',
            'Zip Code': subscriber.zip_code || '',
            'Phone': subscriber.phone || '',
            'Email': subscriber.email || '',
            'Status': subscriber.status || 'Offline',
            'Last Update': subscriber.last_update ?
                new Date(subscriber.last_update).toLocaleString() : '',
            'TA5K': subscriber.ta5k || '',
            'Comments': subscriber.comments || ''
        }));
    }

    /**
 * Generic CSV export method
 * @param {Array} data - Array of data objects
 * @param {Array} headers - Array of header strings
 * @param {string} filename - Base filename (without extension)
 */
    static async exportToCSV(data, headers, filename) {
        try {
            if (!data || data.length === 0) {
                throw new Error('No data found to export');
            }

            const csvData = [headers];

            data.forEach(record => {
                const row = headers.map(header => {
                    const value = record[header] || '';

                    if (typeof value === 'boolean') {
                        return value ? 'Yes' : 'No';
                    }

                    if (value instanceof Date) {
                        return value.toLocaleString();
                    }

                    return String(value);
                });

                csvData.push(row);
            });

            const csvContent = csvData.map(row =>
                row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
            ).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const timestamp = new Date().toISOString().split('T')[0];
            const fullFilename = `${filename}_${timestamp}.csv`;

            const link = document.createElement('a');
            link.href = url;
            link.download = fullFilename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            console.error('CSV generation failed:', error);
            throw error;
        }
    }

    /**
 * Export all subscribers (online and offline) to CSV
 * @returns {Promise<boolean>} - Success status
 */
    static async exportAllSubscribers() {
        try {
            const allData = await subscriberDataService.getAllSubscribers();

            if (!allData || !Array.isArray(allData) || allData.length === 0) {
                throw new Error('No subscriber data found to export');
            }

            const headers = [
                'Subscriber Name',
                'Account Number',
                'Account Type',
                'Service Address',
                'City',
                'County',
                'State',
                'Zip Code',
                'Phone',
                'Email',
                'Status',
                'Last Update',
                'TA5K',
                'Comments'
            ];

            const formattedData = this.formatSubscriberData(allData);
            await this.exportToCSV(formattedData, headers, 'all_subscribers');

            return true;
        } catch (error) {
            console.error('CSV export failed:', error);
            throw error;
        }
    }
} 