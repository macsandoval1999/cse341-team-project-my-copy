const registerForm = document.getElementById('register-form');


const passwordInput = registerForm.elements.namedItem('password');
const confirmPasswordInput = registerForm.elements.namedItem('confirm-password');
const passwordMatchError = document.getElementById('password-match-error');
const submitButton = registerForm.querySelector('button[type="submit"]');

const updateFormState = () => {
    const hasBothPasswords = passwordInput.value && confirmPasswordInput.value;
    const passwordsMismatch = hasBothPasswords && passwordInput.value !== confirmPasswordInput.value;
    const message = passwordsMismatch ? 'Passwords must match.' : '';

    confirmPasswordInput.setCustomValidity(message);
    passwordMatchError.hidden = !passwordsMismatch;
    submitButton.disabled = !registerForm.checkValidity();
};

registerForm.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', updateFormState);
    input.addEventListener('change', updateFormState);
});

registerForm.addEventListener('submit', (event) => {
    updateFormState();
    if (!registerForm.checkValidity()) {
        event.preventDefault();
        registerForm.reportValidity();
    }
});

updateFormState();
