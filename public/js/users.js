// The endpoint is determined by the data attribute on the users page element
const usersPage = document.getElementById('users-admin');
const usersEndpoint = usersPage.dataset.usersEndpoint;

const listElement = document.getElementById('users-list');
const templateElement = document.getElementById('user-row-template');
const editTemplateElement = document.getElementById('user-edit-template');
const loadingElement = document.getElementById('users-loading');
const errorElement = document.getElementById('users-error');
const emptyElement = document.getElementById('users-empty');
const isAdminList = usersPage.dataset.isAdminList === 'true';
const controlsElement = document.getElementById('users-controls');
const searchInput = document.getElementById('users-search');
const roleFilter = document.getElementById('users-role-filter');
const sortField = document.getElementById('users-sort-field');
const sortOrder = document.getElementById('users-sort-order');
const resetButton = document.getElementById('users-reset');
const resultsCountElement = document.getElementById('users-results-count');
const paginationElement = document.getElementById('users-pagination');
const pageLinksElement = document.getElementById('users-page-links');
const previousButton = document.getElementById('users-previous');
const nextButton = document.getElementById('users-next');

const usersById = new Map();
const usersPerPage = 10;
let currentPage = 1;

const findUser = (userId) => usersById.get(String(userId));

const showError = (message) => {
    errorElement.textContent = message;
    errorElement.hidden = false;
};

const requestJson = async (url, options) => {
    const response = await fetch(url, options);
    const payload = response.status === 204 ? null : await response.json();
    if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'The request failed.');
    }
    return payload;
};

const deleteUser = async (userId) => {
    const user = findUser(userId);
    if (!user) {
        return;
    }

    if (!window.confirm(`Delete ${user.name || 'this user'}?`)) {
        return;
    }

    errorElement.hidden = true;
    try {
        const result = await requestJson(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        if (result.deletedSelf) {
            window.location.assign('/login');
            return;
        }
        await loadUsers();
    } catch (error) {
        showError(error.message);
    }
};

const renderUserCard = (userId) => {
    const user = findUser(userId);
    if (!user) {
        return null;
    }

    const card = templateElement.content.firstElementChild.cloneNode(true);
    card.querySelector('[data-field="name"]').textContent = user.name || '';
    card.querySelector('[data-field="username"]').textContent = user.username || '';
    card.querySelector('[data-field="email"]').textContent = user.email || '';
    card.querySelector('[data-field="role"]').textContent = user.role?.name || 'User';
    card.querySelector('.user-edit').addEventListener('click', () => {
        listElement.replaceChild(renderUserEditCard(userId), card);
    });
    return card;
};

const renderUserEditCard = (userId) => {
    const user = findUser(userId);
    if (!user) {
        return null;
    }

    const form = editTemplateElement.content.firstElementChild.cloneNode(true);
    const nameInput = form.elements.namedItem('name');
    const emailInput = form.elements.namedItem('email');
    const roleSelect = form.elements.namedItem('role');
    nameInput.value = user.name || '';
    emailInput.value = user.email || '';
    if (roleSelect) {
        roleSelect.value = user.role?.name || 'customer';
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorElement.hidden = true;
        try {
            await requestJson(`/api/users/${encodeURIComponent(userId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameInput.value,
                    email: emailInput.value,
                    ...(roleSelect ? { role: roleSelect.value } : {}),
                }),
            });
            await loadUsers();
        } catch (error) {
            showError(error.message);
        }
    });

    form.querySelector('.user-cancel').addEventListener('click', () => {
        listElement.replaceChild(renderUserCard(userId), form);
    });
    form.querySelector('.user-delete').addEventListener('click', () => deleteUser(userId));
    return form;
};

const renderUsers = (users) => {
    usersById.clear();
    const fragment = document.createDocumentFragment();
    users.forEach((user) => {
        const userId = String(user._id || user.id);
        usersById.set(userId, user);
        fragment.appendChild(renderUserCard(userId));
    });
    listElement.replaceChildren(fragment);
    emptyElement.hidden = users.length !== 0;
    if (isAdminList && users.length === 0) {
        emptyElement.textContent = searchInput.value.trim() || roleFilter.value
            ? 'No users match these search and filter options.'
            : 'No users found.';
    }
};

const renderPagination = (pagination) => {
    if (!paginationElement) {
        return;
    }

    resultsCountElement.textContent = pagination.totalUsers === 0
        ? 'No users to display'
        : `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.totalUsers)} of ${pagination.totalUsers} users`;
    paginationElement.hidden = pagination.totalPages <= 1;
    previousButton.disabled = !pagination.hasPreviousPage;
    nextButton.disabled = !pagination.hasNextPage;
    pageLinksElement.replaceChildren();

    const visiblePages = [...new Set([
        1,
        pagination.page - 1,
        pagination.page,
        pagination.page + 1,
        pagination.totalPages,
    ])]
        .filter((page) => page >= 1 && page <= pagination.totalPages)
        .sort((left, right) => left - right);

    let previousPage = 0;
    visiblePages.forEach((page) => {
        if (page - previousPage > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'users-page-ellipsis';
            ellipsis.textContent = '...';
            ellipsis.setAttribute('aria-hidden', 'true');
            pageLinksElement.appendChild(ellipsis);
        }

        const pageButton = document.createElement('button');
        pageButton.type = 'button';
        pageButton.textContent = String(page);
        pageButton.setAttribute('aria-label', `Page ${page}`);
        if (page === pagination.page) {
            pageButton.setAttribute('aria-current', 'page');
        }
        pageButton.addEventListener('click', () => {
            currentPage = page;
            loadUsers();
        });
        pageLinksElement.appendChild(pageButton);
        previousPage = page;
    });
};

async function loadUsers() {
    loadingElement.hidden = false;
    errorElement.hidden = true;
    try {
        if (isAdminList) {
            const url = new URL(usersEndpoint, window.location.origin);
            url.searchParams.set('page', String(currentPage));
            url.searchParams.set('limit', String(usersPerPage));
            url.searchParams.set('sort', sortField.value || 'username');
            url.searchParams.set('order', sortOrder.value || 'asc');
            if (searchInput.value.trim()) {
                url.searchParams.set('q', searchInput.value.trim());
            }
            if (roleFilter.value) {
                url.searchParams.set('role', roleFilter.value);
            }

            const payload = await requestJson(url);
            renderUsers(payload.data);
            renderPagination(payload.pagination);
        } else {
            const payload = await requestJson(usersEndpoint);
            const users = Array.isArray(payload) ? payload : payload ? [payload] : [];
            renderUsers(users);
        }
    } catch (error) {
        showError('Unable to load users. Please try again.');
    } finally {
        loadingElement.hidden = true;
    }
}

if (controlsElement) {
    controlsElement.addEventListener('submit', (event) => {
        event.preventDefault();
        currentPage = 1;
        loadUsers();
    });

    resetButton.addEventListener('click', () => {
        controlsElement.reset();
        currentPage = 1;
        loadUsers();
    });

    previousButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage -= 1;
            loadUsers();
        }
    });

    nextButton.addEventListener('click', () => {
        currentPage += 1;
        loadUsers();
    });
}

loadUsers();