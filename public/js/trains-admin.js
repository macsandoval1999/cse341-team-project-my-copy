const listEl = document.getElementById('admin-trains-list');
const loadingEl = document.getElementById('admin-trains-loading');
const messageEl = document.getElementById('admin-trains-message');
const createForm = document.getElementById('train-create-form');
const trainTemplate = document.getElementById('admin-train-template');
const tripTemplate = document.getElementById('admin-train-trip-template');

const numberFields = ['maxSpeedKmh', 'capacity'];
const optionalFields = ['imageUrl', 'imageAlt', 'bestFor', 'description'];

// The latest data from the API. Every change reloads it, so the page always matches the database.
const state = { trains: [], trips: [] };

const showMessage = (text, isError = false) => {
    messageEl.textContent = text;
    messageEl.classList.toggle('trains-error', isError);
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
    const response = await fetch('/api/trips', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load trips (${response.status})`);

    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload.data || [];
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
    field('no-trips').hidden = trainTrips.length > 0;
    trainTrips.forEach((trip) => field('trips').appendChild(buildTripRow(trip, train)));

    // A train with trips can't be deleted, so don't offer a delete that the API would refuse
    if (trainTrips.length > 0) {
        card.querySelector('[data-action="delete"]').disabled = true;
        field('delete-note').textContent = `Assigned to ${trainTrips.length} trip${trainTrips.length === 1 ? '' : 's'}. Move them to delete this train.`;
    }

    // Fill the edit form with the current values
    const editForm = field('edit-form');
    for (const input of editForm.elements) {
        if (input.name) {
            input.value = train[input.name] ?? '';
        }
    }

    return card;
};

const renderTrains = () => {
    const fragment = document.createDocumentFragment();
    state.trains.forEach((train) => fragment.appendChild(buildTrainCard(train)));
    listEl.replaceChildren(fragment);
};

const loadData = async () => {
    try {
        const [trains, trips] = await Promise.all([fetchAllTrains(), fetchAllTrips()]);
        state.trains = trains;
        state.trips = trips;
        renderTrains();
        loadingEl.hidden = true;
    } catch (error) {
        console.error('Unable to load trains:', error);
        loadingEl.hidden = true;
        showMessage('Unable to load trains right now. Please try again in a moment.', true);
    }
};

createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const train = readTrainForm(createForm, { skipEmptyOptional: true });

    // Check the id is free before sending the create request
    if (state.trains.some((existing) => existing.id === train.id)) {
        showMessage(`A train with id '${train.id}' already exists.`, true);
        return;
    }
    const existing = await fetch(`/api/trains/${encodeURIComponent(train.id)}`, { cache: 'no-store' });
    if (existing.ok) {
        showMessage(`A train with id '${train.id}' already exists.`, true);
        return;
    }

    const response = await fetch('/api/trains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(train),
    });

    if (!response.ok) {
        showMessage(await describeError(response), true);
        return;
    }

    createForm.reset();
    showMessage(`${train.name} was added.`);
    await loadData();
});

listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const article = button.closest('.train-card');
    const trainId = article.dataset.trainId;
    const train = state.trains.find((candidate) => candidate.id === trainId);
    const editForm = article.querySelector('[data-field="edit-form"]');

    if (button.dataset.action === 'edit') {
        editForm.hidden = false;
        editForm.querySelector('input').focus();
        return;
    }

    if (button.dataset.action === 'cancel-edit') {
        editForm.hidden = true;
        return;
    }

    if (button.dataset.action === 'delete') {
        if (!confirm(`Delete ${train.name}? This can't be undone.`)) return;

        const response = await fetch(`/api/trains/${encodeURIComponent(trainId)}`, { method: 'DELETE' });
        if (!response.ok) {
            showMessage(await describeError(response), true);
            return;
        }

        showMessage(`${train.name} was deleted.`);
        await loadData();
        return;
    }

    if (button.dataset.action === 'move') {
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
        await loadData();
    }
});

listEl.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-field="edit-form"]')) return;
    event.preventDefault();

    const article = event.target.closest('.train-card');
    const trainId = article.dataset.trainId;
    const updates = readTrainForm(event.target, { skipEmptyOptional: false });

    const response = await fetch(`/api/trains/${encodeURIComponent(trainId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        showMessage(await describeError(response), true);
        return;
    }

    showMessage(`${updates.name} was updated.`);
    await loadData();
});

loadData();
