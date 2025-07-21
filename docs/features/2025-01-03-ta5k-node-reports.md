# Feature: TA5K Node Reports CSV Export

**Date**: 2025-01-03  
**Author**: Development Team  
**Status**: Active  
**Version**: 1.0

## Overview

### Purpose

Provides comprehensive CSV reports for TA5K nodes with higher-level metrics including subscriber counts broken down by residential/business and online/offline status, similar to the popup metrics shown in the Network panel Node Sites.

### User Impact

Network administrators and service managers can generate executive-level reports showing the health and subscriber distribution across all TA5K nodes for analysis, reporting, and decision-making purposes.

## User Experience

### User Stories

- As a network administrator, I want to export comprehensive TA5K node metrics to CSV so that I can analyze network performance across all nodes
- As a service manager, I want subscriber counts broken down by residential/business for each TA5K node for capacity planning
- As an executive, I want high-level health status reports for all TA5K nodes to understand network performance at a glance
- As a field technician supervisor, I want to identify nodes with high offline percentages that may need attention

### User Interface

- **Location**: Network panel → Reports section
- **Button**: "Export TA5K Node Reports" with file-report icon
- **Feedback**: Loading states, success/error notifications
- **Output**: CSV file with timestamp: `ta5k_node_reports_YYYY-MM-DD.csv`

### User Flows

1. **Access Reports**: User opens Network panel and expands Reports section
2. **Export Trigger**: User clicks "Export TA5K Node Reports" button
3. **Processing**: System fetches all node sites, gathers metrics for each TA5K node
4. **Download**: CSV file automatically downloads with comprehensive metrics

## Report Structure

### CSV Columns

| Column                | Description                             | Example                                    |
| --------------------- | --------------------------------------- | ------------------------------------------ |
| Node Site             | Name of the TA5K node site              | "Hamilton"                                 |
| Status                | Processing status                       | "OK" or "ERROR"                            |
| Error Message         | Error details if status is ERROR        | "" or error text                           |
| Total Subscribers     | Total subscriber count                  | 245                                        |
| Online Subscribers    | Count of online subscribers             | 238                                        |
| Offline Subscribers   | Count of offline subscribers            | 7                                          |
| Unknown Status        | Count of unknown status subscribers     | 0                                          |
| Online Percentage     | Percentage online                       | 97                                         |
| Offline Percentage    | Percentage offline                      | 3                                          |
| Residential Count     | Residential service subscribers         | 220                                        |
| Business Count        | Business service subscribers            | 25                                         |
| Health Status         | Overall health assessment               | "excellent", "fair", "warning", "critical" |
| Recent Activity (24h) | Subscribers updated in last 24 hours    | 15                                         |
| TA5K Nodes            | Comma-separated TA5K identifiers        | "Hamilton_1, Hamilton_2"                   |
| Multi-Node Site       | Whether site has multiple TA5K nodes    | "Yes" or "No"                              |
| TA5K Breakdown        | Detailed breakdown for multi-node sites | "Hamilton_1: 120 total..."                 |
| Last Updated          | Timestamp of report generation          | "1/3/2025, 2:30:15 PM"                     |

### Data Sorting

Reports are sorted by:

1. Total Subscribers (descending) - Largest nodes first
2. Node Site name (alphabetical) - Consistent ordering

## Technical Implementation

### Architecture

```javascript
// Flow: UI Button → CSVExportService → NodeSiteMetricsService → Supabase → CSV Download
Button Click → exportTA5KNodeReports() → getMultipleNodeSiteMetrics() → Database Query → CSV File
```

### Key Components

1. **CSVExportService.exportTA5KNodeReports()**: New method for TA5K node reports
2. **NodeSiteMetricsService**: Existing service providing detailed metrics per node
3. **UI Integration**: New button in Network panel Reports section
4. **Error Handling**: Graceful handling of node processing errors

### Data Sources

- **Node Sites**: External GeoJSON file containing all TA5K node locations
- **Subscriber Metrics**: Real-time data from MFS database via Supabase
- **Health Calculations**: Business logic for determining node health status

### Special Handling

- **Multi-Node Sites**: Sites like Hamilton (Hamilton_1, Hamilton_2) are properly aggregated
- **Special Mappings**: Handles naming inconsistencies (e.g., "Bear Creek Hut" → "Bearcreek")
- **Error Resilience**: Individual node failures don't stop the entire report
- **Real-time Data**: No caching - always uses fresh metrics

## Configuration

### Dependencies

- NodeSiteMetricsService for metrics calculation
- subscriberDataService for node site data
- Existing CSV export infrastructure

### Performance Considerations

- **Parallel Processing**: Multiple node metrics fetched simultaneously
- **Memory Efficient**: Processes nodes incrementally rather than loading all data at once
- **Network Optimized**: Batched database queries where possible

## Testing

### Manual Testing Checklist

1. **Basic Export**:

   - [ ] Button appears in Network panel Reports section
   - [ ] Clicking button triggers loading state
   - [ ] CSV file downloads successfully
   - [ ] Filename includes current date

2. **Report Content**:

   - [ ] All node sites appear in report
   - [ ] Metrics match popup data for sample nodes
   - [ ] Multi-node sites show proper breakdown
   - [ ] Sorting is correct (total subscribers desc, then name)

3. **Error Handling**:

   - [ ] Individual node errors don't break entire export
   - [ ] Error nodes show in report with ERROR status
   - [ ] Success notification appears on completion
   - [ ] Failure notification appears on errors

4. **Edge Cases**:
   - [ ] Handles nodes with zero subscribers
   - [ ] Works with empty node sites data
   - [ ] Handles special character node names
   - [ ] Manages very large subscriber counts

### Sample Report Validation

Verify sample report includes:

- Nodes sorted by subscriber count
- Proper residential/business breakdown
- Accurate online/offline percentages
- Multi-node breakdowns for sites like Hamilton, Winfield
- Health status matches expected business rules

## Benefits

### For Network Operations

- **Capacity Planning**: Identify nodes approaching capacity
- **Performance Monitoring**: Track online/offline ratios across network
- **Resource Allocation**: Prioritize maintenance based on subscriber impact

### For Management

- **Executive Reporting**: High-level network health summaries
- **Trend Analysis**: Export historical data for comparison
- **Decision Support**: Data-driven infrastructure investments

### For Field Operations

- **Prioritization**: Focus on nodes with highest offline counts
- **Resource Planning**: Understand subscriber distribution for truck routing
- **Performance Tracking**: Monitor improvement in problem areas

## Future Enhancements

- **Historical Trending**: Compare reports over time
- **Custom Filtering**: Export subsets of nodes (by region, health status, etc.)
- **Scheduling**: Automated report generation and email delivery
- **Visualization**: Charts and graphs within the application
- **Additional Metrics**: Signal strength, bandwidth utilization, etc.

---

This feature provides comprehensive TA5K node reporting capabilities that complement the existing individual node popup metrics with exportable, analyzable data for network management and strategic planning.
