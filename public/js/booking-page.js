const bookingForm = document.querySelector('.booking-form');

const maxPassengers = 8;
let passengerCount = document.querySelectorAll('.passenger-card').length;
let ticketPrice = 0;
const passengerList = document.getElementById('passengersList');
const addPassengerButton = document.getElementById('addPassenger');
const ticketRadios = document.querySelectorAll('input[name="ticketClass"]');
const ticketCards = document.querySelectorAll('.ticket-card');
const selectedTicketName = document.getElementById('selectedTicketName');
const passengerCountDisplay = document.getElementById('passengerCount');
const pricePerTicket = document.getElementById('pricePerTicket');
const totalAmount = document.getElementById('totalAmount');
const accountDialog = document.getElementById('account-required-dialog');
const dayLabels = document.querySelectorAll('.days-display label');

const updateSummary = () => {
    passengerCountDisplay.textContent = passengerCount;
    pricePerTicket.textContent = `¥${ticketPrice.toLocaleString()}`;
    totalAmount.textContent = `¥${(ticketPrice * passengerCount).toLocaleString()}`;
};

const createRemoveButton = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-remove-passenger';
    button.innerHTML = '<span class="remove-icon">×</span>';
    button.setAttribute('aria-label', 'Remove passenger');
    return button;
};

const syncPassengerControls = () => {
    addPassengerButton.disabled = passengerCount >= maxPassengers;
    addPassengerButton.classList.toggle('disabled', addPassengerButton.disabled);

    const firstCard = document.querySelector('.passenger-card');
    const firstRemoveButton = firstCard.querySelector('.btn-remove-passenger');
    if (passengerCount > 1 && !firstRemoveButton) {
        firstCard.querySelector('.passenger-card-header').appendChild(createRemoveButton());
    } else if (passengerCount === 1 && firstRemoveButton) {
        firstRemoveButton.remove();
    }
};

const addPassenger = () => {
    if (passengerCount >= maxPassengers) {
        window.alert(`Maximum of ${maxPassengers} passengers allowed per booking`);
        return;
    }

    const index = passengerCount;
    const card = document.createElement('div');
    card.className = 'passenger-card';
    card.dataset.passengerIndex = index;
    card.innerHTML = `
        <div class="passenger-card-header">
            <h3 class="passenger-number">Passenger ${index + 1}</h3>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="firstName-${index}" class="form-label">First Name</label>
                <input type="text" id="firstName-${index}" name="passengers[${index}][firstName]" class="form-input" required placeholder="Enter first name">
            </div>
            <div class="form-group">
                <label for="lastName-${index}" class="form-label">Last Name</label>
                <input type="text" id="lastName-${index}" name="passengers[${index}][lastName]" class="form-input" required placeholder="Enter last name">
            </div>
            <div class="form-group">
                <label for="email-${index}" class="form-label">Email Address</label>
                <input type="email" id="email-${index}" name="passengers[${index}][email]" class="form-input" required placeholder="your.email@example.com">
            </div>
            <div class="form-group">
                <label for="phone-${index}" class="form-label">Phone Number</label>
                <input type="tel" id="phone-${index}" name="passengers[${index}][phone]" class="form-input" required placeholder="+81 90-1234-5678">
            </div>
        </div>
    `;
    card.querySelector('.passenger-card-header').appendChild(createRemoveButton());
    passengerList.appendChild(card);
    passengerCount += 1;
    updatePassengerNumbers();
    updateSummary();
    syncPassengerControls();
};

const updatePassengerNumbers = () => {
    document.querySelectorAll('.passenger-card').forEach((card, index) => {
        card.querySelector('.passenger-number').textContent = `Passenger ${index + 1}`;
    });
};

const removePassenger = (card) => {
    if (passengerCount <= 1) {
        window.alert('At least one passenger is required');
        return;
    }
    card.remove();
    passengerCount -= 1;
    updatePassengerNumbers();
    updateSummary();
    syncPassengerControls();
};

const autoFillForm = () => {
    const westernFirstNames = ['James', 'Olivia', 'William', 'Emily', 'Charlotte', 'George', 'Anna', 'Henry'];
    const westernLastNames = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Evans', 'Clark', 'Davis'];
    const japaneseFirstNames = ['Yuki', 'Haruto', 'Sakura', 'Akira', 'Hana', 'Kenji', 'Aoi', 'Takeshi'];
    const japaneseLastNames = ['Tanaka', 'Suzuki', 'Yamamoto', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Sato'];
    const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
    const randomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    document.querySelectorAll('.passenger-card').forEach((card, index) => {
        const passengerIndex = Number(card.dataset.passengerIndex ?? index);
        const isJapanese = Math.random() < 0.3;
        const firstName = randomItem(isJapanese ? japaneseFirstNames : westernFirstNames);
        const lastName = randomItem(isJapanese ? japaneseLastNames : westernLastNames);
        card.querySelector(`#firstName-${passengerIndex}`).value = firstName;
        card.querySelector(`#lastName-${passengerIndex}`).value = lastName;
        card.querySelector(`#email-${passengerIndex}`).value = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInteger(10, 99)}@example.com`;
        const phone = isJapanese
            ? `+81 120-${randomInteger(100, 999)}-${randomInteger(1000, 9999)}`
            : Math.random() < 0.5
                ? `+1 555-01${String(randomInteger(10, 99)).padStart(2, '0')}-${randomInteger(1000, 9999)}`
                : `+44 1632 960${randomInteger(100, 999)}`;
        card.querySelector(`#phone-${passengerIndex}`).value = phone;
    });
};

const updateTicketAvailability = async (day) => {
    try {
        const response = await fetch(`/api/ticket-classes?day=${encodeURIComponent(day)}`);
        if (!response.ok) throw new Error(`Ticket availability request failed (${response.status})`);
        const availableTickets = await response.json();
        const availableClasses = availableTickets.map((ticket) => ticket.class);

        ticketCards.forEach((card) => {
            const input = card.querySelector('input[name="ticketClass"]');
            const isAvailable = availableClasses.includes(input.value);
            card.style.opacity = isAvailable ? '1' : '0.5';
            card.style.pointerEvents = isAvailable ? 'auto' : 'none';
            input.disabled = !isAvailable;
            if (!isAvailable && input.checked) {
                input.checked = false;
                ticketPrice = 0;
                selectedTicketName.textContent = 'Select an available ticket';
                updateSummary();
            }
        });
    } catch (error) {
        console.error('Unable to update ticket availability:', error);
    }
};

dayLabels.forEach((label) => {
    label.querySelector('input[name="selectedDay"]').addEventListener('change', (event) => {
        dayLabels.forEach((dayLabel) => dayLabel.classList.remove('selected'));
        event.target.closest('label').classList.add('selected');
        updateTicketAvailability(event.target.value);
    });
});

addPassengerButton.addEventListener('click', addPassenger);
passengerList.addEventListener('click', (event) => {
    const removeButton = event.target.closest('.btn-remove-passenger');
    if (removeButton) removePassenger(removeButton.closest('.passenger-card'));
});

ticketRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
        ticketPrice = Number(radio.dataset.price);
        selectedTicketName.textContent = radio.dataset.name;
        updateSummary();
    });
});

document.getElementById('autofill').addEventListener('click', (event) => {
    event.preventDefault();
    autoFillForm();
});

const selectedRadio = document.querySelector('input[name="ticketClass"]:checked');
if (selectedRadio) {
    ticketPrice = Number(selectedRadio.dataset.price);
    selectedTicketName.textContent = selectedRadio.dataset.name;
}
updateSummary();
syncPassengerControls();

const closeAccountDialog = () => accountDialog.close();
bookingForm.addEventListener('submit', (event) => {
    if (bookingForm.dataset.authenticated !== 'true') {
        event.preventDefault();
        accountDialog.showModal();
    }
});
accountDialog.querySelector('.account-required-close').addEventListener('click', closeAccountDialog);
accountDialog.querySelector('[data-close-account-dialog]').addEventListener('click', closeAccountDialog);
accountDialog.addEventListener('click', (event) => {
    if (event.target === accountDialog) closeAccountDialog();
});
