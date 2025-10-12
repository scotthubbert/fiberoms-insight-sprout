// dataProcessor.worker.js - Web Worker for heavy data processing

// Process large arrays of features in chunks without blocking
self.addEventListener('message', async (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'processFeatures':
            await processFeatures(data);
            break;
            
        case 'filterByExtent':
            await filterFeaturesByExtent(data);
            break;
            
        case 'calculateClusters':
            await calculateClusters(data);
            break;
            
        default:
            self.postMessage({ 
                type: 'error', 
                error: `Unknown message type: ${type}` 
            });
    }
});

// Process features into graphics-ready format
async function processFeatures({ features, startObjectId, chunkSize = 1000 }) {
    const graphics = [];
    let objectId = startObjectId || 1;
    let processedCount = 0;
    
    // Send initial status
    self.postMessage({
        type: 'progress',
        progress: 0,
        total: features.length
    });
    
    for (let i = 0; i < features.length; i += chunkSize) {
        const chunk = features.slice(i, i + chunkSize);
        const chunkGraphics = [];
        
        for (const feature of chunk) {
            if (!feature.geometry || feature.geometry.type !== 'Point') continue;
            
            const [lng, lat] = feature.geometry.coordinates;
            const attributes = { ...feature.properties };
            const stableId = attributes.id || attributes.account || attributes.remote_id || objectId;
            
            chunkGraphics.push({
                geometry: {
                    type: 'point',
                    longitude: lng,
                    latitude: lat,
                    spatialReference: { wkid: 4326 }
                },
                attributes: {
                    OBJECTID: objectId++,
                    _stable_id: stableId,
                    ...attributes
                }
            });
        }
        
        graphics.push(...chunkGraphics);
        processedCount += chunk.length;
        
        // Send progress update
        self.postMessage({
            type: 'progress',
            progress: processedCount,
            total: features.length,
            chunk: chunkGraphics
        });
        
        // Small delay to prevent overwhelming the main thread
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // Send completion
    self.postMessage({
        type: 'complete',
        graphics: graphics,
        totalProcessed: graphics.length
    });
}

// Filter features by map extent
async function filterFeaturesByExtent({ features, extent, buffer = 1.2 }) {
    const visible = [];
    const deferred = [];
    
    // Expand extent by buffer factor
    const xmin = extent.xmin - (extent.width * (buffer - 1) / 2);
    const xmax = extent.xmax + (extent.width * (buffer - 1) / 2);
    const ymin = extent.ymin - (extent.height * (buffer - 1) / 2);
    const ymax = extent.ymax + (extent.height * (buffer - 1) / 2);
    
    for (const feature of features) {
        if (!feature.geometry || feature.geometry.type !== 'Point') continue;
        
        const [lng, lat] = feature.geometry.coordinates;
        
        if (lng >= xmin && lng <= xmax && lat >= ymin && lat <= ymax) {
            visible.push(feature);
        } else {
            deferred.push(feature);
        }
    }
    
    self.postMessage({
        type: 'filterComplete',
        visible: visible,
        deferred: deferred,
        stats: {
            totalFeatures: features.length,
            visibleCount: visible.length,
            deferredCount: deferred.length
        }
    });
}

// Pre-calculate cluster information for better performance
async function calculateClusters({ features, clusterRadius = 45, extent = null }) {
    // This is a simplified clustering algorithm
    // In production, you might want to use a more sophisticated approach
    
    const clusters = [];
    const processed = new Set();
    
    for (let i = 0; i < features.length; i++) {
        if (processed.has(i)) continue;
        
        const feature = features[i];
        if (!feature.geometry || feature.geometry.type !== 'Point') continue;
        
        const [centerLng, centerLat] = feature.geometry.coordinates;
        
        // Skip if outside extent
        if (extent && (
            centerLng < extent.xmin || centerLng > extent.xmax ||
            centerLat < extent.ymin || centerLat > extent.ymax
        )) {
            continue;
        }
        
        const cluster = {
            center: [centerLng, centerLat],
            features: [feature],
            count: 1
        };
        
        processed.add(i);
        
        // Find nearby features to cluster
        for (let j = i + 1; j < features.length; j++) {
            if (processed.has(j)) continue;
            
            const otherFeature = features[j];
            if (!otherFeature.geometry || otherFeature.geometry.type !== 'Point') continue;
            
            const [otherLng, otherLat] = otherFeature.geometry.coordinates;
            
            // Simple distance calculation (not accurate for large distances)
            const dx = (otherLng - centerLng) * Math.cos(centerLat * Math.PI / 180);
            const dy = otherLat - centerLat;
            const distance = Math.sqrt(dx * dx + dy * dy) * 111320; // Convert to meters
            
            if (distance <= clusterRadius) {
                cluster.features.push(otherFeature);
                cluster.count++;
                processed.add(j);
            }
        }
        
        clusters.push(cluster);
        
        // Send progress periodically
        if (i % 1000 === 0) {
            self.postMessage({
                type: 'clusterProgress',
                progress: i,
                total: features.length
            });
        }
    }
    
    self.postMessage({
        type: 'clusterComplete',
        clusters: clusters,
        stats: {
            totalClusters: clusters.length,
            totalFeatures: features.length,
            averageClusterSize: features.length / clusters.length
        }
    });
}

// Utility function to check if a point is within an extent
function containsPoint(extent, lng, lat) {
    return lng >= extent.xmin && lng <= extent.xmax &&
           lat >= extent.ymin && lat <= extent.ymax;
}