document.querySelectorAll('.auth-password-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
        const passwordField = document.getElementById(toggle.getAttribute('aria-controls'));
        const isVisible = passwordField.type === 'text';

        passwordField.type = isVisible ? 'password' : 'text';
        toggle.textContent = isVisible ? 'Show' : 'Hide';
        toggle.setAttribute('aria-pressed', String(!isVisible));
        toggle.setAttribute(
            'aria-label',
            `${isVisible ? 'Show' : 'Hide'} ${passwordField.labels[0].textContent.toLowerCase()}`
        );
    });
});