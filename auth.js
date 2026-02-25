let currentAuthUser = null;
const isLocalRuntime = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function setPullEnabled(isEnabled) {
    var pullButton = document.getElementById('pullBtn');
    if (pullButton) {
        pullButton.disabled = !isEnabled;
    }
}

function setAuthMessage(message, isError) {
    var authMessage = document.getElementById('authMessage');
    if (!authMessage) {
        return;
    }
    authMessage.textContent = message || '';
    authMessage.style.display = message ? 'block' : 'none';
    authMessage.classList.toggle('error', Boolean(isError));
}

function renderAuthState(authState) {
    var statusEl = document.getElementById('authStatus');
    var loginBtn = document.getElementById('loginBtn');
    var logoutBtn = document.getElementById('logoutBtn');

    if (!statusEl || !loginBtn || !logoutBtn) {
        return;
    }

    if (authState && authState.authenticated) {
        currentAuthUser = authState;
        statusEl.textContent = 'Signed in as ' + authState.battleTag;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        setPullEnabled(true);
    } else {
        currentAuthUser = null;
        statusEl.textContent = authState && authState.authConfigured === false
            ? 'Sign in unavailable: Blizzard OAuth not configured on server.'
            : 'Not signed in.';
        loginBtn.style.display = authState && authState.authConfigured === false ? 'none' : 'inline-block';
        logoutBtn.style.display = 'none';
        setPullEnabled(false);
    }
}

async function fetchAuthState() {
    if (!isLocalRuntime) {
        return {
            authenticated: false,
            authConfigured: false
        };
    }

    const response = await fetch('/auth/me', {
        credentials: 'same-origin'
    });
    if (!response.ok) {
        throw new Error('Unable to load authentication state');
    }
    return response.json();
}

async function refreshAuthState() {
    try {
        setAuthMessage('', false);
        const authState = await fetchAuthState();
        renderAuthState(authState);
    } catch (error) {
        renderAuthState({ authenticated: false, authConfigured: true });
        setAuthMessage(error.message, true);
    }
}

function getCurrentBattleTag() {
    return currentAuthUser && currentAuthUser.battleTag ? currentAuthUser.battleTag : '';
}

async function logout() {
    if (!isLocalRuntime) {
        renderAuthState({ authenticated: false, authConfigured: false });
        return;
    }

    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('Sign out failed');
        }
    } catch (error) {
        setAuthMessage(error.message, true);
    } finally {
        await refreshAuthState();
    }
}

function initializeAuthUi() {
    var loginBtn = document.getElementById('loginBtn');
    var logoutBtn = document.getElementById('logoutBtn');

    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            if (!isLocalRuntime) {
                setAuthMessage('Blizzard sign-in is only available when running the local backend.', true);
                return;
            }
            window.location.href = '/auth/login';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            logout();
        });
    }

    refreshAuthState();
}

window.getCurrentBattleTag = getCurrentBattleTag;
window.initializeAuthUi = initializeAuthUi;
window.setAuthMessage = setAuthMessage;
