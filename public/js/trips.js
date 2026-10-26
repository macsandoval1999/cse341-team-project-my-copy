const regionFilter = document.getElementById('region-filter');
const seasonFilter = document.getElementById('season-filter');
const availabilityFilter = document.getElementById('availability-filter');
const searchInput = document.getElementById('trip-search');
const sortField = document.getElementById('trip-sort');
const sortOrder = document.getElementById('trip-order');
let activeFilters = null;

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
        const isAvailable = trip.availability?.isAvailable !== false;
        if (!isAvailable) {
            const detailsLink = card.querySelector('.view-details-btn');
            detailsLink.textContent = 'Temporarily unavailable · View details';
            detailsLink.classList.add('view-details-unavailable');
            wrapper.classList.add('temporarily-unavailable');
        }

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

const loadTrips = async (page = 1) => {
    const tripsList = document.getElementById('trips-list');

    try {
        const params = new URLSearchParams({
            page: String(page),
            limit: '10',
            sort: activeFilters.sort,
            order: activeFilters.order,
        });
        if (activeFilters.region !== 'all') params.set('region', activeFilters.region);
        if (activeFilters.season !== 'all') params.set('season', activeFilters.season);
        if (activeFilters.availability !== 'all') {
            params.set('availability', activeFilters.availability);
        }
        if (activeFilters.search) params.set('search', activeFilters.search);
        const response = await fetch(`/api/trips?${params.toString()}`);
        if (!response.ok) throw new Error(`Trip request failed (${response.status})`);

        const { data, pagination } = await response.json();

        if (data.length === 0) {
            const empty = document.createElement('p');
            empty.textContent = 'No trips found';
            tripsList.replaceChildren(empty);
        } else {
            renderTrips(data);
        }

        renderPagination(pagination);
        document.getElementById('trips-results-count').textContent =
            pagination.totalItems === 0
                ? 'No trips to display'
                : `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.totalItems)} of ${pagination.totalItems} trips`;

    } catch (error) {
        console.error('Unable to load trips:', error);
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error';
        errorMessage.textContent = 'Failed to render trips.';
        tripsList.replaceChildren(errorMessage);
        const pagination = document.getElementById('pagination');
        pagination.replaceChildren();
        pagination.hidden = true;
    }
};

const renderPagination = ({ page, totalPages, hasPreviousPage, hasNextPage }) => {
    const nav = document.getElementById('pagination');
    const pageLinks = document.getElementById('trips-page-links');
    const previousButton = document.getElementById('trips-previous');
    const nextButton = document.getElementById('trips-next');
    nav.hidden = totalPages <= 1;
    previousButton.disabled = !hasPreviousPage;
    nextButton.disabled = !hasNextPage;
    pageLinks.replaceChildren();
    previousButton.onclick = () => loadTrips(page - 1);
    nextButton.onclick = () => loadTrips(page + 1);
    if (nav.hidden) return;

    const addButton = (targetPage, isCurrent = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(targetPage);
        btn.setAttribute('aria-label', `Page ${targetPage}`);
        if (isCurrent) btn.setAttribute('aria-current', 'page');
        btn.addEventListener('click', async () => {
            await loadTrips(targetPage);
            document.getElementById('trips-list').scrollIntoView({ behavior: 'smooth' });
        });
        pageLinks.appendChild(btn);
    };

    const visiblePages = [...new Set([
        1,
        page - 1,
        page,
        page + 1,
        totalPages,
    ])]
        .filter((number) => number >= 1 && number <= totalPages)
        .sort((left, right) => left - right);
    let previousPage = 0;
    visiblePages.forEach((pageNumber) => {
        if (pageNumber - previousPage > 1) {
            const gap = document.createElement('span');
            gap.className = 'users-page-ellipsis';
            gap.textContent = '…';
            gap.setAttribute('aria-hidden', 'true');
            pageLinks.appendChild(gap);
        }
        addButton(pageNumber, pageNumber === page);
        previousPage = pageNumber;
    });
};

const filtersForm = document.getElementById('filters');
const captureFilters = () => ({
    region: regionFilter.value,
    season: seasonFilter.value,
    availability: availabilityFilter.value,
    search: searchInput.value.trim(),
    sort: sortField.value,
    order: sortOrder.value,
});

filtersForm.addEventListener('submit', (event) => {
    event.preventDefault();
    activeFilters = captureFilters();
    loadTrips(1);
});

document.getElementById('trips-reset').addEventListener('click', () => {
    filtersForm.reset();
    activeFilters = captureFilters();
    loadTrips(1);
});

const initialQuery = new URLSearchParams(window.location.search);
searchInput.value = initialQuery.get('search') || '';
if ([...regionFilter.options].some((option) => option.value === initialQuery.get('region'))) {
    regionFilter.value = initialQuery.get('region');
}
if ([...seasonFilter.options].some((option) => option.value === initialQuery.get('season'))) {
    seasonFilter.value = initialQuery.get('season');
}
if ([...availabilityFilter.options].some((option) => option.value === initialQuery.get('availability'))) {
    availabilityFilter.value = initialQuery.get('availability');
}
if ([...sortField.options].some((option) => option.value === initialQuery.get('sort'))) {
    sortField.value = initialQuery.get('sort');
}
if ([...sortOrder.options].some((option) => option.value === initialQuery.get('order'))) {
    sortOrder.value = initialQuery.get('order');
}

activeFilters = captureFilters();
loadTrips(Number(initialQuery.get('page')) || 1);