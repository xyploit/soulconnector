(function() {
    'use strict';

    // Configuration
    const BACKEND_URL = 'https://api.soulpredictor.xyz';
    const CHECK_INTERVAL = 2000; // Check for game updates every 2 seconds

    let apiToken = GM_getValue('soul_api_token', '');
    let isConnected = false;
    let currentGameType = null; // 'mines' or 'crash'
    let checkInterval = null;
    let fakeBetMode = GM_getValue('soul_fake_bet_mode', false); // Toggle for fake bet mode

    // Helper to clean tokens (remove quotes/Bearer prefix)
    function cleanToken(t) {
        if (!t || typeof t !== 'string') return '';
        return t.trim()
            .replace(/^["']+|["']+$/g, '')
            .replace(/^Bearer\s+/i, '')
            .trim();
    }

    // Capture x-access-token / authorization from fetch and XHR like autoapitoken.js
    let capturedToken = null;

    function handleCapturedToken(raw) {
        const cleaned = cleanToken(raw);
        if (!cleaned || cleaned === capturedToken) return;
        capturedToken = cleaned;

        if (!apiToken || apiToken.length < 10) {
            apiToken = cleaned;
            GM_setValue('soul_api_token', apiToken);

            const input = document.getElementById('soul-api-token');
            if (input) {
                input.value = apiToken;
            }

            try {
                if (typeof showNotification === 'function') {
                    showNotification('Stake API token captured automatically');
                }
            } catch (e) {}
        }
    }

    try {
        const originalFetch = window.fetch;
        window.fetch = function() {
            try {
                const options = arguments[1];
                if (options && options.headers) {
                    let tk = null;
                    const h = options.headers;
                    if (h instanceof Headers) {
                        tk = h.get('x-access-token') || h.get('authorization');
                    } else if (typeof h === 'object') {
                        tk = h['x-access-token'] || h['X-Access-Token'] ||
                             h['authorization'] || h['Authorization'];
                    }
                    if (tk && tk.length > 10) {
                        handleCapturedToken(tk);
                    }
                }
            } catch (e) {}
            return originalFetch.apply(this, arguments);
        };
    } catch (e) {}

    try {
        const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            try {
                if (name && typeof name === 'string') {
                    const lower = name.toLowerCase();
                    if ((lower === 'x-access-token' || lower === 'authorization') && value) {
                        handleCapturedToken(value);
                    }
                }
            } catch (e) {}
            return originalSetHeader.apply(this, arguments);
        };
    } catch (e) {}

    // Inject CSS for the extension UI
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        #soul-extension-ui {
            position: fixed;
            top: 24px;
            right: 24px;
            width: 340px;
            background: #0f111a;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 24px;
            z-index: 999999;
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #e2e8f0;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        #soul-extension-ui.minimized {
            width: 56px;
            height: 56px;
            padding: 0;
            border-radius: 28px;
            overflow: hidden;
            cursor: pointer;
            background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
            border: none;
            box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
        }

        #soul-extension-ui .minimize-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            width: 28px;
            height: 28px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            line-height: 1;
        }

        #soul-extension-ui.minimized .minimize-btn {
            top: 0;
            right: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            border: none;
            font-size: 24px;
            border-radius: 50%;
        }

        #soul-extension-ui.minimized .minimize-btn::before {
            content: '⚡';
            display: block;
        }
        #soul-extension-ui.minimized .minimize-btn span {
            display: none;
        }

        #soul-extension-ui .minimize-btn:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        #soul-extension-ui.minimized .minimize-btn:hover {
            background: transparent;
            transform: scale(1.1);
        }

        #soul-extension-ui .ui-content {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        #soul-extension-ui.minimized .ui-content {
            display: none;
        }

        #soul-extension-ui .logo {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        #soul-extension-ui .logo h2 {
            margin: 0;
            font-size: 18px;
            color: #ffffff;
            font-weight: 600;
            background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        #soul-extension-ui .status {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }

        #soul-extension-ui .status-text-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 500;
        }

        #soul-extension-ui .status-light {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
            position: relative;
        }

        #soul-extension-ui .status-light::after {
            content: '';
            position: absolute;
            top: -2px; left: -2px; right: -2px; bottom: -2px;
            border-radius: 50%;
            border: 2px solid #ef4444;
            opacity: 0.5;
            animation: pulse-ring 2s infinite;
        }

        #soul-extension-ui .status-light.connected {
            background: #10b981;
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
        }
        #soul-extension-ui .status-light.connected::after {
            border-color: #10b981;
        }

        #soul-extension-ui .status-light.connecting {
            background: #f59e0b;
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
        }
        #soul-extension-ui .status-light.connecting::after {
            border-color: #f59e0b;
        }

        #soul-extension-ui .input-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        #soul-extension-ui .input-group label {
            font-size: 12px;
            color: #94a3b8;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        #soul-extension-ui .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #soul-extension-ui .input-group input {
            width: 100%;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            color: #f8fafc;
            font-size: 13px;
            font-family: 'Poppins', sans-serif;
            transition: all 0.2s ease;
        }

        #soul-extension-ui .input-group input:focus {
            outline: none;
            border-color: #8b5cf6;
            background: rgba(139, 92, 246, 0.05);
            box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }

        #soul-extension-ui .copy-icon-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            padding: 10px 14px;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-family: 'Poppins', sans-serif;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
        }

        #soul-extension-ui .copy-icon-btn:hover {
            background: rgba(139, 92, 246, 0.2);
            color: #c4b5fd;
            border-color: rgba(139, 92, 246, 0.4);
        }

        #soul-extension-ui .btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);
            border: none;
            border-radius: 10px;
            color: #ffffff;
            font-weight: 600;
            font-size: 14px;
            font-family: 'Poppins', sans-serif;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        #soul-extension-ui .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
            background: linear-gradient(135deg, #9C72F7 0%, #7C3AED 100%);
        }

        #soul-extension-ui .btn:active {
            transform: translateY(0);
        }

        #soul-extension-ui .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        #soul-extension-ui .btn.disconnect {
            background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
        }
        #soul-extension-ui .btn.disconnect:hover {
            background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
            box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
        }

        #soul-extension-ui .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 4px;
        }

        #soul-extension-ui .info-card {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            text-align: center;
        }

        #soul-extension-ui .info-card-label {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        #soul-extension-ui .info-card-value {
            font-size: 13px;
            color: #f8fafc;
            font-weight: 600;
        }
        #soul-extension-ui .info-card-value.active-text {
            color: #10b981;
        }

        #soul-extension-ui .toggle-switch {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        #soul-extension-ui .toggle-switch:hover {
            background: rgba(255, 255, 255, 0.03);
            border-color: rgba(255, 255, 255, 0.1);
        }

        #soul-extension-ui .toggle-switch label {
            font-size: 13px;
            font-weight: 500;
            color: #e2e8f0;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #soul-extension-ui .switch {
            position: relative;
            width: 40px;
            height: 22px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #soul-extension-ui .switch.active {
            background: #8b5cf6;
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
        }

        #soul-extension-ui .switch .slider {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 16px;
            height: 16px;
            background: #ffffff;
            border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        #soul-extension-ui .switch.active .slider {
            left: 21px;
        }

        @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 0.5; }
            80% { transform: scale(2); opacity: 0; }
            100% { transform: scale(2); opacity: 0; }
        }

        .soul-notification {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #0f111a;
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-left: 4px solid #8b5cf6;
            border-radius: 12px;
            padding: 16px 20px;
            color: #f8fafc;
            font-family: 'Poppins', sans-serif;
            font-size: 14px;
            font-weight: 500;
            z-index: 9999999;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            animation: slideUpFade 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes slideUpFade {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `);

    // Create the extension UI
    function createUI() {
        const ui = document.createElement('div');
        ui.id = 'soul-extension-ui';
        ui.innerHTML = `
            <button class="minimize-btn" onclick="this.parentElement.classList.toggle('minimized')"><span>−</span></button>
            <div class="ui-content">
                <div class="logo">
                    <h2>⚡ Soul Predictor</h2>
                </div>

                <div class="status">
                    <span id="soul-status-text">Disconnected</span>
                    <div class="status-light" id="soul-status-light"></div>
                </div>

                <div class="input-group">
                    <label>Stake API Token</label>
                    <div class="input-wrapper">
                        <input type="password" id="soul-api-token" placeholder="Enter your Stake API token" value="${apiToken}">
                        <button class="copy-icon-btn" id="soul-copy-token-btn" title="Copy Token">Copy</button>
                    </div>
                </div>

                <button class="btn" id="soul-connect-btn">Connect</button>

                <div class="info-grid" id="soul-game-info">
                    <div class="info-card">
                        <span class="info-card-label">Game</span>
                        <span class="info-card-value" id="soul-game-type">None</span>
                    </div>
                    <div class="info-card">
                        <span class="info-card-label">Prediction</span>
                        <span class="info-card-value" id="soul-auto-status">Inactive</span>
                    </div>
                </div>

                <div class="toggle-switch" id="soul-fake-bet-toggle">
                    <label>Beta Mode</label>
                    <div class="switch ${fakeBetMode ? 'active' : ''}" id="soul-fake-bet-switch">
                        <div class="slider"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(ui);

        // Add event listeners
        document.getElementById('soul-connect-btn').addEventListener('click', handleConnect);
        document.getElementById('soul-api-token').addEventListener('input', function() {
            apiToken = this.value;
            GM_setValue('soul_api_token', apiToken);
        });

        const copyBtn = document.getElementById('soul-copy-token-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                const input = document.getElementById('soul-api-token');
                const value = input && input.value ? input.value.trim() : '';
                if (!value) {
                    showNotification('No token to copy yet');
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(value).then(function() {
                        showNotification('Token copied to clipboard');
                    }).catch(function() {
                        showNotification('Unable to copy token');
                    });
                } else {
                    try {
                        input.select();
                        document.execCommand('copy');
                        showNotification('Token copied to clipboard');
                    } catch (e) {
                        showNotification('Unable to copy token');
                    }
                }
            });
        }

        // Fake bet mode toggle
        const fakeBetToggle = document.getElementById('soul-fake-bet-toggle');
        const fakeBetSwitch = document.getElementById('soul-fake-bet-switch');
        fakeBetToggle.addEventListener('click', function() {
            fakeBetMode = !fakeBetMode;
            GM_setValue('soul_fake_bet_mode', fakeBetMode);
            fakeBetSwitch.classList.toggle('active', fakeBetMode);
            showNotification(fakeBetMode ? '🎮 Fake Bet Mode Enabled' : '🎲 Real Bet Mode Enabled');
        });
    }

    // Show notification
    function showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'soul-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideUpFade 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards';
            setTimeout(() => notification.remove(), 400);
        }, duration);
    }

    // Update UI status
    function updateStatus(text, status) {
        const statusText = document.getElementById('soul-status-text');
        const statusLight = document.getElementById('soul-status-light');

        if (statusText) statusText.textContent = text;
        if (statusLight) {
            statusLight.className = 'status-light';
            if (status === 'connected') {
                statusLight.classList.add('connected');
            } else if (status === 'connecting') {
                statusLight.classList.add('connecting');
            }
        }
    }

    // Handle connect/disconnect
    async function handleConnect() {
        const btn = document.getElementById('soul-connect-btn');
        const token = document.getElementById('soul-api-token').value.trim();

        if (!token) {
            showNotification('❌ Please enter your Stake API token first!');
            return;
        }

        if (isConnected) {
            // Disconnect
            isConnected = false;
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
            updateStatus('Disconnected', 'disconnected');
            btn.textContent = 'Connect';
            btn.classList.remove('disconnect');
            document.getElementById('soul-auto-status').textContent = 'Inactive';

            // Notify backend (don't wait for response)
            sendToBackend('/extension_disconnect', { token: apiToken }, 1).catch(() => {
                // Ignore disconnect errors
            });
            showNotification('✅ Disconnected from Soul Predictor');
        } else {
            // Connect
            updateStatus('Connecting...', 'connecting');
            btn.disabled = true;

            try {
                // Register with backend
                const response = await sendToBackend('/extension_connect', {
                    token: apiToken,
                    url: window.location.href
                });

                if (response.status === 'success') {
                    isConnected = true;
                    updateStatus('Connected', 'connected');
                    btn.textContent = 'Disconnect';
                    btn.classList.add('disconnect');
                    btn.disabled = false;
                    document.getElementById('soul-auto-status').textContent = 'Active';

                    showNotification('✅ Connected to Soul Predictor!');

                    // Start monitoring games
                    startGameMonitoring();

                    // Keep connection alive with periodic heartbeats
                    setInterval(async () => {
                        if (isConnected) {
                            try {
                                await sendToBackend('/extension_connect', {
                                    token: apiToken,
                                    url: window.location.href
                                }, 1); // Single retry for heartbeat
                            } catch (e) {
                                // Silent fail for heartbeat - don't disconnect
                            }
                        }
                    }, 30000); // Every 30 seconds
                } else {
                    throw new Error(response.message || 'Connection failed');
                }
            } catch (error) {
                console.error('Connection error:', error);
                updateStatus('Connection Failed', 'disconnected');
                btn.disabled = false;
                showNotification('❌ Connection failed: ' + error.message);
            }
        }
    }

    // Send data to backend with retry logic
    function sendToBackend(endpoint, data, retries = 3) {
        return new Promise((resolve, reject) => {
            const attemptRequest = (attempt) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: BACKEND_URL + endpoint,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(data),
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);
                            if (response.status >= 200 && response.status < 300) {
                        resolve(result);
                            } else if (attempt < retries && response.status >= 500) {
                                // Retry on server errors
                                console.log(`Retrying request (attempt ${attempt + 1}/${retries})...`);
                                setTimeout(() => attemptRequest(attempt + 1), 1000 * attempt);
                            } else {
                                resolve(result); // Still resolve to prevent disconnection
                            }
                    } catch (e) {
                            if (attempt < retries) {
                                console.log(`Retrying request due to parse error (attempt ${attempt + 1}/${retries})...`);
                                setTimeout(() => attemptRequest(attempt + 1), 1000 * attempt);
                            } else {
                                resolve({ status: 'error', message: 'Invalid response' }); // Don't reject, just return error
                            }
                    }
                },
                onerror: function(error) {
                        if (attempt < retries) {
                            console.log(`Retrying request due to network error (attempt ${attempt + 1}/${retries})...`);
                            setTimeout(() => attemptRequest(attempt + 1), 1000 * attempt);
                        } else {
                            resolve({ status: 'error', message: 'Network error' }); // Don't reject
                        }
                },
                ontimeout: function() {
                        if (attempt < retries) {
                            console.log(`Retrying request due to timeout (attempt ${attempt + 1}/${retries})...`);
                            setTimeout(() => attemptRequest(attempt + 1), 1000 * attempt);
                        } else {
                            resolve({ status: 'error', message: 'Timeout' }); // Don't reject
                        }
                },
                    timeout: 15000
            });
            };
            attemptRequest(1);
        });
    }

    // Detect current game type
    function detectGameType() {
        const url = window.location.href;
        if (url.includes('/games/mines')) {
            return 'mines';
        } else if (url.includes('/games/crash')) {
            return 'crash';
        }
        return null;
    }

    // Track last bet state
    let lastBetState = {
        is_active: false,
        bet_id: null,
        mines: null,
        bet_amount: null,
        is_fake_bet: false
    };

    // Track fake bet start time for stable bet ID generation
    let fakeBetStartTime = null;

    // Cache for username to avoid fetching too frequently
    let usernameCache = {
        data: null,
        timestamp: 0,
        cacheDuration: 60000  // 1 minute cache
    };

    // Fetch username from Stake API
    async function fetchUsername() {
        try {
            // Use cached data if recent
            const now = Date.now();
            if (usernameCache.data && (now - usernameCache.timestamp) < usernameCache.cacheDuration) {
                return usernameCache.data;
            }

            // Fetch user data from Stake API using proper GraphQL query
            const response = await fetch('https://stake.ac/_api/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': apiToken,
                    'x-language': 'en'
                },
                body: JSON.stringify({
                    query: `query GetUser {
                        user {
                            name
                        }
                    }`,
                    operationName: 'GetUser'
                })
            });

            if (response.ok) {
                const jsonData = await response.json();
                if (jsonData.data && jsonData.data.user) {
                    const username = jsonData.data.user.name || '';
                    usernameCache.data = username;
                    usernameCache.timestamp = now;
                    return username;
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching username:', error);
            return usernameCache.data;  // Return cached data if available
        }
    }

    // Fetch active mines bet data from Stake API
    async function fetchMinesBetData() {
        try {
            const response = await fetch('https://stake.ac/_api/casino/active-bet/mines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': apiToken,
                    'x-language': 'en'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                return data;
            }
            return null;
        } catch (error) {
            console.error('Error fetching mines bet data:', error);
            return null;
        }
    }

    // Check if testmines.js (fake bet script) is active
    function isFakeBetActive() {
        // Check for fake bet indicators
        const fakeInput = document.querySelector('#fake-bet-input');
        const betActiveClass = document.body.classList.contains('bet-active');
        const wrapperBetActive = document.querySelector('.input-button-wrap.svelte-dka04o')?.classList.contains('bet-active');

        // Check if testmines.js functions exist (indirect detection)
        const hasFakeInput = fakeInput !== null;
        const hasBetActive = betActiveClass || wrapperBetActive;

        return hasFakeInput && hasBetActive;
    }

    // Check if fake bet script is loaded (even if not active)
    function isFakeBetScriptLoaded() {
        const fakeInput = document.querySelector('#fake-bet-input');
        return fakeInput !== null;
    }

    // Extract fake bet data from testmines.js with improved detection
    function extractFakeBetData() {
        try {
            // Multiple ways to detect fake bet script
            const fakeInput = document.querySelector('#fake-bet-input');
            const hasFakeBetScript = fakeInput !== null ||
                                    typeof window.__isFakeBetModalOpening === 'function' ||
                                    typeof window.getSelectedMinesCount === 'function';

            if (!hasFakeBetScript) {
                return null; // Fake bet script not loaded
            }

            const minesSelect = document.querySelector('select[data-testid="mines-count"]');
            const currencySelect = document.querySelector('select[name="currency"]');

            // Check for bet active state - multiple indicators
            const betActiveClass = document.body.classList.contains('bet-active');
            const wrapperBetActive = document.querySelector('.input-button-wrap.svelte-dka04o')?.classList.contains('bet-active');
            const inputWrapBetActive = document.querySelector('.input-wrap.bet-active');

            // Check if fake bet is active
            const isActive = betActiveClass || wrapperBetActive || inputWrapBetActive !== null;

            // Get mines count - check multiple selectors for better detection
            let minesCount = 3; // Default
            if (minesSelect) {
                minesCount = parseInt(minesSelect.value) || 3;
            } else {
                // Fallback: try other selectors
                const altSelect = document.querySelector('select[name="mines"], select[id="mines"], input[aria-label*="mines" i]');
                if (altSelect) {
                    minesCount = parseInt(altSelect.value) || 3;
                } else {
                    // Try to get from testmines.js function if available
                    if (typeof window.getSelectedMinesCount === 'function') {
                        try {
                            minesCount = window.getSelectedMinesCount() || 3;
                        } catch (e) {
                            console.log('Could not get mines count from testmines.js function');
                        }
                    }
                }
            }

            // Get bet amount
            let betAmount = 0;
            if (fakeInput) {
                betAmount = parseFloat(fakeInput.value) || 0;
            } else {
                // Fallback: try regular input
                const altInput = document.querySelector('input[name="amount"], input[aria-label*="amount" i]');
                if (altInput) {
                    betAmount = parseFloat(altInput.value) || 0;
                }
            }

            // Get currency
            let currency = '';
            if (currencySelect) {
                currency = currencySelect.value || '';
            }

            // Generate unique bet ID for fake bets when bet becomes active
            // Use a combination that changes when bet starts but stays stable during the bet
            let betId = null;
            if (isActive) {
                // Check if this is a new bet (mines count or bet amount changed, or bet just became active)
                const wasActive = lastBetState.is_active;
                const minesChanged = lastBetState.mines !== minesCount;
                const amountChanged = Math.abs((lastBetState.bet_amount || 0) - betAmount) > 0.0001; // Account for float precision
                const isNewBet = !wasActive || minesChanged || amountChanged;

                if (isNewBet) {
                    // New bet started - generate new bet ID
                    fakeBetStartTime = Date.now();
                    betId = `fake_${minesCount}_${betAmount}_${fakeBetStartTime}`;
                } else {
                    // Same bet continues - use existing bet ID from lastBetState
                    betId = lastBetState.bet_id || `fake_${minesCount}_${betAmount}_${fakeBetStartTime || Date.now()}`;
                }
            } else {
                // Bet is not active - reset start time only if it was previously active
                if (lastBetState.is_active) {
                fakeBetStartTime = null;
                }
            }

            return {
                is_fake_bet: true,
                is_active: isActive,
                bet_id: betId,
                bet_amount: betAmount,
                currency: currency,
                mines: minesCount
            };
        } catch (error) {
            console.error('Error extracting fake bet data:', error);
            return null;
        }
    }

    // Extract Mines game data - Fetch from Stake API or detect fake bets
    async function extractMinesData() {
        try {
            // Check if fake bet mode is enabled
            if (fakeBetMode) {
                // Fake bet mode enabled - only detect fake bets, ignore real bets
                const fakeBetData = extractFakeBetData();
                const fakeInput = document.querySelector('#fake-bet-input');

                if (!fakeInput) {
                    // Fake bet script not loaded
                    return {
                        game_type: 'mines',
                        token: apiToken,
                        timestamp: Date.now(),
                        is_fake_bet: true,
                        is_active: false,
                        bet_id: null,
                        mines: null,
                        error: 'Fake bet script not detected. Please load testmines.js'
                    };
                }

                // Build game data object for fake bet
                const gameData = {
                    game_type: 'mines',
                    token: apiToken,
                    timestamp: Date.now(),
                    is_fake_bet: true
                };

                if (fakeBetData) {
                    gameData.is_active = fakeBetData.is_active;
                    gameData.bet_id = fakeBetData.bet_id;
                    gameData.bet_amount = fakeBetData.bet_amount;
                    gameData.currency = fakeBetData.currency;
                    gameData.mines = fakeBetData.mines;

                    // Try to get username from Stake API
                    try {
                        const username = await fetchUsername();
                        if (username) {
                            gameData.username = username;
                        }
                    } catch (e) {
                        console.log('Could not fetch username for fake bet');
                    }

                    console.log('🎮 Fake bet detected (Fake Bet Mode):', {
                        is_active: gameData.is_active,
                        bet_id: gameData.bet_id,
                        mines: gameData.mines,
                        bet_amount: gameData.bet_amount
                    });
                } else {
                    // Fake bet script loaded but no active bet
                    gameData.is_active = false;
                    gameData.bet_id = null;

                    // Extract mines count from UI
                    const minesSelect = document.querySelector('select[data-testid="mines-count"]');
                    if (minesSelect) {
                        gameData.mines = parseInt(minesSelect.value) || 3;
                    } else {
                        gameData.mines = 3; // Default
                    }
                }

                return gameData;
            }

            // Fake bet mode disabled - detect both fake and real bets (default behavior)
            // First check if fake bet (testmines.js) is active
            const fakeBetData = extractFakeBetData();
            const isFakeBet = fakeBetData && fakeBetData.is_fake_bet;

            // Build game data object
            const gameData = {
                game_type: 'mines',
                token: apiToken,
                timestamp: Date.now(),
                is_fake_bet: isFakeBet || false
            };

            // If fake bet is detected, use fake bet data
            if (isFakeBet && fakeBetData) {
                gameData.is_active = fakeBetData.is_active;
                gameData.bet_id = fakeBetData.bet_id;
                gameData.bet_amount = fakeBetData.bet_amount;
                gameData.currency = fakeBetData.currency;
                gameData.mines = fakeBetData.mines;
                gameData.is_fake_bet = true;

                // Try to get username from Stake API (for display purposes)
                try {
                    const username = await fetchUsername();
                    if (username) {
                        gameData.username = username;
                    }
                } catch (e) {
                    console.log('Could not fetch username for fake bet');
                }

                console.log('🎮 Fake bet detected:', {
                    is_active: gameData.is_active,
                    bet_id: gameData.bet_id,
                    mines: gameData.mines,
                    bet_amount: gameData.bet_amount
                });

                return gameData;
            }

            // If fake input exists but bet is not active, still mark as fake bet but inactive
            const fakeInput = document.querySelector('#fake-bet-input');
            if (fakeInput && !isFakeBet) {
                // Fake bet script is loaded but bet is not active
                gameData.is_fake_bet = true;
                gameData.is_active = false;
                gameData.bet_id = null;

                // Still extract mines count for when bet becomes active
                const minesSelect = document.querySelector('select[data-testid="mines-count"]');
                if (minesSelect) {
                    gameData.mines = parseInt(minesSelect.value) || 3;
                }
            }

            // Otherwise, fetch real bet data from Stake API
            const betData = await fetchMinesBetData();

            // Process bet data from Stake API - structure: { user: { activeCasinoBet: {...} } }
            if (betData && betData.user) {
                const activeBet = betData.user.activeCasinoBet;

                if (activeBet && activeBet.active) {
                    // Active bet exists
                    gameData.is_active = true;
                    gameData.bet_id = activeBet.id;
                    gameData.bet_amount = activeBet.amount || 0;
                    gameData.currency = activeBet.currency || '';
                    gameData.mines = activeBet.state?.minesCount || 3;
                    gameData.username = activeBet.user?.name || betData.user.name || '';

                    // Include full raw bet data
                    gameData.raw_bet_data = betData;
                } else {
                    // No active bet
                    gameData.is_active = false;
                    gameData.bet_id = null;
                    gameData.username = betData.user.name || '';

                    // Try to extract mines count from UI (for when no active bet)
                    const minesSelect = document.querySelector('select[name="mines"], select[data-testid="mines-count"], input[aria-label*="mines" i]');
                    if (minesSelect) {
                        gameData.mines = parseInt(minesSelect.value) || 3;
                    } else {
                        gameData.mines = 3; // Default
                    }

                    // Try to extract bet amount from UI
                    const betInput = document.querySelector('input[name="amount"], input[aria-label*="amount" i], #fake-bet-input');
                    if (betInput) {
                        gameData.bet_amount = betInput.value;
                    }

                    // Try to extract currency from UI
                    const currencySelect = document.querySelector('select[name="currency"]');
                    if (currencySelect) {
                        gameData.currency = currencySelect.value;
                    }

                    // Include raw data even if no active bet
                    gameData.raw_bet_data = betData;
                }
            } else {
                // No bet data at all - fallback to UI scraping
                gameData.is_active = false;
                gameData.bet_id = null;

                // Try to extract mines count from UI
                const minesSelect = document.querySelector('select[name="mines"], select[data-testid="mines-count"], input[aria-label*="mines" i]');
                if (minesSelect) {
                    gameData.mines = parseInt(minesSelect.value) || 3;
                } else {
                    gameData.mines = 3; // Default
                }

                // Try to extract bet amount from UI
                const betInput = document.querySelector('input[name="amount"], input[aria-label*="amount" i], #fake-bet-input');
                if (betInput) {
                    gameData.bet_amount = betInput.value;
                }

                // Try to extract currency from UI
                const currencySelect = document.querySelector('select[name="currency"]');
                if (currencySelect) {
                    gameData.currency = currencySelect.value;
                }
            }

            return gameData;
        } catch (error) {
            console.error('Error extracting mines data:', error);
            return null;
        }
    }

    // Cache for crash history to avoid fetching too frequently
    let crashHistoryCache = {
        data: null,
        timestamp: 0,
        cacheDuration: 5000  // 5 seconds cache
    };

    // Fetch crash history from Stake API
    async function fetchCrashHistory() {
        try {
            // Use cached data if recent
            const now = Date.now();
            if (crashHistoryCache.data && (now - crashHistoryCache.timestamp) < crashHistoryCache.cacheDuration) {
                return crashHistoryCache.data;
            }

            // GraphQL query for crash history
            const graphqlQuery = {
                query: `
                    query CrashGameListHistory($limit: Int, $offset: Int) {
                        crashGameList(limit: $limit, offset: $offset) {
                            id
                            startTime
                            crashpoint
                            hash {
                                id
                                hash
                                __typename
                            }
                            __typename
                        }
                    }
                `,
                operationName: "CrashGameListHistory",
                variables: {
                    limit: 25,
                    offset: 0
                }
            };

            // Fetch from Stake API using user's session
            const response = await fetch('https://stake.ac/_api/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': apiToken,
                    'x-language': 'en'
                },
                body: JSON.stringify(graphqlQuery)
            });

            if (response.ok) {
                const jsonData = await response.json();
                if (jsonData.data && jsonData.data.crashGameList) {
                    // Extract crash points
                    const crashPoints = jsonData.data.crashGameList.map(game => parseFloat(game.crashpoint));
                    crashHistoryCache.data = crashPoints;
                    crashHistoryCache.timestamp = now;
                    return crashPoints;
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching crash history:', error);
            return crashHistoryCache.data;  // Return cached data if available
        }
    }

    // Extract Crash game data
    async function extractCrashData() {
        try {
            const gameData = {
                game_type: 'crash',
                token: apiToken,
                timestamp: Date.now()
            };

            // Fetch username from Stake API
            const username = await fetchUsername();
            if (username) {
                gameData.username = username;
            }

            // Try to extract bet amount
            const betInput = document.querySelector('input[name="amount"], input[aria-label*="amount" i]');
            if (betInput) {
                gameData.bet_amount = betInput.value;
            }

            // Try to extract currency
            const currencySelect = document.querySelector('select[name="currency"]');
            if (currencySelect) {
                gameData.currency = currencySelect.value;
            }

            // Check if game is waiting/active
            const gameStatus = document.querySelector('[class*="status"], [class*="waiting"]');
            gameData.game_status = gameStatus ? gameStatus.textContent : 'unknown';

            // Fetch crash history and include it
            const crashHistory = await fetchCrashHistory();
            if (crashHistory && crashHistory.length > 0) {
                gameData.crash_history = crashHistory;
            }

            return gameData;
        } catch (error) {
            console.error('Error extracting crash data:', error);
            return null;
        }
    }

    // Monitor games and send data
    function startGameMonitoring() {
        if (checkInterval) clearInterval(checkInterval);

        checkInterval = setInterval(async () => {
            if (!isConnected) return;

            const gameType = detectGameType();
            if (!gameType) {
                document.getElementById('soul-game-type').textContent = 'None';
                return;
            }

            if (gameType !== currentGameType) {
                currentGameType = gameType;
                document.getElementById('soul-game-type').textContent = gameType.toUpperCase();
                showNotification(`🎮 Detected ${gameType.toUpperCase()} game`);
            }

            let gameData = null;
            if (gameType === 'mines') {
                gameData = await extractMinesData();  // Now async (fetches username)
            } else if (gameType === 'crash') {
                gameData = await extractCrashData();  // Now async
            }

            if (gameData) {
                // For mines - only send when bet state CHANGES or mines count changes
                if (gameType === 'mines') {
                    const currentState = {
                        is_active: gameData.is_active,
                        bet_id: gameData.bet_id,
                        mines: gameData.mines,
                        bet_amount: gameData.bet_amount,
                        is_fake_bet: gameData.is_fake_bet || false
                    };

                    // Check if state changed (including mines count change)
                    const stateChanged =
                        currentState.is_active !== lastBetState.is_active ||
                        currentState.bet_id !== lastBetState.bet_id ||
                        currentState.mines !== lastBetState.mines || // Mines count changed
                        (currentState.is_fake_bet && currentState.is_active && !lastBetState.is_active); // Fake bet becoming active

                    // Only send if state changed OR if bet is active and mines count changed
                    if (!stateChanged && lastBetState.is_active === currentState.is_active) {
                        // State unchanged - don't send
                        return;
                    }

                    // Update last state BEFORE sending
                    const previousState = {...lastBetState};
                    lastBetState = currentState;

                    // Log state change
                    if (currentState.is_active && currentState.bet_id) {
                        const betType = currentState.is_fake_bet ? '🎮 Fake' : '🎲 Real';
                        console.log(`${betType} bet detected: ${currentState.bet_id} (Mines: ${currentState.mines})`);
                        if (stateChanged) {
                        showNotification(`${betType === '🎮 Fake' ? '🎮' : '🎲'} New bet detected!`);
                        }
                    } else if (!currentState.is_active && previousState.is_active) {
                        console.log('⏳ Bet ended, waiting for new bet');
                        // Reset bet ID when bet ends
                        lastBetState.bet_id = null;
                    } else if (currentState.mines !== previousState.mines && currentState.mines !== null && currentState.is_active) {
                        console.log(`🔄 Mines count changed during bet: ${previousState.mines} → ${currentState.mines}`);
                    }
                }

                try {
                    // Send game data to backend
                    console.log('📤 Sending game data to backend:', {
                        game_type: gameData.game_type,
                        is_active: gameData.is_active,
                        bet_id: gameData.bet_id,
                        mines: gameData.mines,
                        username: gameData.username ? 'present' : 'missing'
                    });
                    const response = await sendToBackend('/extension_game_data', gameData);

                    if (response.status === 'success' && response.has_prediction) {
                        // Backend has generated prediction, frontend will receive it
                        console.log('✅ Prediction generated by backend');
                    } else {
                        console.log('ℹ️ Backend response:', response);
                    }
                } catch (error) {
                    console.error('Error sending game data:', error);
                    // Don't disconnect on error - might be temporary network issue
                    // Only show notification if it's a persistent error
                    if (error.message && error.message.includes('after retries')) {
                        showNotification('⚠️ Connection issue - retrying...');
                    }
                }
            }
        }, CHECK_INTERVAL);
    }

    // Initialize extension
    function init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Create UI after a short delay to ensure Stake page is loaded
        setTimeout(() => {
            createUI();
            console.log('Soul Predictor Extension loaded');

            // Auto-connect if token is saved
            if (apiToken) {
                setTimeout(() => {
                    const connectBtn = document.getElementById('soul-connect-btn');
                    if (connectBtn) {
                        showNotification('🔄 Auto-connecting with saved token...');
                        connectBtn.click();
                    }
                }, 2000);
            }
        }, 1000);
    }

    // Start initialization
    init();
})();
