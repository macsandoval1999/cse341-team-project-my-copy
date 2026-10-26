(() => {
    const dialog = document.getElementById("admin-delete-dialog");
    if (!dialog) return;

    const input = dialog.querySelector("#admin-delete-input");
    const identifierElement = dialog.querySelector('[data-field="identifier"]');
    const descriptionElement = dialog.querySelector('[data-field="description"]');
    const errorElement = dialog.querySelector('[data-field="error"]');
    const confirmButton = dialog.querySelector('[data-action="confirm"]');
    const cancelButton = dialog.querySelector('[data-action="cancel"]');
    let expectedIdentifier = "";
    let previouslyFocusedElement = null;
    let resolveConfirmation = null;
    let confirmed = false;

    const updateConfirmationState = () => {
        confirmButton.disabled = input.value !== expectedIdentifier;
    };

    const finish = () => {
        input.removeEventListener("input", updateConfirmationState);
        confirmButton.removeEventListener("click", confirmDelete);
        cancelButton.removeEventListener("click", cancelDelete);
        dialog.removeEventListener("close", handleClose);
        input.value = "";
        errorElement.hidden = true;
        errorElement.textContent = "";
        if (previouslyFocusedElement instanceof HTMLElement) {
            previouslyFocusedElement.focus();
        }
        resolveConfirmation?.(confirmed);
        resolveConfirmation = null;
    };

    const handleClose = () => finish();
    const confirmDelete = () => {
        if (input.value !== expectedIdentifier) {
            errorElement.textContent = "The value does not match.";
            errorElement.hidden = false;
            return;
        }
        confirmed = true;
        dialog.close();
    };
    const cancelDelete = () => dialog.close();

    window.confirmAdminDelete = ({
        itemName,
        identifier,
        identifierLabel = "ID",
        description,
    }) => {
        if (dialog.open) return Promise.resolve(false);
        expectedIdentifier = String(identifier ?? "");
        if (!expectedIdentifier) {
            return Promise.reject(new Error("A unique identifier is required to confirm deletion."));
        }

        confirmed = false;
        previouslyFocusedElement = document.activeElement;
        dialog.querySelector("#admin-delete-title").textContent = `Delete ${itemName}?`;
        descriptionElement.textContent = description ||
            `This action permanently deletes this ${itemName}. This cannot be undone.`;
        identifierElement.textContent = expectedIdentifier;
        identifierElement.setAttribute("aria-label", identifierLabel);
        input.setAttribute("aria-label", `Type ${identifierLabel} to confirm`);
        input.placeholder = identifierLabel;
        input.value = "";
        confirmButton.disabled = true;
        errorElement.hidden = true;

        return new Promise((resolve) => {
            resolveConfirmation = resolve;
            input.addEventListener("input", updateConfirmationState);
            confirmButton.addEventListener("click", confirmDelete);
            cancelButton.addEventListener("click", cancelDelete);
            dialog.addEventListener("close", handleClose);
            dialog.showModal();
            input.focus();
        });
    };
})();
