(function () {
  const loginForm = document.getElementById('landingLoginForm');
  const registerForm = document.getElementById('landingRegisterForm');
  const loginMsg = document.getElementById('login-msg');
  const registerMsg = document.getElementById('register-msg');
  const profileBtn = document.getElementById('profile-btn');

  function setMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#b00020' : '#0b6b3a';
  }

  function resetMessages() {
    setMessage(loginMsg, '', false);
    setMessage(registerMsg, '', false);
  }

  const existingSession = getSession();
  if (existingSession && profileBtn) {
    profileBtn.title = 'Ir al inicio';
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      if (getSession()) {
        window.location.href = 'home.html';
      } else {
        setMessage(loginMsg, 'Inicia sesion primero.', true);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      resetMessages();

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        setMessage(loginMsg, 'Completa email y contrasena.', true);
        return;
      }

      try {
        const data = await apiRequest('/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password },
        });

        setSession({
          token: data.token,
          user: data.user,
        });

        setMessage(loginMsg, 'Login exitoso. Redirigiendo...', false);
        window.location.href = 'home.html';
      } catch (error) {
        setMessage(loginMsg, error.message || 'No se pudo iniciar sesion.', true);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      resetMessages();

      const firstName = document.getElementById('register-first-name').value.trim();
      const lastName = document.getElementById('register-last-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;
      const photoFile = document.getElementById('register-photo').files[0];

      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        setMessage(registerMsg, 'Completa todos los campos requeridos.', true);
        return;
      }

      if (password !== confirmPassword) {
        setMessage(registerMsg, 'Las contrasenas no coinciden.', true);
        return;
      }

      try {
        let avatarBase64 = null;
        let avatarMime = null;

        if (photoFile) {
          const photoDataUrl = await fileToDataURL(photoFile);
          const dataUrlStr = String(photoDataUrl || '');
          const commaIndex = dataUrlStr.indexOf(',');

          if (commaIndex > -1) {
            avatarBase64 = dataUrlStr.slice(commaIndex + 1);
            avatarMime = photoFile.type || 'image/jpeg';
          }
        }

        await apiRequest('/auth/register', {
          method: 'POST',
          auth: false,
          body: {
            name: `${firstName} ${lastName}`.trim(),
            email,
            password,
            avatarBase64,
            avatarMime,
          },
        });

        const loginData = await apiRequest('/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password },
        });

        const userData = {
          token: loginData.token,
          user: loginData.user,
        };

        setSession(userData);
        setMessage(registerMsg, 'Registro exitoso. Redirigiendo...', false);
        window.location.href = 'home.html';
      } catch (error) {
        setMessage(registerMsg, error.message || 'No se pudo registrar.', true);
      }
    });
  }
})();
