const listEl = document.getElementById('admin-trains-list');
const loadingEl = document.getElementById('admin-trains-loading');
const messageEl = document.getElementById('admin-trains-message');
const createForm = document.getElementById('train-create-form');
const trainTemplate = document.getElementById('admin-train-template');
const tripTemplate = document.getElementById('admin-train-trip-template');
const editModal = document.getElementById('admin-train-edit-modal');
const tripsModal = document.getElementById('admin-train-trips-modal');
const modalOverlay = document.getElementById('admin-train-overlay');
const editForm = document.getElementById('admin-train-edit-form');
const tripListEl = document.getElementById('admin-train-trips-list');
const editFeedback = document.getElementById('train-edit-validation');

const numberFields = ['maxSpeedKmh', 'capacity'];
const optionalFields = ['imageUrl', 'imageAlt', 'bestFor', 'description'];
const searchInput = document.getElementById('admin-trains-search');
const typeFilter = document.getElementById('admin-trains-type');
const powerFilter = document.getElementById('admin-trains-power');
const sortField = document.getElementById('admin-trains-sort');
const sortOrder = document.getElementById('admin-trains-order');
const paginationEl = document.getElementById('admin-trains-pagination');
const pageLinksEl = document.getElementById('admin-trains-page-links');
const previousButton = document.getElementById('admin-trains-previous');
const nextButton = document.getElementById('admin-trains-next');
const resultsCountEl = document.getElementById('admin-trains-results-count');

// The latest data from the API and the last set of filters applied by the user.
const state = {
    trains: [],
    visibleTrains: [],
    trips: [],
    catalogLoaded: false,
    filters: { q: '', type: '', powerSource: '', sort: 'name', order: 'asc' },
};
let currentPage = 1;
let currentPagination = null;
let modalTrigger = null;

const showMessage = (text, isError = false) => {
    messageEl.textContent = text;
    messageEl.classList.toggle('trains-error', isError);
};

const describeInvalidControl = (control) => {
    const label = control.labels?.[0];
    const fieldName = label?.querySelector('span')?.textContent.trim() ||
        label?.textContent.trim() ||
        control.name ||
        'Required field';
    return control.validity.valueMissing
        ? `${fieldName} is required`
        : `${fieldName}: ${control.validationMessage}`;
};

const attachValidationFeedback = (form, feedbackElement, action) => {
    form.addEventListener('invalid', () => {
        window.setTimeout(() => {
            const invalidControls = Array.from(form.querySelectorAll(':invalid'));
            feedbackElement.textContent =
                `Complete the following before ${action}: ${invalidControls.map(describeInvalidControl).join('; ')}.`;
            feedbackElement.hidden = false;
        }, 0);
    }, true);
    form.addEventListener('input', () => {
        feedbackElement.hidden = true;
    });
    form.addEventListener('change', () => {
        feedbackElement.hidden = true;
    });
    form.addEventListener('reset', () => {
        feedbackElement.hidden = true;
    });
};

// Turns an API error response into one readable sentence
const describeError = async (response) => {
    try {
        const body = await response.json();
        if (Array.isArray(body.errors)) {
            return body.errors.map((error) => error.message).join(' ');
        }
        if (Array.isArray(body.trips)) {
            return `${body.error}: ${body.trips.join(', ')}`;
        }
        return body.error || body.message || `Request failed (${response.status})`;
    } catch {
        return `Request failed (${response.status})`;
    }
};

// /api/trains returns at most 50 trains per page, so keep asking until there are no more pages
const fetchAllTrains = async () => {
    const trains = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const response = await fetch(`/api/trains?page=${page}&limit=50&sort=name`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to load trains (${response.status})`);

        const payload = await response.json();
        trains.push(...payload.data);
        hasNextPage = payload.pagination.hasNextPage;
        page += 1;
    }

    return trains;
};

const fetchAllTrips = async () => {
    const trips = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const response = await fetch(`/api/trips?page=${page}&limit=50&sort=name`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to load trips (${response.status})`);

        const payload = await response.json();
        trips.push(...payload.data);
        hasNextPage = payload.pagination.hasNextPage;
        page += 1;
    }

    return trips;
};

const fetchTrainPage = async (page) => {
    const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        sort: state.filters.sort,
        order: state.filters.order,
    });
    if (state.filters.q) params.set('q', state.filters.q);
    if (state.filters.type) params.set('type', state.filters.type);
    if (state.filters.powerSource) params.set('powerSource', state.filters.powerSource);
    const response = await fetch(`/api/trains?${params}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load train page (${response.status})`);
    return response.json();
};

const renderPagination = (pagination) => {
    currentPage = pagination.page;
    currentPagination = pagination;
    paginationEl.hidden = pagination.totalPages <= 1;
    previousButton.disabled = !pagination.hasPreviousPage;
    nextButton.disabled = !pagination.hasNextPage;
    pageLinksEl.replaceChildren();

    const pages = [...new Set([
        1,
        pagination.page - 1,
        pagination.page,
        pagination.page + 1,
        pagination.totalPages,
    ])]
        .filter((page) => page >= 1 && page <= pagination.totalPages)
        .sort((left, right) => left - right);
    let previousPage = 0;
    pages.forEach((page) => {
        if (page - previousPage > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'users-page-ellipsis';
            ellipsis.textContent = '...';
            ellipsis.setAttribute('aria-hidden', 'true');
            pageLinksEl.appendChild(ellipsis);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(page);
        button.setAttribute('aria-label', `Page ${page}`);
        if (page === pagination.page) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', () => loadData(page));
        pageLinksEl.appendChild(button);
        previousPage = page;
    });
    resultsCountEl.textContent = pagination.totalItems === 0
        ? 'No trains to display'
        : `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.totalItems)} of ${pagination.totalItems} trains`;
};

const populateFilterOptions = async () => {
    const response = await fetch('/api/trains/filters', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load train filter options (${response.status})`);
    const filters = await response.json();
    filters.types.forEach((value) => typeFilter.add(new Option(value, value)));
    filters.powerSources.forEach((value) => powerFilter.add(new Option(value, value)));
};

// Reads a form into a train object, turning number fields into numbers
const readTrainForm = (form, { skipEmptyOptional }) => {
    const train = {};

    for (const [field, value] of new FormData(form).entries()) {
        const text = value.trim();

        if (numberFields.includes(field)) {
            train[field] = Number(text);
        } else if (skipEmptyOptional && optionalFields.includes(field) && text === '') {
            continue;
        } else {
            train[field] = text;
        }
    }

    return train;
};

const closeTrainModals = () => {
    editModal.hidden = true;
    tripsModal.hidden = true;
    modalOverlay.hidden = true;
    modalTrigger?.focus();
    modalTrigger = null;
};

const openEditModal = (train, trigger) => {
    modalTrigger = trigger;
    editForm.dataset.trainId = train.id;
    for (const input of editForm.elements) {
        if (input.name) input.value = train[input.name] ?? '';
    }
    document.getElementById('admin-train-edit-title').textContent = `Edit ${train.name}`;
    modalOverlay.hidden = false;
    editModal.hidden = false;
    editForm.querySelector('input[name="name"]').focus();
};

const buildTripRow = (trip, train) => {
    const row = tripTemplate.content.cloneNode(true);
    const item = row.querySelector('li');
    item.dataset.tripId = trip.id;

    const link = row.querySelector('[data-field="trip-name"]');
    link.textContent = trip.name;
    link.href = `/trips/${encodeURIComponent(trip.id)}`;

    // Only trains that exist can be picked, so the API is never asked to use a fake train
    const select = row.querySelector('[data-field="move-select"]');
    state.trains
        .filter((otherTrain) => otherTrain.id !== train.id)
        .forEach((otherTrain) => {
            const option = document.createElement('option');
            option.value = otherTrain.id;
            option.textContent = otherTrain.name;
            select.appendChild(option);
        });

    if (select.options.length === 0) {
        row.querySelector('[data-action="move"]').disabled = true;
    }

    return row;
};

const buildTrainCard = (train) => {
    const card = trainTemplate.content.cloneNode(true);
    const article = card.querySelector('.train-card');
    article.dataset.trainId = train.id;
    const field = (name) => card.querySelector(`[data-field="${name}"]`);

    if (train.imageUrl) {
        field('image').src = train.imageUrl;
        field('image').alt = train.imageAlt || `${train.name} train`;
    } else {
        field('image-wrap').hidden = true;
    }

    field('name').textContent = train.name;
    field('name').href = `/trains/${encodeURIComponent(train.id)}`;
    field('operator').textContent = train.operator;
    field('id').textContent = train.id;
    field('type').textContent = train.type;
    field('speed').textContent = `${train.maxSpeedKmh} km/h`;
    field('seats').textContent = `${train.capacity} seats`;
    field('power').textContent = train.powerSource;

    const trainTrips = state.trips.filter((trip) => trip.trainId === train.id);
    field('trip-count').textContent = trainTrips.length === 0
        ? 'No trips currently assigned'
        : `${trainTrips.length} trip${trainTrips.length === 1 ? '' : 's'} currently assigned`;
    card.querySelector('[data-action="view-trips"]').textContent =
        `Manage trips (${trainTrips.length})`;

    // A train with trips can't be deleted, so don't offer a delete that the API would refuse
    if (trainTrips.length > 0) {
        card.querySelector('[data-action="delete"]').disabled = true;
        field('delete-note').textContent = `Assigned to ${trainTrips.length} trip${trainTrips.length === 1 ? '' : 's'}. Move them to delete this train.`;
    }

    return card;
};

const openTripsModal = (train, trigger = modalTrigger) => {
    modalTrigger = trigger;
    tripsModal.dataset.trainId = train.id;
    const trainTrips = state.trips.filter((trip) => trip.trainId === train.id);
    document.getElementById('admin-train-trips-title').textContent =
        `Trips assigned to ${train.name}`;
    document.getElementById('admin-train-trips-summary').textContent =
        `${trainTrips.length} trip${trainTrips.length === 1 ? '' : 's'} currently use this train.`;

    tripListEl.replaceChildren();
    if (trainTrips.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'admin-train-trips-empty';
        emptyMessage.textContent = 'No trips are currently assigned to this train.';
        tripListEl.appendChild(emptyMessage);
    } else {
        trainTrips.forEach((trip) => tripListEl.appendChild(buildTripRow(trip, train)));
    }

    modalOverlay.hidden = false;
    tripsModal.hidden = false;
    tripsModal.querySelector('[data-action="close-modal"]').focus();
};

const renderTrains = () => {
    const fragment = document.createDocumentFragment();
    state.visibleTrains.forEach((train) => fragment.appendChild(buildTrainCard(train)));
    listEl.replaceChildren(fragment);
};

const loadData = async (page = currentPage, refreshCatalog = false) => {
    try {
        loadingEl.hidden = false;
        const [trains, trips, pagePayload] = await Promise.all([
            state.catalogLoaded && !refreshCatalog
                ? state.trains
                : fetchAllTrains(),
            state.catalogLoaded && !refreshCatalog
                ? state.trips
                : fetchAllTrips(),
            fetchTrainPage(page),
        ]);
        state.trains = trains;
        state.catalogLoaded = true;
        state.visibleTrains = pagePayload.data;
        state.trips = trips;
        renderTrains();
        renderPagination(pagePayload.pagination);
        loadingEl.hidden = true;
        if (state.visibleTrains.length === 0 && page > 1 && pagePayload.pagination.totalPages > 0) {
            return loadData(pagePayload.pagination.totalPages);
        }
        return true;
    } catch (error) {
        console.error('Unable to load trains:', error);
        loadingEl.hidden = true;
        showMessage('Unable to load trains right now. Please try again in a moment.', true);
        return false;
    }
};

const createFeedback = document.getElementById('train-create-validation');
attachValidationFeedback(createForm, createFeedback, 'adding this train');
createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const train = readTrainForm(createForm, { skipEmptyOptional: true });
    const submitButton = createForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    createFeedback.hidden = true;
    try {
        // Check the id is free before sending the create request
        if (state.trains.some((existing) => existing.id === train.id)) {
            throw new Error(`A train with ID '${train.id}' already exists. Choose a different ID.`);
        }
        const existing = await fetch(
            `/api/trains/${encodeURIComponent(train.id)}`,
            { cache: 'no-store' }
        );
        if (existing.ok) {
            throw new Error(`A train with ID '${train.id}' already exists. Choose a different ID.`);
        }
        if (existing.status !== 404) {
            throw new Error(await describeError(existing));
        }

        const response = await fetch('/api/trains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(train),
        });

        if (!response.ok) {
            throw new Error(await describeError(response));
        }

        createForm.reset();
        showMessage(`${train.name} was added.`);
        await loadData(1, true);
    } catch (error) {
        createFeedback.textContent = error.message;
        createFeedback.hidden = false;
    } finally {
        submitButton.disabled = false;
    }
});

previousButton.addEventListener('click', () => {
    if (currentPagination?.hasPreviousPage) loadData(currentPage - 1);
});
nextButton.addEventListener('click', () => {
    if (currentPagination?.hasNextPage) loadData(currentPage + 1);
});
const filterForm = document.getElementById('admin-trains-filters');
filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.filters = {
        q: searchInput.value.trim(),
        type: typeFilter.value,
        powerSource: powerFilter.value,
        sort: sortField.value,
        order: sortOrder.value,
    };
    loadData(1);
});
document.getElementById('admin-trains-reset').addEventListener('click', () => {
    filterForm.reset();
    state.filters = {
        q: '',
        type: '',
        powerSource: '',
        sort: sortField.value,
        order: sortOrder.value,
    };
    loadData(1);
});

listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const article = button.closest('.train-card');
    const trainId = article.dataset.trainId;
    const train = state.trains.find((candidate) => candidate.id === trainId);

    if (button.dataset.action === 'edit') {
        openEditModal(train, button);
        return;
    }

    if (button.dataset.action === 'view-trips') {
        openTripsModal(train, button);
        return;
    }

    if (button.dataset.action === 'delete') {
        if (!await window.confirmAdminDelete({
            itemName: "train",
            identifier: train.id,
            identifierLabel: "train ID",
            description: `This permanently deletes ${train.name}. This cannot be undone.`,
        })) return;

        const response = await fetch(`/api/trains/${encodeURIComponent(trainId)}`, { method: 'DELETE' });
        if (!response.ok) {
            showMessage(await describeError(response), true);
            return;
        }

        showMessage(`${train.name} was deleted.`);
        await loadData(currentPage, true);
        return;
    }

});

tripListEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action="move"]');
    if (!button) return;

    const row = button.closest('li');
    const tripId = row.dataset.tripId;
    const newTrainId = row.querySelector('[data-field="move-select"]').value;
    const newTrain = state.trains.find((candidate) => candidate.id === newTrainId);

    if (!newTrain) {
        showMessage('Pick a train to move this trip to.', true);
        return;
    }

    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}/train`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainId: newTrainId }),
    });

    if (!response.ok) {
        showMessage(await describeError(response), true);
        return;
    }

    showMessage(`Trip moved to ${newTrain.name}.`);
    const refreshed = await loadData(currentPage, true);
    if (!refreshed) {
        closeTrainModals();
        return;
    }
    const currentTrainId = tripsModal.dataset.trainId;
    const refreshedTrain = state.trains.find((candidate) => candidate.id === currentTrainId);
    if (refreshedTrain) {
        const refreshedTrigger = listEl.querySelector(
            `.train-card[data-train-id="${CSS.escape(currentTrainId)}"] [data-action="view-trips"]`
        );
        openTripsModal(refreshedTrain, refreshedTrigger);
    } else {
        closeTrainModals();
    }
});

document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="close-modal"]')) {
        closeTrainModals();
    } else if (event.target === modalOverlay) {
        closeTrainModals();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (!editModal.hidden || !tripsModal.hidden)) {
        closeTrainModals();
    }
});

attachValidationFeedback(editForm, editFeedback, 'saving train changes');
editForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const trainId = editForm.dataset.trainId;
    const updates = readTrainForm(editForm, { skipEmptyOptional: false });
    const submitButton = editForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
        const response = await fetch(`/api/trains/${encodeURIComponent(trainId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error(await describeError(response));

        showMessage(`${updates.name} was updated.`);
        closeTrainModals();
        await loadData(currentPage, true);
    } catch (error) {
        editFeedback.textContent = error.message;
        editFeedback.hidden = false;
    } finally {
        submitButton.disabled = false;
    }
});

const initializeTrainCatalog = async () => {
    try {
        await populateFilterOptions();
    } catch (error) {
        console.error('Unable to initialize train filters:', error);
        showMessage('Train filter options could not be loaded.', true);
    }
    await loadData(1);
};

initializeTrainCatalog();
