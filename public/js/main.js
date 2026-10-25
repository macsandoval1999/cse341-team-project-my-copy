const hookRegionSorter = () => {
    const regionSelect = document.getElementById('region-filter');
    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            const selectedRegion = regionSelect.value;
            const url = new URL(window.location.href);

            if (selectedRegion && selectedRegion !== 'all') {
                url.searchParams.set('region', selectedRegion);
            } else {
                url.searchParams.delete('region');
            }

            window.location.href = url.toString();
        });
    }
};

const hookSeasonSorter = () => {
    const seasonSelect = document.getElementById('season-filter');
    if (seasonSelect) {
        seasonSelect.addEventListener('change', () => {
            const selectedSeason = seasonSelect.value;
            const url = new URL(window.location.href);

            if (selectedSeason && selectedSeason !== 'all') {
                url.searchParams.set('season', selectedSeason);
            } else {
                url.searchParams.delete('season');
            }

            window.location.href = url.toString();
        });
    }
};

const hookTrainsCatalog = async () => {
    const listEl = document.getElementById('trains-list');
    const templateEl = document.getElementById('train-card-template');
    const loadingEl = document.getElementById('trains-loading');
    const errorEl = document.getElementById('trains-error');
    const emptyEl = document.getElementById('trains-empty');
    const paginationEl = document.getElementById('trains-pagination');
    const prevBtn = document.getElementById('trains-prev-page');
    const nextBtn = document.getElementById('trains-next-page');
    const pageIndicatorEl = document.getElementById('trains-page-indicator');
    const searchInput = document.getElementById('trains-search');
    const typeSelect = document.getElementById('trains-type-filter');
    const powerSelect = document.getElementById('trains-power-filter');

    if (!listEl || !templateEl) {
        return;
    }

    let currentPage = 1;
    let searchDebounceTimer = null;
    let activeRequest = null;

    const renderTrains = (trains) => {
        const fragment = document.createDocumentFragment();

        trains.forEach((train) => {
            const card = templateEl.content.cloneNode(true);
            const imageEl = card.querySelector('[data-field="image"]');

            imageEl.src = train.imageUrl;
            imageEl.alt = train.imageAlt || `${train.name} train`;

            card.querySelector('[data-field="name"]').textContent = train.name;
            card.querySelector('[data-field="name"]').href = `/trains/${encodeURIComponent(train.id)}`;
            card.querySelector('[data-field="operator"]').textContent = train.operator;
            card.querySelector('[data-field="type"]').textContent = train.type;
            card.querySelector('[data-field="speed"]').textContent = `${train.maxSpeedKmh} km/h`;
            card.querySelector('[data-field="seats"]').textContent = `${train.capacity} seats`;
            card.querySelector('[data-field="power"]').textContent = train.powerSource;
            card.querySelector('[data-field="description"]').textContent = train.description;
            card.querySelector('[data-field="best-for"]').textContent = train.bestFor;

            fragment.appendChild(card);
        });

        listEl.replaceChildren(fragment);
    };

    const populateFilterOptions = async () => {
        if (!typeSelect && !powerSelect) {
            return;
        }

        try {
            const response = await fetch('/api/trains/filters', { cache: 'no-store' });
            if (!response.ok) {
                return;
            }

            const options = await response.json();

            if (typeSelect) {
                (options.types || []).forEach((type) => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    typeSelect.appendChild(option);
                });
            }

            if (powerSelect) {
                (options.powerSources || []).forEach((power) => {
                    const option = document.createElement('option');
                    option.value = power;
                    option.textContent = power;
                    powerSelect.appendChild(option);
                });
            }
        } catch (error) {
            // Dropdowns just stay at "All" if this fails, loadTrains still works.
        }
    };

    const buildQueryString = (page) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', 10);

        const q = searchInput ? searchInput.value.trim() : '';
        if (q) {
            params.set('q', q);
        }

        const type = typeSelect ? typeSelect.value : '';
        if (type) {
            params.set('type', type);
        }

        const powerSource = powerSelect ? powerSelect.value : '';
        if (powerSource) {
            params.set('powerSource', powerSource);
        }

        return params.toString();
    };

    const loadTrains = async (page) => {
        if (activeRequest) {
            activeRequest.abort();
        }
        activeRequest = new AbortController();
        const { signal } = activeRequest;

        try {
            const response = await fetch(`/api/trains?${buildQueryString(page)}`, { cache: 'no-store', signal });
            if (!response.ok) {
                throw new Error(`Failed to load trains (${response.status})`);
            }

            const payload = await response.json();
            const trains = Array.isArray(payload.data) ? payload.data : [];
            const pagination = payload.pagination || {};

            renderTrains(trains);
            currentPage = pagination.page || page;

            if (paginationEl) {
                paginationEl.hidden = false;
            }
            if (pageIndicatorEl) {
                pageIndicatorEl.textContent = `Page ${pagination.page} of ${pagination.totalPages || 1}`;
            }
            if (prevBtn) {
                prevBtn.disabled = !pagination.hasPreviousPage;
            }
            if (nextBtn) {
                nextBtn.disabled = !pagination.hasNextPage;
            }

            if (loadingEl) {
                loadingEl.hidden = true;
            }
            if (errorEl) {
                errorEl.hidden = true;
            }
            if (emptyEl) {
                emptyEl.hidden = trains.length > 0;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }

            listEl.replaceChildren();
            if (paginationEl) {
                paginationEl.hidden = true;
            }
            if (loadingEl) {
                loadingEl.hidden = true;
            }
            if (errorEl) {
                errorEl.hidden = false;
                errorEl.textContent = 'Unable to load trains right now. Please try again in a moment.';
            }
            if (emptyEl) {
                emptyEl.hidden = true;
            }
        }
    };

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                loadTrains(currentPage - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            loadTrains(currentPage + 1);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => loadTrains(1), 400);
        });
    }

    if (typeSelect) {
        typeSelect.addEventListener('change', () => loadTrains(1));
    }

    if (powerSelect) {
        powerSelect.addEventListener('change', () => loadTrains(1));
    }

    await populateFilterOptions();
    loadTrains(currentPage);
};

const hookBookingCatalog = async () => {
    const listEl = document.getElementById("bookings-list");
    const templateEl = document.getElementById("booking-card-template");
    const loadingEl = document.getElementById("bookings-loading");
    const errorEl = document.getElementById("bookings-error");
    const emptyEl = document.getElementById("bookings-empty");
    const pageEl = document.getElementById("bookings-admin");
    const scopeQuery =
        pageEl?.dataset.bookingsScope === "mine" ? "&scope=mine" : "";

    if (!listEl || !templateEl) {
        return;
    }

    const requestJson = async (url, options) => {
        const response = await fetch(url, options);
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(
                payload.error || payload.message || "The request failed."
            );
        }
        return payload;
    };

    const loadBookings = async () => {
        if (loadingEl) loadingEl.hidden = false;
        if (errorEl) errorEl.hidden = true;
        if (emptyEl) emptyEl.hidden = true;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const page = urlParams.get('page') || 1;
            const limit = urlParams.get('limit') || 10;
            const sort = urlParams.get('sort') || 'createdAt';
            const order = urlParams.get('order') || 'asc';
            const startDate = urlParams.get('startDate') || '';
            const endDate = urlParams.get('endDate') || '';
            const ticketClass = urlParams.get('ticketClass') || '';
            const filter = { startDate, endDate, ticketClass };
            const ApiUrl = `/api/bookings_paginated?page=${page}&limit=${limit}&sort=${sort}&order=${order}&startDate=${startDate}&endDate=${endDate}&ticketClass=${ticketClass}${scopeQuery}`;

            const [bookings, ticketClasses] = await Promise.all([
                requestJson(ApiUrl),
                requestJson("/api/ticket-classes"),
            ]);
            const fragment = document.createDocumentFragment();
            const isAdmin = pageEl?.dataset.isAdmin === "true";
            const currentUserId = pageEl?.dataset.currentUserId;
            const currentUserEmail = pageEl?.dataset.currentUserEmail
                ?.trim()
                .toLowerCase();
            console.log("bookings: ", bookings);
            if (bookings.length === 0) {
                const noBookingsEl = document.createElement('p');
                noBookingsEl.textContent = 'No bookings found.';
                fragment.appendChild(noBookingsEl);

            }
            const bookingsArray = Array.isArray(bookings) ? bookings : bookings.bookings || [];
            bookingsArray.forEach((booking) => {
                const card = templateEl.content.cloneNode(true);
                const article = card.querySelector(".train-card");
                const passengers = Array.isArray(booking.passengers)
                    ? booking.passengers
                    : [];
                const primaryPassenger = passengers[0] || {};
                const owner =
                    booking.userId && typeof booking.userId === "object"
                        ? booking.userId
                        : null;
                const ownerId = owner?._id || booking.userId;
                const isOwner = String(ownerId) === String(currentUserId);
                const isPassenger = passengers.some(
                    (passenger) =>
                        passenger.email?.trim().toLowerCase() ===
                        currentUserEmail
                );
                const canManage = isAdmin || isOwner;
                const passengerForm = card.querySelector(
                    ".booking-passengers-form"
                );
                const passengerFields = card.querySelector(
                    ".booking-passenger-fields"
                );
                const upgradeForm = card.querySelector(".booking-upgrade-form");
                const classSelect =
                    upgradeForm.elements.namedItem("ticketClass");
                const passengerDialog = card.querySelector(
                    ".booking-passenger-dialog"
                );
                const upgradeDialog = card.querySelector(
                    ".booking-upgrade-dialog"
                );
                const deleteDialog = card.querySelector(
                    ".booking-delete-dialog"
                );
                const viewActions = card.querySelector(".booking-view-actions");
                const ownerMessage = card.querySelector(
                    ".booking-owner-message"
                );
                const passengerError = card.querySelector(
                    ".booking-passenger-error"
                );
                const deleteError = card.querySelector(".booking-delete-error");
                const currentClass = ticketClasses.find(
                    (item) => item.class === booking.ticketClass
                );
                const availableClasses = ticketClasses.filter(
                    (item) =>
                        currentClass &&
                        item.priceMultiplier > currentClass.priceMultiplier &&
                        (item.availableDays || []).some(
                            (day) =>
                                day.toLowerCase() ===
                                String(booking.selectedDay).toLowerCase()
                        )
                );

                article.dataset.id = booking.id;
                card.querySelector(".booking-confirmation-link").href =
                    `/trips/confirmation/${encodeURIComponent(booking.id)}`;
                card.querySelector('[data-field="name"]').textContent =
                    `${primaryPassenger.firstName || "Unknown"} ${primaryPassenger.lastName || "Passenger"}`;
                card.querySelector('[data-field="email"]').textContent =
                    primaryPassenger.email || "No passenger details";
                card.querySelector('[data-field="ticket"]').textContent =
                    `Ticket: ${booking.ticketClass || "Unknown"}`;
                card.querySelector(
                    '[data-field="confirmationId"]'
                ).textContent = booking.id || "Unknown";
                card.querySelector('[data-field="tripId"]').textContent =
                    booking.tripId || "Unknown";
                card.querySelector('[data-field="selectedDay"]').textContent =
                    booking.selectedDay || "Unknown";
                card.querySelector('[data-field="passengers"]').textContent =
                    passengers.length;
                card.querySelector('[data-field="owner"]').textContent =
                    owner?.name || "Unassigned booking";
                card.querySelector('[data-field="bookingDate"]').textContent =
                    booking.createdAt
                        ? new Date(booking.createdAt).toLocaleDateString()
                        : "Unknown";
                viewActions.hidden = !canManage;
                if (!canManage && isPassenger) {
                    ownerMessage.textContent = owner?.email
                        ? `To request a change, contact the booking creator at ${owner.email}.`
                        : "To request a change, contact the booking creator.";
                    ownerMessage.hidden = false;
                }

                const passengerFieldDefinitions = [
                    ["firstName", "First name", "text", "given-name"],
                    ["lastName", "Last name", "text", "family-name"],
                    ["email", "Email", "email", "email"],
                    ["phone", "Phone", "tel", "tel"],
                ];
                passengers.forEach((passenger, index) => {
                    const fieldset = document.createElement("fieldset");
                    const legend = document.createElement("legend");
                    legend.textContent = `Passenger ${index + 1}`;
                    fieldset.append(legend);

                    passengerFieldDefinitions.forEach(
                        ([name, labelText, type, autocomplete]) => {
                            const label = document.createElement("label");
                            const input = document.createElement("input");
                            label.append(document.createTextNode(labelText));
                            input.name = name;
                            input.type = type;
                            input.defaultValue = passenger[name] || "";
                            input.required = true;
                            input.autocomplete = autocomplete;
                            label.append(input);
                            fieldset.append(label);
                        }
                    );

                    passengerFields.append(fieldset);
                });

                classSelect.add(new Option("Choose a higher class", ""));
                availableClasses.forEach((item) => {
                    classSelect.add(new Option(item.name, item.class));
                });
                passengerDialog.addEventListener("close", () => {
                    passengerForm.reset();
                    passengerError.hidden = true;
                    passengerError.textContent = "";
                });
                upgradeDialog.addEventListener("close", () => {
                    upgradeForm.dataset.quoteRequest = String(
                        Number(upgradeForm.dataset.quoteRequest || 0) + 1
                    );
                    delete upgradeForm.dataset.quotedClass;
                    classSelect.value = "";
                    upgradeForm.querySelector(".booking-upgrade-quote").hidden =
                        true;
                    upgradeForm.querySelector(".btn-save-booking").hidden =
                        true;
                });
                deleteDialog.addEventListener("close", () => {
                    deleteError.hidden = true;
                    deleteError.textContent = "";
                });
                card.querySelector(".btn-edit-passengers").hidden = !canManage;
                const upgradeButton = card.querySelector(
                    ".btn-upgrade-booking"
                );
                upgradeButton.disabled = availableClasses.length === 0;
                upgradeButton.title =
                    availableClasses.length === 0
                        ? "No higher class is available for this travel day"
                        : "Upgrade all seats in this booking";
                card.querySelector(".btn-delete-booking").hidden = !canManage;
                fragment.appendChild(card);
            });

            listEl.replaceChildren(fragment);
            if (emptyEl) emptyEl.hidden = bookings.length !== 0;
            // add pagination controls based on response
            const paginationControls = document.getElementById('pagination-controls');

            if (paginationControls) {
                const totalPages = Math.ceil(bookings.total / bookings.limit);
                console.log("totalPages: ", totalPages);
                paginationControls.innerHTML = '';
                for (let i = 1; i <= totalPages; i++) {
                    const pageLink = document.createElement('a');
                    pageLink.href = `?page=${i}&limit=${bookings.limit}&sort=${sort}&order=${order}&startDate=${startDate}&endDate=${endDate}&ticketClass=${ticketClass}${scopeQuery}`;
                    pageLink.textContent = i;
                    if (i === parseInt(page)) {
                        pageLink.style.fontWeight = 'bold';
                    }
                    paginationControls.appendChild(pageLink);
                }
            }
            // add sorting controls based on response
            const sortCategory = document.getElementById('sort-by');
            if (sortCategory) {
                sortCategory.innerHTML = '';
                const sortFields = ['createdAt', 'selectedDay', 'ticketClass', 'tripId'];
                sortFields.forEach(field => {
                    const sortOption = document.createElement('option');
                    sortOption.textContent = `${field}`;
                    sortOption.value = `${field}`;
                    if (field == sort) {
                        sortOption.selected = true;
                    }
                    sortCategory.appendChild(sortOption);
                });
            }

            sortCategory.addEventListener('change', (event) => {
                const target = event.target.value;

                // Check if the user selected a valid URL option (not the placeholder)
                if (target) {
                    window.location.href = `?page=${page}&limit=${limit}&sort=${target}&order=${order}&startDate=${startDate}&endDate=${endDate}&ticketClass=${ticketClass}${scopeQuery}`;
                }
            });
            const sortOrder = document.getElementById('sort-order');
            if (sortOrder) {
                sortOrder.innerHTML = '';
                const sortFields = ['asc', 'desc'];
                sortFields.forEach(field => {
                    const sortOption = document.createElement('option');
                    sortOption.textContent = `${field}`;
                    sortOption.value = `${field}`;
                    if (field == order) {
                        sortOption.selected = true;
                    }
                    sortOrder.appendChild(sortOption);
                });
            }

            sortOrder.addEventListener('change', (event) => {
                const target = event.target.value;

                // Check if the user selected a valid URL option (not the placeholder)
                if (target) {
                    window.location.href = `?page=${page}&limit=${limit}&sort=${sort}&order=${target}${scopeQuery}`;
                }
            });
            // add date range and ticket class filters controls based on response

            const bookingFilterForm = document.getElementById("ticket-class");
            if (bookingFilterForm) {
                try {
                    const ticketClassesUrl = "/api/ticket-classes";
                    const response = await fetch(ticketClassesUrl, { cache: 'no-store' });

                    // Check if the response status is 200-299
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    // Parse the response body as JSON
                    const data = await response.json();
                    console.log(data);
                    for (const item of data) {
                        const option = document.createElement('option');
                        option.value = item.class;
                        option.textContent = item.name;
                        if (item.class === ticketClass) {
                            option.selected = true;
                        }
                        bookingFilterForm.appendChild(option);
                    }
                } catch (error) {
                    console.error("Fetch error:", error);
                }
            }


        } catch (error) {
            if (errorEl) {
                errorEl.hidden = false;
                errorEl.textContent =
                    error.message || "Unable to load bookings right now.";
            }
        } finally {
            if (loadingEl) loadingEl.hidden = true;
        }
    };


    listEl.addEventListener("click", async (event) => {
        const button = event.target.closest("button");
        const article = event.target.closest(".train-card");
        if (!button || !article) return;

        const passengerDialog = article.querySelector(
            ".booking-passenger-dialog"
        );
        const upgradeDialog = article.querySelector(".booking-upgrade-dialog");
        const deleteDialog = article.querySelector(".booking-delete-dialog");

        if (button.matches(".btn-edit-passengers")) {
            passengerDialog.showModal();
        } else if (button.matches(".btn-upgrade-booking")) {
            upgradeDialog.showModal();
        } else if (button.matches(".btn-cancel-passenger-edit")) {
            passengerDialog.close();
        } else if (button.matches(".btn-cancel-upgrade")) {
            upgradeDialog.close();
        } else if (button.matches(".btn-delete-booking")) {
            deleteDialog.showModal();
        } else if (button.matches(".btn-cancel-delete")) {
            deleteDialog.close();
        } else if (button.matches(".btn-delete-confirm")) {
            const deleteError = deleteDialog.querySelector(
                ".booking-delete-error"
            );
            try {
                await requestJson(
                    `/api/bookings/${encodeURIComponent(article.dataset.id)}`,
                    {
                        method: "DELETE",
                    }
                );
                deleteDialog.close();
                await loadBookings();
            } catch (error) {
                deleteError.textContent = error.message;
                deleteError.hidden = false;
            }
        }
    });

    listEl.addEventListener("change", async (event) => {
        if (!event.target.matches('select[name="ticketClass"]')) return;
        const form = event.target.closest(".booking-upgrade-form");
        const quoteElement = form.querySelector(".booking-upgrade-quote");
        const confirmButton = form.querySelector(".btn-save-booking");
        const ticketClass = event.target.value;
        const quoteRequest = Number(form.dataset.quoteRequest || 0) + 1;
        form.dataset.quoteRequest = String(quoteRequest);
        delete form.dataset.quotedClass;

        confirmButton.hidden = true;
        if (!ticketClass) {
            quoteElement.hidden = true;
            return;
        }

        quoteElement.textContent = "Calculating upgrade difference...";
        quoteElement.hidden = false;
        try {
            const quote = await requestJson(
                `/api/bookings/${encodeURIComponent(form.closest(".train-card").dataset.id)}/upgrade-quote?ticketClass=${encodeURIComponent(ticketClass)}`
            );
            if (
                form.dataset.quoteRequest !== String(quoteRequest) ||
                event.target.value !== ticketClass
            ) {
                return;
            }

            quoteElement.textContent = `Upgrade all ${quote.seatCount} seats to ${quote.targetTicketClass}: additional ¥${quote.totalPriceDifference.toLocaleString()} (¥${quote.priceDifferencePerSeat.toLocaleString()} per seat).`;
            confirmButton.hidden = false;
            form.dataset.quotedClass = ticketClass;
        } catch (error) {
            if (form.dataset.quoteRequest !== String(quoteRequest)) return;
            quoteElement.textContent = error.message;
        }
    });

    //     try {
    //      

    //         // add pagination controls based on response
    //         const paginationControls = document.getElementById('pagination-controls');

    //         if (paginationControls) {
    //             const totalPages = Math.ceil(payload.total / payload.limit);
    //             paginationControls.innerHTML = '';
    //             for (let i = 1; i <= totalPages; i++) {
    //                 const pageLink = document.createElement('a');
    //                 pageLink.href = `?page=${i}&limit=${payload.limit}&sort=${sort}&order=${order}`;
    //                 pageLink.textContent = i;
    //                 if (i === parseInt(page)) {
    //                     pageLink.style.fontWeight = 'bold';
    //                 }
    //                 paginationControls.appendChild(pageLink);
    //             }
    //         }
    //         // add sorting controls based on response
    //         const sortCategory = document.getElementById('sort-by');
    //         if (sortCategory) {
    //             sortCategory.innerHTML = '';
    //             const sortFields = ['createdAt', 'selectedDay', 'ticketClass', 'tripId'];
    //             sortFields.forEach(field => {
    //                 const sortOption = document.createElement('option');
    //                 sortOption.textContent = `${field}`;
    //                 sortOption.value = `${field}`;
    //                 if (field == sort) {
    //                     sortOption.selected = true;
    //                 }
    //                 sortCategory.appendChild(sortOption);
    //             });
    //         }

    //         sortCategory.addEventListener('change', (event) => {
    //             const target = event.target.value;

    //             // Check if the user selected a valid URL option (not the placeholder)
    //             if (target) {
    //                 window.location.href = `?page=${page}&limit=${limit}&sort=${target}&order=${order}`;
    //             }
    //         });
    //         const sortOrder = document.getElementById('sort-order');
    //         if (sortOrder) {
    //             sortOrder.innerHTML = '';
    //             const sortFields = ['asc', 'desc'];
    //             sortFields.forEach(field => {
    //                 const sortOption = document.createElement('option');
    //                 sortOption.textContent = `${field}`;
    //                 sortOption.value = `${field}`;
    //                 if (field == sort) {
    //                     sortOption.selected = true;
    //                 }
    //                 sortOrder.appendChild(sortOption);
    //             });
    //         }

    //         sortOrder.addEventListener('change', (event) => {
    //             const target = event.target.value;

    //             // Check if the user selected a valid URL option (not the placeholder)
    //             if (target) {
    //                 window.location.href = `?page=${page}&limit=${limit}&sort=${sort}&order=${target}`;
    //             }
    //         });

    //     } catch (error) {
    //         console.log("error: ", error);
    //         if (loadingEl) {
    //             loadingEl.hidden = true;
    //         }
    //         if (errorEl) {
    //             errorEl.hidden = false;
    //             errorEl.textContent = 'Unable to load bookings right now. Please try again in a moment.';
    //         }
    //     }



    // };

    listEl.addEventListener("submit", async (event) => {
        if (
            !event.target.matches(".booking-passengers-form") &&
            !event.target.matches(".booking-upgrade-form")
        )
            return;
        event.preventDefault();

        const form = event.target;
        const bookingUrl = `/api/bookings/${encodeURIComponent(form.closest(".train-card").dataset.id)}`;
        if (form.matches(".booking-passengers-form")) {
            const passengers = Array.from(
                form.querySelectorAll(".booking-passenger-fields fieldset"),
                (fieldset) =>
                    Object.fromEntries(
                        Array.from(
                            fieldset.querySelectorAll("input"),
                            (input) => [input.name, input.value]
                        )
                    )
            );
            const errorElement = form.querySelector(".booking-passenger-error");
            try {
                await requestJson(bookingUrl, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ passengers }),
                });
                form.closest(".booking-passenger-dialog").close();
                await loadBookings();
            } catch (error) {
                errorElement.textContent = error.message;
                errorElement.hidden = false;
            }
            return;
        }

        const ticketClass = form.elements.namedItem("ticketClass").value;
        if (!ticketClass || form.dataset.quotedClass !== ticketClass) return;

        try {
            await requestJson(bookingUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketClass }),
            });
            form.closest(".booking-upgrade-dialog").close();
            await loadBookings();
        } catch (error) {
            const quoteElement = form.querySelector(".booking-upgrade-quote");
            quoteElement.textContent = error.message;
            quoteElement.hidden = false;
        }
    });

    await loadBookings();
};

document.addEventListener("DOMContentLoaded", () => {
    hookTrainsCatalog();
    hookBookingCatalog();
});
