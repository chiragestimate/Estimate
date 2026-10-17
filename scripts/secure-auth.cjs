const fs = require('fs');
const path = require('path');

// 1. Update login.html
const loginPath = path.join(__dirname, '..', 'login.html');
let loginHtml = fs.readFileSync(loginPath, 'utf8');

const loginSearch = /async function handleLogin\(e\)[\s\S]*?<\/script>/;
const loginReplacement = `async function handleLogin(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const btn = document.getElementById('login-btn');
  const btnText = document.getElementById('btn-text');
  const errorDiv = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');

  btn.disabled = true;
  btnText.innerHTML = '<span class="spinner"></span>Verifying Credentials...';
  errorDiv.classList.remove('show');

  try {
    if (!window.dbClient || !window.dbClient.auth) {
      throw new Error('Database client not initialized. Please refresh the page.');
    }

    const email = emailInput.includes('@') ? emailInput : \`\${emailInput}@agro.local\`;

    const { data, error } = await window.dbClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      let msg = error.message || 'Authentication failed.';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        msg = 'Invalid username/email or password.';
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        msg = 'User email is not confirmed in Supabase.';
      }
      throw new Error(msg);
    }

    if (!data?.session) {
      throw new Error('No active session received from authentication server.');
    }

    localStorage.setItem('admin_user', data.user?.email || email);
    window.location.replace('./pages/dashboard.html');
  } catch (err) {
    console.error('Login error:', err);
    errorText.textContent = err.message || 'Connection error. Please try again.';
    errorDiv.classList.add('show');
    btn.disabled = false;
    btnText.textContent = 'Login to ERP';
  }
}

// Check if already authenticated with a valid Supabase session
(async function checkExistingSession() {
  localStorage.removeItem('admin_logged_in');
  if (window.dbClient && window.dbClient.auth) {
    try {
      const { data: { session } } = await window.dbClient.auth.getSession();
      if (session) {
        window.location.replace('./pages/dashboard.html');
      }
    } catch (_) {}
  }
})();
</script>`;

if (!loginSearch.test(loginHtml)) {
  console.error('Could not match handleLogin in login.html');
  process.exit(1);
}
loginHtml = loginHtml.replace(loginSearch, loginReplacement);
fs.writeFileSync(loginPath, loginHtml, 'utf8');
console.log('Updated login.html');

// 2. Update index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const indexOldScript = /<script>[\s\S]*?localStorage\.getItem\('admin_logged_in'\)[\s\S]*?<\/script>/;
const indexNewScript = `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="./assets/js/database.js?v=1791036879151"></script>
  <script>
    (async function() {
      localStorage.removeItem('admin_logged_in');
      try {
        if (window.dbClient && window.dbClient.auth) {
          const { data: { session } } = await window.dbClient.auth.getSession();
          if (session) {
            window.location.replace('./pages/dashboard.html');
            return;
          }
        }
      } catch (e) {
        console.warn('Auth check error on landing:', e);
      }
      window.location.replace('./login.html');
    })();
  </script>`;

if (!indexOldScript.test(indexHtml)) {
  console.error('Could not match auth script in index.html');
  process.exit(1);
}
indexHtml = indexHtml.replace(indexOldScript, indexNewScript);
fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('Updated index.html');

// 3. Update assets/js/app.js
const appJsPath = path.join(__dirname, '..', 'assets', 'js', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const authCheckRegex = /\/\/ Global Auth check[\s\S]*?\}\)\(\);/;
const authCheckReplacement = `// Global Auth check - Cryptographic Supabase Session Enforced
(function() {
  const pathname = window.location.pathname;
  const isLoginPage = pathname.includes('login.html');
  if (isLoginPage) return;

  const isPagesDir = pathname.includes('/pages/');
  const loginUrl = isPagesDir ? '../login.html' : './login.html';

  function redirectToLogin() {
    localStorage.removeItem('admin_logged_in');
    localStorage.removeItem('admin_user');
    window.location.replace(loginUrl);
  }

  async function verifySession() {
    // If dbClient is not ready yet, wait briefly for database.js / Supabase CDN
    let checks = 0;
    while ((!window.dbClient || !window.dbClient.auth) && checks < 20) {
      await new Promise(r => setTimeout(r, 100));
      checks++;
    }

    if (!window.dbClient || !window.dbClient.auth) {
      console.warn('Supabase DB Client unavailable, redirecting to login.');
      redirectToLogin();
      return;
    }

    try {
      const { data: { session }, error } = await window.dbClient.auth.getSession();
      if (error || !session) {
        redirectToLogin();
        return;
      }

      // Valid session active
      if (session.user?.email) {
        localStorage.setItem('admin_user', session.user.email);
        const nameEl = document.getElementById('user-profile-name');
        if (nameEl) nameEl.textContent = session.user.email.split('@')[0];
      }

      // Listen for session revocation or sign out
      window.dbClient.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
          redirectToLogin();
        }
      });
    } catch (err) {
      console.warn('Session verification exception:', err);
      redirectToLogin();
    }
  }

  verifySession();
})();`;

if (!authCheckRegex.test(appJs)) {
  console.error('Could not match auth check in app.js');
  process.exit(1);
}
appJs = appJs.replace(authCheckRegex, authCheckReplacement);
fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Updated assets/js/app.js');
