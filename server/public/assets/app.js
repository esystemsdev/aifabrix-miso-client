/**
 * DataClient Demo Application
 * Comprehensive demonstration of all DataClient capabilities
 * Browser-safe implementation (no clientSecret)
 */

let dataClient = null;

/**
 * Initialize DataClient with browser-safe configuration
 * Never includes clientSecret - uses server-provided client token pattern
 */
function initializeDataClient() {
    try {
        const baseUrl = document.getElementById('baseUrl').value || 'http://localhost:3083';
        const controllerUrl = document.getElementById('controllerUrl').value || '';
        const clientId = document.getElementById('clientId').value || '';

        if (!window.DataClient) {
            showStatus('error', 'DataClient not loaded. Please wait for the script to load.');
            return;
        }

        // Browser-safe configuration - NO clientSecret
        const config = {
            baseUrl: baseUrl,
            misoConfig: {
                controllerUrl: controllerUrl,
                clientId: clientId,
                // ❌ NO clientSecret - browser-safe pattern
                // ✅ Use server-provided client token endpoint
                clientTokenUri: '/api/v1/auth/client-token',
            },
            cache: {
                enabled: true,
                defaultTTL: 300, // 5 minutes
                maxSize: 100,
            },
            retry: {
                enabled: true,
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 10000,
            },
            audit: {
                enabled: true,
                level: 'standard',
            },
        };

        dataClient = new window.DataClient(config);
        showStatus('success', 'DataClient initialized successfully!');
        updateConfigStatus('success', 'DataClient is ready');
        updateCodeExamples();
    } catch (error) {
        showStatus('error', `Failed to initialize DataClient: ${error.message}`);
        updateConfigStatus('error', `Error: ${error.message}`);
    }
}

/**
 * Show status banner
 */
function showStatus(type, message) {
    const banner = document.getElementById('statusBanner');
    const text = document.getElementById('statusText');
    banner.className = `status-banner ${type}`;
    text.textContent = message;
    banner.classList.remove('hidden');

    setTimeout(() => {
        banner.classList.add('hidden');
    }, 5000);
}

/**
 * Update config status
 */
function updateConfigStatus(type, message) {
    const status = document.getElementById('configStatus');
    status.className = `status-indicator ${type}`;
    status.textContent = message;
}

/**
 * Display result in result panel
 */
function displayResult(panelId, title, data, isError = false) {
    const panel = document.getElementById(panelId);
    const className = isError ? 'error' : 'success';
    panel.innerHTML = `
        <div class="${className}">${title}</div>
        <pre>${JSON.stringify(data, null, 2)}</pre>
    `;
}

/**
 * Display code example
 */
function displayCodeExample(title, code) {
    const examples = document.getElementById('codeExamples');
    const example = document.createElement('div');
    example.innerHTML = `
        <h3>${title}</h3>
        <pre><code>${code}</code></pre>
    `;
    examples.appendChild(example);
}

/**
 * Update code examples section
 */
function updateCodeExamples() {
    const examples = document.getElementById('codeExamples');
    examples.innerHTML = '<h2>Code Examples</h2>';
    
    displayCodeExample('Initialize DataClient', `const dataClient = new DataClient({
  baseUrl: 'http://localhost:3083',
  misoConfig: {
    controllerUrl: 'https://controller.aifabrix.ai',
    clientId: 'your-client-id',
    // ❌ NO clientSecret in browser code
    clientTokenUri: '/api/v1/auth/client-token',
  },
});`);

    displayCodeExample('GET Request', `const users = await dataClient.get('/api/users');`);

    displayCodeExample('POST Request', `const newUser = await dataClient.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});`);

    displayCodeExample('GET with Cache Options', `const users = await dataClient.get('/api/users', {
  cache: {
    enabled: true,
    ttl: 600, // 10 minutes
  },
});`);
}

// ==================== Authentication Methods ====================

async function testIsAuthenticated() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const isAuth = dataClient.isAuthenticated();
        displayResult('authResult', 'isAuthenticated()', {
            authenticated: isAuth,
            message: isAuth ? 'User is authenticated' : 'User is not authenticated',
        });
    } catch (error) {
        displayResult('authResult', 'isAuthenticated() Error', { error: error.message }, true);
    }
}

async function testGetEnvironmentToken() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const token = await dataClient.getEnvironmentToken();
        displayResult('authResult', 'getEnvironmentToken()', {
            token: token.substring(0, 20) + '...',
            length: token.length,
            message: 'Client token retrieved successfully',
        });
    } catch (error) {
        displayResult('authResult', 'getEnvironmentToken() Error', { error: error.message }, true);
    }
}

async function testGetClientTokenInfo() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const tokenInfo = dataClient.getClientTokenInfo();
        displayResult('authResult', 'getClientTokenInfo()', {
            tokenInfo: tokenInfo,
            message: tokenInfo ? 'Token info extracted successfully' : 'No token info available',
        });
    } catch (error) {
        displayResult('authResult', 'getClientTokenInfo() Error', { error: error.message }, true);
    }
}

async function testRedirectToLogin() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        await dataClient.redirectToLogin();
        displayResult('authResult', 'redirectToLogin()', {
            message: 'Redirecting to login...',
        });
    } catch (error) {
        displayResult('authResult', 'redirectToLogin() Error', { error: error.message }, true);
    }
}

async function testLogout() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        await dataClient.logout();
        displayResult('authResult', 'logout()', {
            message: 'Logged out successfully',
        });
    } catch (error) {
        displayResult('authResult', 'logout() Error', { error: error.message }, true);
    }
}

// ==================== HTTP Methods ====================

async function testGet() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.get('/api/users');
        displayResult('httpResult', 'GET /api/users', result);
    } catch (error) {
        displayResult('httpResult', 'GET /api/users Error', { error: error.message }, true);
    }
}

async function testGetById() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.get('/api/users/1');
        displayResult('httpResult', 'GET /api/users/1', result);
    } catch (error) {
        displayResult('httpResult', 'GET /api/users/1 Error', { error: error.message }, true);
    }
}

async function testPost() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.post('/api/users', {
            name: 'Test User',
            email: 'test@example.com',
        });
        displayResult('httpResult', 'POST /api/users', result);
    } catch (error) {
        displayResult('httpResult', 'POST /api/users Error', { error: error.message }, true);
    }
}

async function testPut() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.put('/api/users/1', {
            name: 'Updated User',
            email: 'updated@example.com',
        });
        displayResult('httpResult', 'PUT /api/users/1', result);
    } catch (error) {
        displayResult('httpResult', 'PUT /api/users/1 Error', { error: error.message }, true);
    }
}

async function testPatch() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.patch('/api/users/1', {
            email: 'patched@example.com',
        });
        displayResult('httpResult', 'PATCH /api/users/1', result);
    } catch (error) {
        displayResult('httpResult', 'PATCH /api/users/1 Error', { error: error.message }, true);
    }
}

async function testDelete() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        await dataClient.delete('/api/users/1');
        displayResult('httpResult', 'DELETE /api/users/1', {
            message: 'User deleted successfully',
        });
    } catch (error) {
        displayResult('httpResult', 'DELETE /api/users/1 Error', { error: error.message }, true);
    }
}

// ==================== Caching ====================

async function testCacheEnabled() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const start1 = Date.now();
        const result1 = await dataClient.get('/api/users', {
            cache: { enabled: true },
        });
        const time1 = Date.now() - start1;

        const start2 = Date.now();
        const result2 = await dataClient.get('/api/users', {
            cache: { enabled: true },
        });
        const time2 = Date.now() - start2;

        displayResult('cacheResult', 'Cache Test (enabled)', {
            firstRequest: { time: `${time1}ms`, cached: false },
            secondRequest: { time: `${time2}ms`, cached: time2 < time1 },
            cacheHit: time2 < time1,
        });
    } catch (error) {
        displayResult('cacheResult', 'Cache Test Error', { error: error.message }, true);
    }
}

async function testCacheDisabled() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.get('/api/users', {
            cache: { enabled: false },
        });
        displayResult('cacheResult', 'Cache Test (disabled)', {
            result: result,
            cacheEnabled: false,
        });
    } catch (error) {
        displayResult('cacheResult', 'Cache Test Error', { error: error.message }, true);
    }
}

async function testClearCache() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        dataClient.clearCache();
        displayResult('cacheResult', 'clearCache()', {
            message: 'Cache cleared successfully',
        });
    } catch (error) {
        displayResult('cacheResult', 'clearCache() Error', { error: error.message }, true);
    }
}

// ==================== Retry Logic ====================

async function testSlowEndpoint() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.get('/api/slow?delay=2000');
        displayResult('retryResult', 'Slow Endpoint Test', result);
    } catch (error) {
        displayResult('retryResult', 'Slow Endpoint Error', { error: error.message }, true);
    }
}

async function testErrorEndpoint() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const result = await dataClient.get('/api/error/500');
        displayResult('retryResult', 'Error Endpoint Test', result);
    } catch (error) {
        displayResult('retryResult', 'Error Endpoint Error', { error: error.message }, true);
    }
}

// ==================== Interceptors ====================

async function testRequestInterceptor() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        dataClient.setInterceptors({
            onRequest: async (url, options) => {
                console.log('Request interceptor:', url, options);
                return {
                    ...options,
                    headers: {
                        ...options.headers,
                        'X-Custom-Header': 'interceptor-test',
                    },
                };
            },
        });

        const result = await dataClient.get('/api/users');
        displayResult('interceptorResult', 'Request Interceptor Test', {
            result: result,
            message: 'Request interceptor applied',
        });
    } catch (error) {
        displayResult('interceptorResult', 'Request Interceptor Error', { error: error.message }, true);
    }
}

async function testResponseInterceptor() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        dataClient.setInterceptors({
            onResponse: async (response, data) => {
                console.log('Response interceptor:', response, data);
                return {
                    ...data,
                    intercepted: true,
                    timestamp: new Date().toISOString(),
                };
            },
        });

        const result = await dataClient.get('/api/users');
        displayResult('interceptorResult', 'Response Interceptor Test', result);
    } catch (error) {
        displayResult('interceptorResult', 'Response Interceptor Error', { error: error.message }, true);
    }
}

async function testErrorInterceptor() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        dataClient.setInterceptors({
            onError: async (error) => {
                console.log('Error interceptor:', error);
                return error;
            },
        });

        try {
            await dataClient.get('/api/error/404');
        } catch (error) {
            displayResult('interceptorResult', 'Error Interceptor Test', {
                error: error.message,
                intercepted: true,
            });
        }
    } catch (error) {
        displayResult('interceptorResult', 'Error Interceptor Error', { error: error.message }, true);
    }
}

// ==================== Metrics ====================

async function testGetMetrics() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        const metrics = dataClient.getMetrics();
        displayResult('metricsResult', 'getMetrics()', metrics);
    } catch (error) {
        displayResult('metricsResult', 'getMetrics() Error', { error: error.message }, true);
    }
}

async function testMultipleRequests() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        // Make multiple requests
        await Promise.all([
            dataClient.get('/api/users'),
            dataClient.get('/api/users/1'),
            dataClient.get('/api/metrics'),
        ]);

        const metrics = dataClient.getMetrics();
        displayResult('metricsResult', 'Multiple Requests Test', {
            metrics: metrics,
            message: 'Made 3 concurrent requests',
        });
    } catch (error) {
        displayResult('metricsResult', 'Multiple Requests Error', { error: error.message }, true);
    }
}

// ==================== Audit Logging ====================

async function testAuditLogging() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        await dataClient.post('/api/users', {
            name: 'Audit Test User',
            email: 'audit@example.com',
        });

        displayResult('auditResult', 'Audit Logging Test', {
            message: 'Request made with audit logging enabled',
            note: 'Check browser console and server logs for audit events',
        });
    } catch (error) {
        displayResult('auditResult', 'Audit Logging Error', { error: error.message }, true);
    }
}

async function testSetAuditConfig() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        dataClient.setAuditConfig({
            level: 'detailed',
            skipEndpoints: ['/health'],
        });

        displayResult('auditResult', 'setAuditConfig()', {
            message: 'Audit config updated',
            config: {
                level: 'detailed',
                skipEndpoints: ['/health'],
            },
        });
    } catch (error) {
        displayResult('auditResult', 'setAuditConfig() Error', { error: error.message }, true);
    }
}

// ==================== Error Handling ====================

async function testNetworkError() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        // Try to access non-existent endpoint
        await dataClient.get('/api/nonexistent');
    } catch (error) {
        displayResult('errorResult', 'Network Error Test', {
            error: error.message,
            type: error.constructor.name,
        }, true);
    }
}

async function testTimeout() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        await dataClient.get('/api/slow?delay=10000', {
            timeout: 2000,
        });
    } catch (error) {
        displayResult('errorResult', 'Timeout Test', {
            error: error.message,
            type: error.constructor.name,
        }, true);
    }
}

async function testApiError() {
    if (!dataClient) {
        showStatus('error', 'Please initialize DataClient first');
        return;
    }

    try {
        await dataClient.get('/api/error/400');
    } catch (error) {
        displayResult('errorResult', 'API Error Test (400)', {
            error: error.message,
            type: error.constructor.name,
        }, true);
    }
}

// Wait for DataClient to load
if (window.DataClientLoaded) {
    console.log('DataClient already loaded');
} else {
    // Check every 100ms for DataClient
    const checkInterval = setInterval(() => {
        if (window.DataClient) {
            clearInterval(checkInterval);
            console.log('DataClient loaded');
        } else if (window.DataClientError) {
            clearInterval(checkInterval);
            showStatus('error', 'Failed to load DataClient: ' + window.DataClientError);
        }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.DataClient) {
            showStatus('error', 'DataClient failed to load. Please check the server.');
        }
    }, 10000);
}

