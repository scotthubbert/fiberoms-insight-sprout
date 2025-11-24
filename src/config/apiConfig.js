/**
 * apiConfig.js - Centralized configuration for API endpoints and external resources
 */

export const API_CONFIG = {
    // Supabase Storage URLs for Infrastructure Data (OSP)
    INFRASTRUCTURE: {
        NODE_SITES: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/node-sites.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL25vZGUtc2l0ZXMuZ2VvanNvbiIsImlhdCI6MTc1MTQ4OTgyNiwiZXhwIjoxNzgzMDI1ODI2fQ.mhkiSZITSzBnJhIQUuQNojPc5_ijDGzV09grQYbhHSo',
        FSA_BOUNDARIES: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/fsa-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2ZzYS1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU0OTUsImV4cCI6MjA2NjkxNTQ5NX0.Gxht_fRDwIB2a7F5kVqZG-xHjzP87uVRN8YwtqQzAoY',
        MAIN_LINE_FIBER: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/access-fiber-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2FjY2Vzcy1maWJlci1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTY4MTYsImV4cCI6MjA2NjkxNjgxNn0.XJ3CCYe-Zzt2RuCxXoZNXkn80N6WQte2akP9pT9UkDo',
        MAIN_LINE_OLD: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/fsa-data//networkOLD.geojson',
        MST_TERMINALS: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/mst-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL21zdC1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU0NzMsImV4cCI6MjA2NjkxNTQ3M30.8skgJzFWzYj6d79b64BIS91PDNGFqpNhu42eABhcy0A',
        SPLITTERS: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/splitter-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL3NwbGl0dGVyLW92ZXJsYXkuZ2VvanNvbiIsImlhdCI6MTc1MTU1NTQ0NSwiZXhwIjoyMDY2OTE1NDQ1fQ.AWS6MtB8vtC5iUESPrO27CmrOaqAjU_A2lQr86l5G_E',
        CLOSURES: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/closure-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL2Nsb3N1cmUtb3ZlcmxheS5nZW9qc29uIiwiaWF0IjoxNzUxNTU1NTM5LCJleHAiOjIwNjY5MTU1Mzl9.pKptT2hsuyD55udHF12xEuQ2C6PPt537tieE3fIpzFE',
        MST_FIBER: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/sign/esri-files/mst-fiber-overlay.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTRhMmVjMi05M2FlLTQ5MGItODRmZi1hMjg5MTgyOWJhMjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3JpLWZpbGVzL21zdC1maWJlci1vdmVybGF5Lmdlb2pzb24iLCJpYXQiOjE3NTE1NTU1MTgsImV4cCI6MjA2NjkxNTUxOH0.4ZOQy_9gcKiy1nbMHnXn90ZLu078ZgG1qiTc11YGG3I'
    },

    // Supabase Storage URLs for Power Outage Data
    OUTAGES: {
        APCO: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/geojson-files/outages.geojson',
        TOMBIGBEE: 'https://edgylwgzemacxrehvxcs.supabase.co/storage/v1/object/public/geojson-files/tec_outages.geojson'
    }
};
