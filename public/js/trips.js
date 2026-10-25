const regionFilter = document.getElementById('region-filter');
const seasonFilter = document.getElementById('season-filter');
const normalizeFilterValue = (value) => String(value || '').trim().toLowerCase();

/*
const populateFilterOptions = (select, values, label) => {
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = label;
    select.replaceChildren(defaultOption);

    [...new Set(values.map(normalizeFilterValue).filter(Boolean))].sort().forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
        select.appendChild(option);
    });
};
*/

const renderTrips = (trips) => {
    const tripsList = document.getElementById('trips-list');
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

/*
const applyFilters = () => {
    const cards = document.querySelectorAll('#trips-list .route-card');
    const selectedRegion = normalizeFilterValue(regionFilter.value);
    const selectedSeason = normalizeFilterValue(seasonFilter.value);
    let visibleCount = 0;

    cards.forEach((card) => {
        const cardRegion = normalizeFilterValue(card.querySelector('.route-region').textContent);
        const bestSeason = normalizeFilterValue(card.querySelector('.season-badge').textContent);
        const matchesRegion = selectedRegion === 'all' || cardRegion === selectedRegion;
        const matchesSeason = selectedSeason === 'all' || bestSeason.includes(selectedSeason);
        card.hidden = !(matchesRegion && matchesSeason);
        if (!card.hidden) visibleCount += 1;
    });

    document.getElementById('trips-empty')?.remove();
    if (cards.length > 0 && visibleCount === 0) {
        const emptyState = document.createElement('p');
        emptyState.id = 'trips-empty';
        emptyState.className = 'trips-empty';
        emptyState.textContent = 'No trips match the selected filters.';
        document.getElementById('trips-list').appendChild(emptyState);
    }
};

*/

const loadTrips = async (page = 1) => {
    const tripsList = document.getElementById('trips-list');

    try {
        const params = new URLSearchParams({
            page,
            region: regionFilter.value,
            season: seasonFilter.value
        });
        const response = await fetch(`/api/trips?${params}`);
        if (!response.ok) throw new Error(`Trip request failed (${response.status})`);

        /*
        const payload = await response.json();
        const trips = Array.isArray(payload) ? payload : payload.data || payload.trips || [];
        populateFilterOptions(regionFilter, trips.map((trip) => trip.region), 'All Regions');
        populateFilterOptions(seasonFilter, trips.map((trip) => trip.bestSeason), 'Any Season');
        renderTrips(trips);

        const query = new URLSearchParams(window.location.search);
        const queryRegion = normalizeFilterValue(query.get('region'));
        const querySeason = normalizeFilterValue(query.get('season'));
        if ([...regionFilter.options].some((option) => option.value === queryRegion)) {
            regionFilter.value = queryRegion;
        }
        if ([...seasonFilter.options].some((option) => option.value === querySeason)) {
            seasonFilter.value = querySeason;
        }
        applyFilters();
    } catch (error) {
        console.error('Unable to load trips:', error);
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error';
        errorMessage.textContent = 'Failed to render trips.';
        tripsList.replaceChildren(errorMessage);
    }

    */

        const { data, pagination } = await response.json();

        if (data.length === 0) {
            const empty = document.createElement('p');
            empty.textContent = 'No trips found';
            tripsList.replaceChildren(empty);
        }else {
            renderTrips(data);
        }

        renderPagination(pagination);

    }catch (error) {
        console.error('Unable to load trips:', error);
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error';
        errorMessage.textContent = 'Failed to render trips.';
        tripsList.replaceChildren(errorMessage);
        document.getElementById('pagination').replaceChildren();
    }
};

// Builds [1, '...', 4, 5, 6, '...', 20]
const getPageItems = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages = [...new Set([1, total, current - 1, current, current + 1])]
        .filter((p) => p >= 1 && p <= total)
        .sort((a, b) => a - b);

    const items = [];
    pages.forEach((p, i) => {
        if (i > 0 && p - pages[i - 1] > 1) items.push('...');
        items.push(p);
    });
    return items;
};

const renderPagination = ({ page, totalPages, hasPreviousPage, hasNextPage }) => {
    const nav = document.getElementById('pagination');
    nav.replaceChildren();
    if (totalPages <= 1) return;

    const addButton = (label, targetPage, disabled = false, isCurrent = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.disabled = disabled;
        if (isCurrent) btn.setAttribute('aria-current', 'page');
        btn.addEventListener('click', async () => {
            await loadTrips(targetPage);
            document.getElementById('trips-list').scrollIntoView({ behavior: 'smooth' });
        });
        nav.appendChild(btn);
    };

    addButton('Previous', page - 1, !hasPreviousPage);
    getPageItems(page, totalPages).forEach((item) => {
        if (item === '...') {
            const gap = document.createElement('span');
            gap.textContent = '…';
            nav.appendChild(gap);
        } else {
            addButton(String(item), item, item === page, item === page);
        }
    });
    addButton('Next', page + 1, !hasNextPage);
};

/*
regionFilter.addEventListener('change', applyFilters);
seasonFilter.addEventListener('change', applyFilters);
*/

// Filters are applied by the API, so changing one returns to page 1.
regionFilter.addEventListener('change', () => loadTrips(1));
seasonFilter.addEventListener('change', () => loadTrips(1));

loadTrips();