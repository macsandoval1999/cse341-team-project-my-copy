const daysOfWeek = [
    ["monday", "Mon"],
    ["tuesday", "Tue"],
    ["wednesday", "Wed"],
    ["thursday", "Thu"],
    ["friday", "Fri"],
    ["saturday", "Sat"],
    ["sunday", "Sun"],
];

const requestJson = async (url, options) => {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok) {
        const message = Array.isArray(payload.errors)
            ? payload.errors.map((error) => error.message).join(" ")
            : payload.error || payload.message;
        throw new Error(message || `Request failed (${response.status}).`);
    }
    return payload;
};

const fetchAllPages = async (endpoint) => {
    const items = [];
    let page = 1;
    let hasNextPage = true;
    while (hasNextPage) {
        const separator = endpoint.includes("?") ? "&" : "?";
        const payload = await requestJson(
            `${endpoint}${separator}limit=50&page=${page}`
        );
        items.push(...(payload.data || []));
        hasNextPage = payload.pagination?.hasNextPage === true;
        page += 1;
    }
    return items;
};

const tripNames = new Map();
let currentPage = 1;

const showMessage = (message, isError = false) => {
    const element = document.getElementById("schedule-admin-message");
    element.textContent = message;
    element.classList.toggle("is-error", isError);
    element.hidden = false;
};

const describeInvalidControl = (control) => {
    const label = control.labels?.[0];
    const fieldName = label?.querySelector("span")?.textContent.trim() ||
        label?.textContent.trim() ||
        control.name ||
        "Required field";
    return control.validity.valueMissing
        ? `${fieldName} is required`
        : `${fieldName}: ${control.validationMessage}`;
};

const attachValidationFeedback = (form, action, onInvalid) => {
    form.addEventListener("invalid", () => {
        window.setTimeout(() => {
            const invalidControls = Array.from(form.querySelectorAll(":invalid"));
            onInvalid(
                `Complete the following before ${action}: ${invalidControls.map(describeInvalidControl).join("; ")}.`
            );
        }, 0);
    }, true);
};

const populateTripOptions = (trips) => {
    const createSelect = document.getElementById("schedule-create-trip");
    const filterSelect = document.getElementById("schedule-trip-filter");
    createSelect.replaceChildren(new Option("Select a trip", ""));
    filterSelect.replaceChildren(new Option("All trips", ""));
    trips.forEach((trip) => {
        tripNames.set(trip.id, trip.name);
        createSelect.add(new Option(`${trip.name} (${trip.id})`, trip.id));
        filterSelect.add(new Option(`${trip.name} (${trip.id})`, trip.id));
    });
};

const renderMissingTrips = (trips) => {
    const list = document.getElementById("missing-trips-list");
    const state = document.getElementById("missing-trips-state");
    const count = document.getElementById("missing-trip-count");
    count.textContent = `${trips.length} trip${trips.length === 1 ? "" : "s"}`;
    list.replaceChildren();

    if (trips.length === 0) {
        state.textContent = "Every trip has at least one schedule record.";
        state.hidden = false;
        return;
    }

    state.hidden = true;
    const table = document.createElement("table");
    table.className = "schedule-missing-table";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Trip", "Trip ID", "Action"].forEach((label) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headerRow.appendChild(cell);
    });
    head.appendChild(headerRow);
    const body = document.createElement("tbody");

    trips.forEach((trip) => {
        const row = document.createElement("tr");
        const name = document.createElement("th");
        name.scope = "row";
        name.textContent = trip.name;
        const id = document.createElement("td");
        id.textContent = trip.id;
        const actionCell = document.createElement("td");
        const action = document.createElement("button");
        action.type = "button";
        action.textContent = "Create schedule";
        action.addEventListener("click", () => {
            const form = document.getElementById("schedule-create-form");
            document.getElementById("schedule-create-trip").value = trip.id;
            form.closest("details").open = true;
            form.scrollIntoView({ behavior: "smooth", block: "center" });
            form.querySelector('[name="departureTime"]').focus();
        });
        actionCell.appendChild(action);
        row.append(name, id, actionCell);
        body.appendChild(row);
    });

    table.append(head, body);
    list.appendChild(table);
};

const addWeekdayInputs = (container, selectedDays) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "schedule-days schedule-card-days";
    const legend = document.createElement("legend");
    legend.textContent = "Operating days";
    fieldset.appendChild(legend);
    daysOfWeek.forEach(([day, label]) => {
        const dayLabel = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = day;
        checkbox.checked = selectedDays.includes(day);
        dayLabel.append(checkbox, document.createTextNode(label));
        fieldset.appendChild(dayLabel);
    });
    container.appendChild(fieldset);
};

const renderSchedule = (schedule) => {
    const card = document.createElement("article");
    card.className = "schedule-admin-card";
    card.dataset.scheduleId = String(schedule.id);

    const heading = document.createElement("header");
    heading.className = "schedule-card-heading";
    const title = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = tripNames.get(schedule.tripId) || schedule.tripId;
    const details = document.createElement("p");
    details.textContent = `Schedule ${schedule.id} · ${schedule.tripId}`;
    title.append(name, details);
    const tripLink = document.createElement("a");
    tripLink.href = `/trips/${encodeURIComponent(schedule.tripId)}`;
    tripLink.textContent = "View trip";
    heading.append(title, tripLink);
    card.appendChild(heading);

    if (schedule.hasBookings) {
        const usageNotice = document.createElement("p");
        usageNotice.className = "schedule-use-notice";
        usageNotice.setAttribute("role", "status");
        usageNotice.textContent =
            "Currently in use by existing bookings. Departure times and operating days are locked; you can still inactivate this schedule.";
        card.appendChild(usageNotice);
    }

    const summary = document.createElement("dl");
    summary.className = "schedule-card-summary";
    const addSummaryItem = (label, value) => {
        const item = document.createElement("div");
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        description.textContent = value;
        item.append(term, description);
        summary.appendChild(item);
    };
    addSummaryItem("Departure", schedule.departureTime);
    addSummaryItem("Arrival", schedule.arrivalTime);
    addSummaryItem(
        "Operating days",
        (schedule.daysOfWeek || [])
            .map((day) => daysOfWeek.find(([value]) => value === day)?.[1] || day)
            .join(", ")
    );
    addSummaryItem("Status", schedule.status ? "Active for booking" : "Inactive");
    if (schedule.hasBookings) addSummaryItem("Bookings", "In use");
    card.appendChild(summary);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "schedule-edit-toggle";
    edit.textContent = schedule.hasBookings ? "Manage status" : "Edit schedule";
    edit.setAttribute("aria-expanded", "false");
    card.appendChild(edit);

    const editor = document.createElement("div");
    editor.className = "schedule-card-editor";
    editor.hidden = true;

    const departureLabel = document.createElement("label");
    departureLabel.append(document.createTextNode("Departure"));
    const departure = document.createElement("input");
    departure.type = "time";
    departure.required = true;
    departure.value = schedule.departureTime;
    departure.disabled = schedule.hasBookings;
    departureLabel.appendChild(departure);

    const arrivalLabel = document.createElement("label");
    arrivalLabel.append(document.createTextNode("Arrival"));
    const arrival = document.createElement("input");
    arrival.type = "time";
    arrival.required = true;
    arrival.value = schedule.arrivalTime;
    arrival.disabled = schedule.hasBookings;
    arrivalLabel.appendChild(arrival);
    editor.append(departureLabel, arrivalLabel);

    addWeekdayInputs(editor, schedule.daysOfWeek || []);
    if (schedule.hasBookings) {
        const daysFieldset = editor.querySelector(".schedule-card-days");
        daysFieldset.disabled = true;
        daysFieldset.setAttribute("aria-label", "Operating days (locked because bookings exist)");
        daysFieldset.classList.add("is-locked");
        editor.querySelectorAll(".schedule-card-days input").forEach((input) => {
            input.disabled = true;
        });
    }

    const statusLabel = document.createElement("label");
    statusLabel.className = "schedule-status-select";
    statusLabel.append(document.createTextNode("Status"));
    const status = document.createElement("select");
    status.add(new Option("Active for booking", "true"));
    status.add(new Option("Inactive", "false"));
    status.value = String(schedule.status);
    statusLabel.appendChild(status);
    editor.appendChild(statusLabel);

    const save = document.createElement("button");
    save.type = "button";
    save.textContent = schedule.hasBookings ? "Save status" : "Save schedule";
    save.addEventListener("click", async () => {
        let updates = { status: status.value === "true" };
        if (!schedule.hasBookings) {
            if (!departure.reportValidity() || !arrival.reportValidity()) {
                showMessage("Enter valid departure and arrival times before saving.", true);
                return;
            }
            const selectedDays = Array.from(
                editor.querySelectorAll(".schedule-card-days input:checked")
            ).map((input) => input.value);
            if (selectedDays.length === 0) {
                showMessage("Select at least one operating day.", true);
                return;
            }
            updates = {
                ...updates,
                departureTime: departure.value,
                arrivalTime: arrival.value,
                daysOfWeek: selectedDays,
            };
        }
        save.disabled = true;
        try {
            await requestJson(`/api/schedules/${schedule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            showMessage(`Schedule ${schedule.id} was updated.`);
            await Promise.all([loadSchedules(), loadMissingTrips()]);
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            save.disabled = false;
        }
    });
    editor.appendChild(save);

    const warning = document.createElement("p");
    warning.dataset.field = "booking-warning";
    warning.textContent = schedule.hasBookings
        ? "Departure and operating-day fields are read-only while existing bookings reference this schedule."
        : "Schedules with bookings cannot have their departure times or operating days changed.";
    editor.appendChild(warning);
    card.appendChild(editor);

    edit.addEventListener("click", () => {
        editor.hidden = !editor.hidden;
        edit.setAttribute("aria-expanded", String(!editor.hidden));
        edit.textContent = editor.hidden
            ? schedule.hasBookings ? "Manage status" : "Edit schedule"
            : "Close editor";
    });
    return card;
};

const buildScheduleParams = (page) => {
    const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sort: document.getElementById("schedule-sort").value,
        order: document.getElementById("schedule-order").value,
    });
    const q = document.getElementById("schedule-search").value.trim();
    const tripId = document.getElementById("schedule-trip-filter").value;
    const day = document.getElementById("schedule-day-filter").value;
    const status = document.getElementById("schedule-status-filter").value;
    if (q) params.set("q", q);
    if (tripId) params.set("tripId", tripId);
    if (day) params.set("day", day);
    if (status) params.set("status", status);
    return params;
};

const renderPagination = (pagination) => {
    const nav = document.getElementById("schedule-pagination");
    const previous = document.getElementById("schedule-previous");
    const next = document.getElementById("schedule-next");
    const pageLinks = document.getElementById("schedule-page-links");
    nav.hidden = pagination.totalPages <= 1;
    previous.disabled = !pagination.hasPreviousPage;
    next.disabled = !pagination.hasNextPage;
    pageLinks.replaceChildren();
    previous.onclick = () => loadSchedules(pagination.page - 1);
    next.onclick = () => loadSchedules(pagination.page + 1);

    if (nav.hidden) return;
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
            const ellipsis = document.createElement("span");
            ellipsis.className = "users-page-ellipsis";
            ellipsis.textContent = "…";
            ellipsis.setAttribute("aria-hidden", "true");
            pageLinks.appendChild(ellipsis);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(page);
        button.setAttribute("aria-label", `Page ${page}`);
        if (page === pagination.page) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => loadSchedules(page));
        pageLinks.appendChild(button);
        previousPage = page;
    });
};

const loadSchedules = async (page = currentPage) => {
    const state = document.getElementById("schedule-list-state");
    const list = document.getElementById("schedule-list");
    state.textContent = "Loading schedules…";
    state.hidden = false;
    try {
        const payload = await requestJson(
            `/api/admin/schedules?${buildScheduleParams(page).toString()}`
        );
        currentPage = payload.pagination.page;
        list.replaceChildren(...payload.data.map(renderSchedule));
        document.getElementById("schedule-results-count").textContent =
            payload.pagination.totalItems === 0
                ? "No schedules match these filters."
                : `Showing ${(currentPage - 1) * payload.pagination.limit + 1}-${Math.min(currentPage * payload.pagination.limit, payload.pagination.totalItems)} of ${payload.pagination.totalItems} schedules`;
        state.textContent = payload.data.length === 0 ? "No schedules found." : "";
        state.hidden = payload.data.length !== 0;
        renderPagination(payload.pagination);
    } catch (error) {
        state.textContent = error.message;
        state.hidden = false;
        list.replaceChildren();
        document.getElementById("schedule-pagination").hidden = true;
    }
};

const loadMissingTrips = async () => {
    const state = document.getElementById("missing-trips-state");
    state.textContent = "Checking trip schedule coverage…";
    state.hidden = false;
    try {
        const trips = await fetchAllPages(
            "/api/trips?scheduleStatus=none&sort=name&order=asc"
        );
        renderMissingTrips(trips);
    } catch (error) {
        state.textContent = `Unable to load trip coverage: ${error.message}`;
        state.hidden = false;
    }
};

const initializeSchedulesAdmin = async () => {
    const form = document.getElementById("schedule-create-form");
    const submit = form.querySelector('[type="submit"]');
    const daysFieldset = form.querySelector(".schedule-days");
    const daysError = document.getElementById("schedule-create-days-error");
    attachValidationFeedback(form, "adding this schedule", (message) => {
        showMessage(message, true);
    });
    const clearDaysError = () => {
        daysError.hidden = true;
        daysFieldset.classList.remove("has-validation-error");
        daysFieldset.removeAttribute("aria-invalid");
    };
    daysFieldset.addEventListener("change", clearDaysError);
    form.addEventListener("reset", clearDaysError);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const tripId = formData.get("tripId");
        const selectedDays = formData.getAll("daysOfWeek");
        if (selectedDays.length === 0) {
            daysError.textContent = "Select at least one operating day to add this schedule.";
            daysError.hidden = false;
            daysFieldset.classList.add("has-validation-error");
            daysFieldset.setAttribute("aria-invalid", "true");
            showMessage("This schedule needs at least one operating day.", true);
            daysFieldset.querySelector("input").focus();
            return;
        }
        clearDaysError();
        submit.disabled = true;
        try {
            const schedule = await requestJson(
                `/api/trips/${encodeURIComponent(tripId)}/schedules`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        departureTime: formData.get("departureTime"),
                        arrivalTime: formData.get("arrivalTime"),
                        daysOfWeek: selectedDays,
                        status: formData.get("status") === "on",
                    }),
                }
            );
            showMessage(`Schedule ${schedule.id} was added to ${tripNames.get(tripId) || tripId}.`);
            form.reset();
            await Promise.all([loadSchedules(1), loadMissingTrips()]);
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            submit.disabled = false;
        }
    });
    try {
        const trips = await fetchAllPages("/api/trips?sort=name&order=asc");
        populateTripOptions(trips);
        submit.disabled = false;
    } catch (error) {
        showMessage(`Unable to load trips: ${error.message}`, true);
        document.getElementById("schedule-create-trip").replaceChildren(
            new Option("Trips could not be loaded", "")
        );
        submit.disabled = true;
    }
    await Promise.all([loadSchedules(1), loadMissingTrips()]);

    document.getElementById("schedule-filters").addEventListener("submit", (event) => {
        event.preventDefault();
        loadSchedules(1);
    });
    document.getElementById("schedule-reset").addEventListener("click", () => {
        document.getElementById("schedule-filters").reset();
        loadSchedules(1);
    });
};

document.addEventListener("DOMContentLoaded", initializeSchedulesAdmin);
