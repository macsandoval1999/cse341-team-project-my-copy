const isAdmin = window.stationPageConfig.isAdmin;
const stationList = document.getElementById("station-list");
const stationTemplate = document.getElementById("station-card-template");
const stateMessage = document.getElementById("station-state");
const resultCount = document.getElementById("station-results-count");
const filterForm = document.getElementById("station-filters");
const searchInput = document.getElementById("station-search");
const regionSelect = document.getElementById("station-region");
const prefectureSelect = document.getElementById("station-prefecture");
const facilitySelect = document.getElementById("station-facility");
const sortSelect = document.getElementById("station-sort");
const orderSelect = document.getElementById("station-order");
const pagination = document.getElementById("station-pagination");
const pageLinks = document.getElementById("station-page-links");
const previousButton = document.getElementById("station-previous");
const nextButton = document.getElementById("station-next");
const pageState = {
    filters: { q: "", region: "", prefecture: "", facility: "", sort: "name", order: "asc" },
    page: 1,
    pagination: null,
};

const readError = async (response) => {
    try {
        const body = await response.json();
        if (Array.isArray(body.errors)) {
            return body.errors.map((error) => error.message).join(" ");
        }
        return body.error || body.message || `Request failed (${response.status})`;
    } catch {
        return `Request failed (${response.status})`;
    }
};

const setStateMessage = (message, isError = false) => {
    stateMessage.textContent = message;
    stateMessage.classList.toggle("station-error", isError);
    stateMessage.hidden = !message;
};

const addOptions = (select, values) => {
    while (select.options.length > 1) {
        select.remove(1);
    }
    values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value.replaceAll("_", " ");
        select.appendChild(option);
    });
};

const loadFilterOptions = async () => {
    const response = await fetch("/api/stations/filters", { cache: "no-store" });
    if (!response.ok) {
        throw new Error(await readError(response));
    }
    const options = await response.json();
    addOptions(regionSelect, options.regions);
    addOptions(prefectureSelect, options.prefectures);
    addOptions(facilitySelect, options.facilities);
};

const makePagination = (data) => {
    pageState.page = data.page;
    pageState.pagination = data;
    pagination.hidden = data.totalPages <= 1;
    previousButton.disabled = !data.hasPreviousPage;
    nextButton.disabled = !data.hasNextPage;
    pageLinks.replaceChildren();
    const pages = [...new Set([1, data.page - 1, data.page, data.page + 1, data.totalPages])]
        .filter((page) => page >= 1 && page <= data.totalPages)
        .sort((left, right) => left - right);

    pages.forEach((pageNumber) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(pageNumber);
        button.setAttribute("aria-label", `Page ${pageNumber}`);
        button.setAttribute("aria-current", pageNumber === data.page ? "page" : "false");
        button.disabled = pageNumber === data.page;
        button.addEventListener("click", () => loadStations(pageNumber));
        pageLinks.appendChild(button);
    });
};

const createStationCard = (station) => {
    const fragment = stationTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".station-card");
    card.dataset.stationId = station.id;
    card.querySelector('[data-field="name"]').textContent = station.name;
    card.querySelector('[data-field="location"]').textContent =
        [station.prefecture, `ID: ${station.id}`].filter(Boolean).join(" · ");
    card.querySelector('[data-field="region"]').textContent = station.region || "Region not set";
    card.querySelector('[data-field="description"]').textContent =
        station.description || "No station description has been added.";

    const facilityList = card.querySelector('[data-field="facilities"]');
    const facilities = Array.isArray(station.facilities) ? station.facilities : [];
    if (facilities.length === 0) {
        const empty = document.createElement("span");
        empty.className = "station-no-facilities";
        empty.textContent = "No facilities listed";
        facilityList.appendChild(empty);
    } else {
        facilities.forEach((facility) => {
            const badge = document.createElement("span");
            badge.className = "station-facility";
            badge.textContent = facility.replaceAll("_", " ");
            facilityList.appendChild(badge);
        });
    }

    if (isAdmin) {
        const inUse = station.inUse === true;
        const useNotice = card.querySelector('[data-field="use-notice"]');
        const actionFeedback = card.querySelector('[data-field="action-feedback"]');
        card.dataset.inUse = String(inUse);
        useNotice.hidden = !inUse;
        actionFeedback.textContent = "";
        card.querySelector('[data-action="edit"]').disabled = inUse;
        card.querySelector('[data-action="delete"]').disabled = inUse;
        card.querySelector('[data-field="id"]').value = station.id;
        card.querySelector('[data-field="name-input"]').value = station.name;
        card.querySelector('[data-field="prefecture-input"]').value = station.prefecture || "";
        card.querySelector('[data-field="region-input"]').value = station.region || "";
        card.querySelector('[data-field="facilities-input"]').value = facilities.join(", ");
        card.querySelector('[data-field="description-input"]').value = station.description || "";
    }
    return fragment;
};

async function loadStations(page = 1) {
    setStateMessage("Loading stations...");
    resultCount.textContent = "";
    const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sort: pageState.filters.sort,
        order: pageState.filters.order,
    });
    for (const [field, value] of Object.entries(pageState.filters)) {
        if (value && field !== "sort" && field !== "order") {
            params.set(field, value);
        }
    }

    try {
        const endpoint = isAdmin ? "/api/admin/stations" : "/api/stations";
        const response = await fetch(`${endpoint}?${params}`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(await readError(response));
        }
        const payload = await response.json();
        const fragment = document.createDocumentFragment();
        payload.data.forEach((station) => fragment.appendChild(createStationCard(station)));
        stationList.replaceChildren(fragment);
        makePagination(payload.pagination);
        const { totalItems, page: currentPage, limit } = payload.pagination;
        const first = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
        const last = Math.min(currentPage * limit, totalItems);
        resultCount.textContent = `Showing ${first}-${last} of ${totalItems} stations`;
        setStateMessage(payload.data.length === 0 ? "No stations match these filters." : "");
    } catch (error) {
        console.error("Unable to load stations:", error);
        stationList.replaceChildren();
        pagination.hidden = true;
        setStateMessage("Unable to load stations right now. Please try again.", true);
    }
}

const readForm = (form) => {
    const fields = new FormData(form);
    const station = {};
    for (const name of ["id", "name", "prefecture", "region", "description"]) {
        if (fields.has(name)) {
            const value = fields.get(name).trim();
            if (value || name === "id" || name === "name") station[name] = value;
        }
    }
    const facilitiesValue = fields.get("facilities");
    station.facilities = facilitiesValue
        ? facilitiesValue.split(",").map((facility) => facility.trim()).filter(Boolean)
        : [];
    return station;
};

const showFormFeedback = (element, message) => {
    element.textContent = message;
    element.hidden = false;
};

const createForm = document.getElementById("station-create-form");
if (createForm) {
    const feedback = document.getElementById("station-create-feedback");
    createForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!createForm.reportValidity()) return;
        const submitButton = createForm.querySelector('[type="submit"]');
        submitButton.disabled = true;
        feedback.hidden = true;
        try {
            const response = await fetch("/api/stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(readForm(createForm)),
            });
            if (!response.ok) throw new Error(await readError(response));
            createForm.reset();
            await loadFilterOptions();
            await loadStations(1);
        } catch (error) {
            showFormFeedback(feedback, error.message);
        } finally {
            submitButton.disabled = false;
        }
    });
}

filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    pageState.filters = {
        q: searchInput.value.trim(),
        region: regionSelect.value,
        prefecture: prefectureSelect.value,
        facility: facilitySelect.value,
        sort: sortSelect.value,
        order: orderSelect.value,
    };
    loadStations(1);
});

document.getElementById("station-reset").addEventListener("click", () => {
    filterForm.reset();
    pageState.filters = { q: "", region: "", prefecture: "", facility: "", sort: "name", order: "asc" };
    loadStations(1);
});
previousButton.addEventListener("click", () => {
    if (pageState.pagination?.hasPreviousPage) loadStations(pageState.page - 1);
});
nextButton.addEventListener("click", () => {
    if (pageState.pagination?.hasNextPage) loadStations(pageState.page + 1);
});

if (isAdmin) {
    stationList.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const card = button.closest(".station-card");
        const form = card.querySelector(".station-edit-form");
        if (button.dataset.action === "edit") {
            if (card.dataset.inUse === "true") return;
            form.hidden = false;
            form.querySelector('[data-field="name-input"]').focus();
            return;
        }
        if (button.dataset.action === "cancel") {
            form.hidden = true;
            return;
        }
        if (button.dataset.action === "delete") {
            if (card.dataset.inUse === "true") return;
            const stationName = card.querySelector('[data-field="name"]').textContent;
            const stationId = card.dataset.stationId;
            if (!await window.confirmAdminDelete({
                itemName: "station",
                identifier: stationId,
                identifierLabel: "station ID",
                description: `This permanently deletes ${stationName}. This action cannot be undone.`,
            })) return;
            button.disabled = true;
            try {
                const response = await fetch(`/api/stations/${encodeURIComponent(stationId)}`, {
                    method: "DELETE",
                });
                if (!response.ok) throw new Error(await readError(response));
                await loadStations(pageState.page);
            } catch (error) {
                const feedback = card.querySelector('[data-field="action-feedback"]');
                showFormFeedback(feedback, error.message);
                button.disabled = false;
            }
        }
    });

    stationList.addEventListener("submit", async (event) => {
        const form = event.target.closest(".station-edit-form");
        if (!form) return;
        event.preventDefault();
        const card = form.closest(".station-card");
        if (card.dataset.inUse === "true") return;
        if (!form.reportValidity()) return;
        const station = readForm(form);
        delete station.id;
        const feedback = form.querySelector(".station-edit-feedback");
        const submitButton = form.querySelector('[type="submit"]');
        submitButton.disabled = true;
        feedback.hidden = true;
        try {
            const response = await fetch(
                `/api/stations/${encodeURIComponent(card.dataset.stationId)}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(station),
                }
            );
            if (!response.ok) throw new Error(await readError(response));
            await loadStations(pageState.page);
        } catch (error) {
            showFormFeedback(feedback, error.message);
        } finally {
            submitButton.disabled = false;
        }
    });
}

const initializeStationPage = async () => {
    try {
        await Promise.all([loadFilterOptions(), loadStations()]);
    } catch (error) {
        console.error("Unable to initialize stations page:", error);
        setStateMessage("Unable to load station filters. Please reload the page.", true);
    }
};

initializeStationPage();
