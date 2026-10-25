const feedbackDialog = document.querySelector('.auth-feedback-dialog');

if (feedbackDialog) {
    const closeFeedbackDialog = () => {
        feedbackDialog.close();
        document.querySelector('#login-form #identifier, #register-form #email')?.focus();
    };

    feedbackDialog.querySelector('[data-close-auth-feedback]')?.addEventListener('click', closeFeedbackDialog);
    feedbackDialog.addEventListener('click', (event) => {
        if (event.target === feedbackDialog) {
            closeFeedbackDialog();
        }
    });

    if (feedbackDialog.dataset.message) {
        feedbackDialog.showModal();
    }
}