/**
 * CSV Export Service - FiberOMS Insight PWA
 * Handles exporting subscriber data to CSV format with proper formatting and error handling
 */

import { subscriberDataService } from '../dataService.js';

export class CSVExportService {

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