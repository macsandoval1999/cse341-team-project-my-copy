const trainInfoEl = document.getElementById('train-info');
const trainId = trainInfoEl.dataset.trainId;

const loadTrainInfo = async () => {
    const loadingEl = document.getElementById('train-info-loading');
    const errorEl = document.getElementById('train-info-error');
    const contentEl = document.getElementById('train-info-content');

    try {
        const response = await fetch(`/api/trains/${encodeURIComponent(trainId)}`);

        // A 404 means this train doesn't exist, which is different from the server failing
        if (response.status === 404) {
            loadingEl.hidden = true;
            errorEl.hidden = false;
            errorEl.textContent = "We couldn't find a train with that ID.";
            return false;
        }

        if (!response.ok) throw new Error(`Train request failed (${response.status})`);

        const train = await response.json();
        const field = (name) => contentEl.querySelector(`[data-field="${name}"]`);

        // Hide the image area instead of showing a broken image when a train has no photo
        if (train.imageUrl) {
            field('image').src = train.imageUrl;
            field('image').alt = train.imageAlt || `${train.name} train`;
        } else {
            field('image-wrap').hidden = true;
        }

        // Same fields and formats as the cards on the /trains page
        field('name').textContent = train.name;
        field('operator').textContent = train.operator;
        field('description').textContent = train.description;
        field('type').textContent = train.type;
        field('speed').textContent = `${train.maxSpeedKmh} km/h`;
        field('seats').textContent = `${train.capacity} seats`;
        field('power').textContent = train.powerSource;
        field('best-for').textContent = train.bestFor;

        loadingEl.hidden = true;
        contentEl.hidden = false;
        return true;
    } catch (error) {
        console.error('Unable to load train:', error);
        loadingEl.hidden = true;
        errorEl.hidden = false;
        errorEl.textContent = 'Unable to load this train right now. Please try again in a moment.';
        return false;
    }
};

const renderTrainTrips = (trips) => {
    const tripsList = document.getElementById('train-trips-list');
    const template = document.getElementById('trip-card-template');
    const fragment = document.createDocumentFragment();

    trips.forEach((trip) => {
        const card = template.content.cloneNode(true);
        const wrapper = card.querySelector('.route-card');
        if (trip.region) wrapper.classList.add(trip.region);

        card.querySelector('.route-name').textContent = trip.name || '';
        card.querySelector('.route-region').textContent = trip.region || '';
        card.querySelector('.start-station').textContent = trip.startStation || '';
        card.querySelector('.end-station').textContent = trip.endStation || '';
        card.querySelector('.trip-duration').textContent = trip.duration || '';
        card.querySelector('.trip-distance').textContent = trip.distance ?? '';
        card.querySelector('.route-description').textContent = trip.description || '';

        const seasonBadge = card.querySelector('.season-badge');
        seasonBadge.textContent = trip.bestSeason ? `Best in ${trip.bestSeason}` : '';
        if (trip.bestSeason) seasonBadge.classList.add(`season-${trip.bestSeason}`);

        const highlightsList = card.querySelector('.highlights-list');
        (Array.isArray(trip.highlights) ? trip.highlights : []).forEach((highlight) => {
            const tag = document.createElement('span');
            tag.className = 'highlight-tag';
            tag.textContent = highlight;
            highlightsList.appendChild(tag);
        });

        card.querySelector('.view-details-btn').href = `/trips/${encodeURIComponent(trip.id)}`;
        fragment.appendChild(card);
    });

    tripsList.replaceChildren(fragment);
};

const loadTrainTrips = async () => {
    const loadingEl = document.getElementById('train-trips-loading');
    const errorEl = document.getElementById('train-trips-error');

    try {
        const response = await fetch(`/api/trains/${encodeURIComponent(trainId)}/trips`);
        if (!response.ok) throw new Error(`Trips request failed (${response.status})`);

        const payload = await response.json();
        renderTrainTrips(payload.trips || []);

        loadingEl.hidden = true;
    } catch (error) {
        console.error('Unable to load trips for train:', error);
        loadingEl.hidden = true;
        errorEl.hidden = false;
        errorEl.textContent = 'Unable to load trips for this train right now. Please try again in a moment.';
    }
};

// Only look up trips for a train that exists, so an unknown train shows one clear message
const initializeTrainDetails = async () => {
    const trainFound = await loadTrainInfo();

    if (trainFound) {
        loadTrainTrips();
    } else {
        // trains.css sets .trains-catalog to display: block, which overrides the hidden attribute
        document.getElementById('train-trips').style.display = 'none';
    }
};

initializeTrainDetails();
