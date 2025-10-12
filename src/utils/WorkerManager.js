// WorkerManager.js - Manages web worker for data processing

export class WorkerManager {
    constructor() {
        this.worker = null;
        this.pendingRequests = new Map();
        this.requestId = 0;
    }

    // Initialize the worker
    async initialize() {
        if (this.worker) return;
        
        try {
            // Create worker with proper Vite handling
            this.worker = new Worker(
                new URL('../workers/dataProcessor.worker.js', import.meta.url),
                { type: 'module' }
            );
            
            // Set up message handler
            this.worker.addEventListener('message', this.handleMessage.bind(this));
            
            // Set up error handler
            this.worker.addEventListener('error', (error) => {
                console.error('Worker error:', error);
                this.handleWorkerError(error);
            });
            
            console.log('✅ Data processing worker initialized');
        } catch (error) {
            console.error('Failed to initialize worker:', error);
            // Fallback to main thread processing will be handled by caller
        }
    }

    // Send a message to the worker and return a promise
    async sendMessage(type, data, options = {}) {
        if (!this.worker) {
            throw new Error('Worker not initialized');
        }
        
        const requestId = this.requestId++;
        
        return new Promise((resolve, reject) => {
            // Store the promise handlers
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                onProgress: options.onProgress || null,
                startTime: Date.now()
            });
            
            // Send message to worker
            this.worker.postMessage({
                id: requestId,
                type,
                data
            });
            
            // Set timeout
            if (options.timeout) {
                setTimeout(() => {
                    if (this.pendingRequests.has(requestId)) {
                        this.pendingRequests.delete(requestId);
                        reject(new Error(`Worker timeout after ${options.timeout}ms`));
                    }
                }, options.timeout);
            }
        });
    }

    // Handle messages from the worker
    handleMessage(event) {
        const { id, type, ...data } = event.data;
        const request = this.pendingRequests.get(id);
        
        if (!request) return;
        
        switch (type) {
            case 'complete':
            case 'filterComplete':
            case 'clusterComplete':
                // Request completed successfully
                this.pendingRequests.delete(id);
                request.resolve(data);
                break;
                
            case 'progress':
            case 'clusterProgress':
                // Progress update
                if (request.onProgress) {
                    request.onProgress(data);
                }
                break;
                
            case 'error':
                // Request failed
                this.pendingRequests.delete(id);
                request.reject(new Error(data.error));
                break;
        }
    }

    // Handle worker errors
    handleWorkerError(error) {
        // Reject all pending requests
        for (const [id, request] of this.pendingRequests) {
            request.reject(error);
        }
        this.pendingRequests.clear();
        
        // Reset worker
        this.terminate();
    }

    // Process features using the worker
    async processFeatures(features, startObjectId = 1, options = {}) {
        await this.initialize();
        
        return this.sendMessage('processFeatures', {
            features,
            startObjectId,
            chunkSize: options.chunkSize || 1000
        }, {
            onProgress: options.onProgress,
            timeout: options.timeout || 60000 // 60 second timeout
        });
    }

    // Filter features by extent using the worker
    async filterByExtent(features, extent, buffer = 1.2) {
        await this.initialize();
        
        return this.sendMessage('filterByExtent', {
            features,
            extent: {
                xmin: extent.xmin,
                xmax: extent.xmax,
                ymin: extent.ymin,
                ymax: extent.ymax,
                width: extent.width,
                height: extent.height
            },
            buffer
        }, {
            timeout: 30000 // 30 second timeout
        });
    }

    // Calculate clusters using the worker
    async calculateClusters(features, clusterRadius = 45, extent = null) {
        await this.initialize();
        
        return this.sendMessage('calculateClusters', {
            features,
            clusterRadius,
            extent: extent ? {
                xmin: extent.xmin,
                xmax: extent.xmax,
                ymin: extent.ymin,
                ymax: extent.ymax
            } : null
        }, {
            timeout: 45000 // 45 second timeout
        });
    }

    // Terminate the worker
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.pendingRequests.clear();
            console.log('🛑 Data processing worker terminated');
        }
    }
}

// Create singleton instance
export const workerManager = new WorkerManager();