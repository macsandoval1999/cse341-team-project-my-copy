const createScheduleCard = (schedule) => {
    const card = document.createElement("div");
    card.className = "schedule-card";

    const times = document.createElement("div");
    times.className = "schedule-times";

    const createTimeBlock = (label, value) => {
        const block = document.createElement("div");
        block.className = "time-block";
        const timeLabel = document.createElement("span");
        timeLabel.className = "time-label";
        timeLabel.textContent = label;
        const timeValue = document.createElement("span");
        timeValue.className = "time-value";
        timeValue.textContent = value ?? "";
        block.append(timeLabel, timeValue);
        return block;
    };

    const arrow = document.createElement("span");
    arrow.className = "time-arrow";
    arrow.textContent = "→";
    times.append(
        createTimeBlock("Departs", schedule.departureTime),
        arrow,
        createTimeBlock("Arrives", schedule.arrivalTime)
    );

    const days = document.createElement("div");
    days.className = "schedule-days";
    (schedule.daysOfWeek || []).forEach((day) => {
        const badge = document.createElement("span");
        badge.className = "day-badge";
        badge.textContent = String(day).slice(0, 3);
        days.appendChild(badge);
    });

    const bookingLink = document.createElement("a");
    bookingLink.href = `/trips/booking/${encodeURIComponent(schedule.id)}`;
    bookingLink.className = "book-btn";
    bookingLink.textContent = "Book Now";
    card.append(times, days, bookingLink);

    return card;
};

const loadSchedules = async (
    tripId,
    monthSelect,
    scheduleGrid,
    scheduleStatus
) => {
    const selectedMonth = monthSelect.value;
    const endpoint = selectedMonth
        ? `/api/trips/${tripId}/schedules?month=${selectedMonth}`
        : `/api/trips/${tripId}/schedules`;

    scheduleStatus.textContent = "Loading schedules...";
    scheduleGrid.replaceChildren();

    try {
        const response = await fetch(endpoint);

        if (response.status === 404 && selectedMonth) {
            scheduleStatus.textContent =
                "No schedules are available for the selected month.";
            return;
        }

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const schedules = await response.json();

        if (!Array.isArray(schedules) || schedules.length === 0) {
            scheduleStatus.textContent =
                "No schedules are available for the selected month.";
            return;
        }

        scheduleStatus.textContent = "";
        schedules.forEach((schedule) => {
            scheduleGrid.appendChild(createScheduleCard(schedule));
        });
    } catch (error) {
        console.error("Failed to load schedules:", error);
        scheduleStatus.textContent = "Unable to load schedules right now.";
    }
};

const initializeScheduleList = () => {
    const details = document.querySelector(".route-detail");
    const monthSelect = document.getElementById("monthSelect");
    const scheduleGrid = document.getElementById("scheduleGrid");
    const scheduleStatus = document.getElementById("scheduleStatus");

    if (!details || !monthSelect || !scheduleGrid || !scheduleStatus) {
        return;
    }

    const tripId = details.dataset.tripId;
    monthSelect.addEventListener("change", () => {
        loadSchedules(tripId, monthSelect, scheduleGrid, scheduleStatus);
    });
    loadSchedules(tripId, monthSelect, scheduleGrid, scheduleStatus);
};

const renderStationInfo = (station, popupBody) => {
    popupBody.replaceChildren();

    const name = document.createElement("h2");
    name.id = "stationPopupName";
    name.className = "station-popup-name";
    name.textContent = station.name || "Station information";
    popupBody.appendChild(name);

    if (station.prefecture) {
        const prefecture = document.createElement("p");
        prefecture.className = "station-popup-meta";
        prefecture.textContent = station.prefecture;
        popupBody.appendChild(prefecture);
    }

    if (station.description) {
        const description = document.createElement("p");
        description.className = "station-popup-description";
        description.textContent = station.description;
        popupBody.appendChild(description);
    }

    if (Array.isArray(station.facilities) && station.facilities.length > 0) {
        const facilities = document.createElement("div");
        facilities.className = "station-popup-facilities";
        station.facilities.forEach((facility) => {
            const badge = document.createElement("span");
            badge.className = "facility-badge";
            badge.textContent = String(facility).replace(/_/g, " ");
            facilities.appendChild(badge);
        });
        popupBody.appendChild(facilities);
    }
};

const openStationPopup = async (stationId, popup, popupBody) => {
    popupBody.textContent = "Loading station information...";
    popup.hidden = false;

    try {
        const response = await fetch(
            `/api/stations/${encodeURIComponent(stationId)}`
        );

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const station = await response.json();
        renderStationInfo(station, popupBody);
    } catch (error) {
        console.error("Failed to load station information:", error);
        popupBody.textContent = "Unable to load station information right now.";
    }
};

const closeStationPopup = (popup) => {
    popup.hidden = true;
};

const initializeStationPopup = () => {
    const popup = document.getElementById("stationPopup");
    const popupBody = document.getElementById("stationPopupBody");
    const infoButtons = document.querySelectorAll(".station-info-btn");

    if (!popup || !popupBody || infoButtons.length === 0) {
        return;
    }

    infoButtons.forEach((button) => {
        button.addEventListener("click", () => {
            openStationPopup(button.dataset.stationId, popup, popupBody);
        });
    });

    popup.querySelectorAll("[data-close-popup]").forEach((element) => {
        element.addEventListener("click", () => closeStationPopup(popup));
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !popup.hidden) {
            closeStationPopup(popup);
        }
    });
};

document.addEventListener("DOMContentLoaded", () => {
    initializeScheduleList();
    initializeStationPopup();
});
