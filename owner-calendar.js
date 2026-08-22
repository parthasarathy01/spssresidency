const calendarEl = document.querySelector("[data-calendar]");
const roomsEl = document.querySelector("[data-rooms]");
const yearLabel = document.querySelector("[data-year-label]");
const selectedDateLabel = document.querySelector("[data-selected-date]");
const bookedCountEl = document.querySelector("[data-booked-count]");
const availableCountEl = document.querySelector("[data-available-count]");
const selectedSummaryEl = document.querySelector("[data-selected-summary]");
const totalBookingsEl = document.querySelector("[data-total-bookings]");
const fullDaysEl = document.querySelector("[data-full-days]");
const currentMonthRoomsEl = document.querySelector("[data-current-month-rooms]");
const currentMonthReceivedEl = document.querySelector("[data-current-month-received]");
const allTimeReceivedEl = document.querySelector("[data-all-time-received]");
const currentMonthOutstandingEl = document.querySelector("[data-current-month-outstanding]");
const dialog = document.querySelector("[data-dialog]");
const bookingForm = document.querySelector("[data-booking-form]");
const dialogDate = document.querySelector("[data-dialog-date]");
const dialogRoom = document.querySelector("[data-dialog-room]");
const bookingTypeSummary = document.querySelector("[data-booking-type-summary]");
const standardAmountEl = document.querySelector("[data-standard-amount]");
const standardAmountLabelEl = document.querySelector("[data-standard-label]");
const finalTotalEl = document.querySelector("[data-final-total]");
const discountInput = bookingForm.elements.discount;
const advanceInput = bookingForm.elements.advancePaid;
const balanceInput = bookingForm.elements.balanceAmount;
const syncStatus = document.querySelector("[data-sync-status]");
const toggleMultiButton = document.querySelector("[data-toggle-multi]");
const bookSelectedButton = document.querySelector("[data-book-selected]");
const clearSelectionButton = document.querySelector("[data-clear-selection]");
const saveBookingButton = document.querySelector("[data-save-booking]");
const syncErrorDialog = document.querySelector("[data-sync-error-dialog]");
const syncErrorTitle = document.querySelector("[data-sync-error-title]");
const syncErrorMessage = document.querySelector("[data-sync-error-message]");
const googleSheetWebAppUrl =
  "https://script.google.com/macros/s/AKfycby1NtF5nC63QlLRBnRFSFmdbBw6puYksuSwb-Tm27q7ESwh1sO4QC1bzhX2BB-j9kQJkg/exec";

const storageKey = "spss-room-calendar-v2";
const AC_RATE = 1500;
const NON_AC_RATE = 1000;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const rooms = [
  { id: "G1", label: "Ground Floor 101", short: "101", type: "NON-AC" },
  { id: "G2", label: "Ground Floor 102", short: "102", type: "NON-AC" },
  { id: "G3", label: "Ground Floor 103", short: "103", type: "AC" },
  { id: "G4", label: "Ground Floor 104", short: "104", type: "AC" },
  { id: "G5", label: "Ground Floor 105", short: "105", type: "AC" },
  { id: "F1", label: "First Floor 106", short: "106", type: "AC" },
  { id: "F2", label: "First Floor 107", short: "107", type: "AC" },
  { id: "F3", label: "First Floor 108", short: "108", type: "AC" },
  { id: "F4", label: "First Floor 109", short: "109", type: "AC" },
  { id: "F5", label: "First Floor 110", short: "110", type: "AC" },
  { id: "F6", label: "First Floor 111", short: "111", type: "NON-AC" },
];

let bookings = loadBookings();
let currentYear = new Date().getFullYear();
let selectedDate = toDateKey(new Date());
let activeRoomId = null;
let activeRoomIds = [];
let calculationRoomIds = [];
let isMultiSelectMode = false;
let selectedRoomIds = new Set();
let pendingRequest = null;

function isSheetSyncEnabled() {
  return googleSheetWebAppUrl.startsWith("https://script.google.com/");
}

function loadBookings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveBookings() {
  localStorage.setItem(storageKey, JSON.stringify(bookings));
}

function setSyncStatus(message, state = "") {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("is-online", state === "online");
  syncStatus.classList.toggle("is-error", state === "error");
}

function showSyncError(title, message) {
  syncErrorTitle.textContent = title;
  syncErrorMessage.textContent = message;
  if (typeof syncErrorDialog.showModal === "function") {
    if (!syncErrorDialog.open) syncErrorDialog.showModal();
  } else {
    alert(`${title}\n\n${message}`);
  }
}

function getRoom(roomId) {
  return rooms.find((room) => room.id === roomId);
}

function getRoomRate(roomType) {
  return roomType === "NON-AC" ? NON_AC_RATE : AC_RATE;
}

function calculateStandardAmount(roomIds) {
  return roomIds.reduce((sum, roomId) => {
    const room = getRoom(roomId);
    return sum + getRoomRate(room?.type || "AC");
  }, 0);
}

function getRoomCounts(roomIds) {
  let ac = 0;
  let nonAc = 0;
  roomIds.forEach((roomId) => {
    if (getRoom(roomId)?.type === "NON-AC") nonAc += 1;
    else ac += 1;
  });
  return { ac, nonAc };
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getOutstandingAmount(booking) {
  if (!booking) return 0;
  const balanceRaw = booking.balanceAmount;
  if (balanceRaw === "" || balanceRaw === null || typeof balanceRaw === "undefined") {
    return Math.max(Number(booking.totalAmount || 0) - Number(booking.advancePaid || 0), 0);
  }
  return Math.max(Number(balanceRaw || 0), 0);
}

function getReceivedAmount(booking) {
  if (!booking) return 0;

  const balanceRaw = booking.balanceAmount;
  const balanceBlank =
    balanceRaw === "" || balanceRaw === null || typeof balanceRaw === "undefined";

  if (balanceBlank) {
    return Number(booking.totalAmount || booking.advancePaid || 0);
  }

  return Number(booking.advancePaid || 0);
}

function getBookingRowsForGroup(bookingId) {
  if (!bookingId) return [];
  const rows = [];
  Object.entries(bookings).forEach(([dateKey, roomsForDate]) => {
    Object.entries(roomsForDate).forEach(([roomId, booking]) => {
      if (booking?.bookingId === bookingId) {
        rows.push({ dateKey, roomId, booking });
      }
    });
  });
  return rows;
}

function makeBookingId() {
  const stamp = new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${stamp}-${random}`;
}

function loadFromGoogleSheet() {
  return new Promise((resolve, reject) => {
    if (!isSheetSyncEnabled()) {
      setSyncStatus("Google Sheets sync is not configured.", "error");
      const error = new Error("The owner calendar cannot use shared data until the Apps Script Web App URL is configured.");
      showSyncError("Google Sheets is not configured", error.message);
      reject(error);
      return;
    }

    setSyncStatus("Loading shared bookings from Google Sheets...");
    const callbackName = `spssSheetCallback_${Date.now()}`;
    const script = document.createElement("script");
    const separator = googleSheetWebAppUrl.includes("?") ? "&" : "?";

    const cleanup = () => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      setSyncStatus("Google Sheets did not respond.", "error");
      const error = new Error("Google Sheets did not respond within 12 seconds. The data currently visible is only the local browser backup and may be stale.");
      showSyncError("Google Sheets read failed", error.message);
      reject(error);
    }, 12000);

    window[callbackName] = (payload) => {
      cleanup();

      if (!payload?.ok) {
        setSyncStatus("Google Sheets returned an error.", "error");
        const error = new Error(payload?.error || "Google Apps Script returned an unknown error.");
        showSyncError("Google Sheets read failed", error.message);
        reject(error);
        return;
      }

      bookings = payload.bookings || {};
      saveBookings();
      renderCalendar();
      renderRooms();
      setSyncStatus("Synced with Google Sheets.", "online");
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      setSyncStatus("Google Sheets sync failed.", "error");
      const error = new Error("The Apps Script Web App could not be reached. Check the deployment URL and access settings.");
      showSyncError("Google Sheets read failed", error.message);
      reject(error);
    };

    script.src =
      `${googleSheetWebAppUrl}${separator}action=list&callback=${callbackName}&cache=${Date.now()}`;
    document.body.append(script);
  });
}

function postToGoogleSheet(payload) {
  return new Promise((resolve, reject) => {
    if (!isSheetSyncEnabled()) {
      reject(new Error("Google Sheets sync is not configured."));
      return;
    }

    if (pendingRequest) {
      reject(new Error("Another Google Sheets operation is already in progress."));
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pendingRequest = { requestId, resolve, reject };

    const form = document.createElement("form");
    form.method = "POST";
    form.action = googleSheetWebAppUrl;
    form.target = "sheetSyncFrame";
    form.hidden = true;

    const payloadWithRequest = {
      ...payload,
      requestId,
    };

    Object.entries(payloadWithRequest).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.name = key;
      input.value = value ?? "";
      form.append(input);
    });

    document.body.append(form);
    form.submit();
    form.remove();

    setSyncStatus("Saving to Google Sheets...");

    window.setTimeout(() => {
      if (pendingRequest?.requestId !== requestId) return;
      pendingRequest = null;
      setSyncStatus("Google Sheets write timed out.", "error");
      reject(new Error("Google Sheets did not confirm the write within 15 seconds."));
    }, 15000);
  });
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.source !== "spss-sheet-sync") return;
  if (!pendingRequest || data.requestId !== pendingRequest.requestId) return;

  const request = pendingRequest;
  pendingRequest = null;

  if (data.ok) {
    setSyncStatus("Synced with Google Sheets.", "online");
    request.resolve(data);
  } else {
    setSyncStatus("Google Sheets write failed.", "error");
    request.reject(new Error(data.error || "Google Apps Script returned an error."));
  }
});

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getDateBookings(dateKey) {
  return bookings[dateKey] || {};
}

function getBookedCount(dateKey) {
  return Object.keys(getDateBookings(dateKey)).length;
}

function renderCalendar() {
  yearLabel.textContent = currentYear;
  calendarEl.innerHTML = "";

  monthNames.forEach((monthName, monthIndex) => {
    const monthCard = document.createElement("section");
    monthCard.className = "month-card";
    monthCard.innerHTML = `<div class="month-title">${monthName}</div>`;

    const weekdays = document.createElement("div");
    weekdays.className = "weekdays";
    dayNames.forEach((day) => {
      const span = document.createElement("span");
      span.textContent = day;
      weekdays.append(span);
    });
    monthCard.append(weekdays);

    const daysGrid = document.createElement("div");
    daysGrid.className = "days-grid";

    const firstDay = new Date(currentYear, monthIndex, 1).getDay();
    const totalDays = new Date(currentYear, monthIndex + 1, 0).getDate();

    for (let blank = 0; blank < firstDay; blank += 1) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.className = "day-button is-empty";
      empty.disabled = true;
      daysGrid.append(empty);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey =
        `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const count = getBookedCount(dateKey);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-button";
      button.textContent = day;
      button.dataset.date = dateKey;

      if (dateKey === toDateKey(new Date())) button.classList.add("is-today");
      if (dateKey === selectedDate) button.classList.add("is-selected");
      if (count > 0 && count < rooms.length) button.classList.add("is-partial");
      if (count === rooms.length) button.classList.add("is-full");

      if (count > 0) {
        const countEl = document.createElement("span");
        countEl.className = "day-count";
        countEl.textContent = `${count}/11`;
        button.append(countEl);
      }

      button.addEventListener("click", () => {
        selectedDate = dateKey;
        clearRoomSelection();
        renderCalendar();
        renderRooms();
      });

      daysGrid.append(button);
    }

    monthCard.append(daysGrid);
    calendarEl.append(monthCard);
  });

  renderStats();
}

function renderRooms() {
  const dateBookings = getDateBookings(selectedDate);
  const bookedCount = Object.keys(dateBookings).length;

  selectedDateLabel.textContent = formatDisplayDate(selectedDate);
  bookedCountEl.textContent = `${bookedCount} booked`;
  availableCountEl.textContent = `${rooms.length - bookedCount} available`;
  selectedSummaryEl.textContent = `${bookedCount}/11`;
  roomsEl.innerHTML = "";

  rooms.forEach((room) => {
    const booking = dateBookings[room.id];
    const isSelected = selectedRoomIds.has(room.id);
    const isSelectable = isMultiSelectMode;

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      `room-button room-type-${room.type === "AC" ? "ac" : "non-ac"}${booking ? " is-booked" : ""}` +
      `${isMultiSelectMode ? " is-selectable" : ""}` +
      `${isSelected ? " is-selected" : ""}`;

    const bookingText = booking
      ? `${booking.name}` +
        `<br><small>Adv ${formatMoney(booking.advancePaid || 0)} | Due ${formatMoney(booking.balanceAmount || 0)}</small>`
      : "Available";

    button.innerHTML = `
      ${isMultiSelectMode ? `<span class="room-check">${isSelected ? "✓" : ""}</span>` : ""}
      <span class="room-number">${room.short}</span>
      <span class="room-text">
        <strong>${room.label}</strong>
        <small class="room-type">${room.type}</small>
        <span>${bookingText}</span>
      </span>
      <span class="room-status">${booking ? "Booked" : "Free"}</span>
    `;

    button.addEventListener("click", () => {
      if (isMultiSelectMode) {
        if (!isSelectable) return;
        toggleRoomSelection(room.id);
        return;
      }

      openBookingDialog([room.id]);
    });

    roomsEl.append(button);
  });

  updateMultiActions();
}

function renderStats() {
  let totalBookings = 0;
  let fullDays = 0;
  let currentMonthRooms = 0;
  let currentMonthReceived = 0;
  let allTimeReceived = 0;
  let currentMonthOutstanding = 0;

  const today = new Date();
  const currentMonthKey =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  Object.entries(bookings).forEach(([dateKey, roomsForDate]) => {
    const count = Object.keys(roomsForDate).length;

    if (dateKey.startsWith(`${currentYear}-`)) {
      totalBookings += count;
      if (count === rooms.length) fullDays += 1;
    }

    if (dateKey.startsWith(currentMonthKey)) {
      currentMonthRooms += count;
    }

    Object.values(roomsForDate).forEach((booking) => {
      const received = getReceivedAmount(booking);
      if (dateKey.startsWith(currentMonthKey)) {
        currentMonthReceived += received;
        currentMonthOutstanding += getOutstandingAmount(booking);
      }
      allTimeReceived += received;
    });
  });

  totalBookingsEl.textContent = totalBookings;
  fullDaysEl.textContent = fullDays;
  currentMonthRoomsEl.textContent = currentMonthRooms;
  currentMonthReceivedEl.textContent = formatMoney(currentMonthReceived);
  currentMonthOutstandingEl.textContent = formatMoney(currentMonthOutstanding);
  allTimeReceivedEl.textContent = formatMoney(allTimeReceived);
}

function openBookingDialog(roomIds) {
  activeRoomIds = [...roomIds];
  activeRoomId = activeRoomIds[0];

  const firstRoom = getRoom(activeRoomId);
  const dateBookings = getDateBookings(selectedDate);
  const existingEntries = activeRoomIds
    .map((id) => ({ roomId: id, booking: dateBookings[id] }))
    .filter((entry) => entry.booking);
  const existing = existingEntries[0]?.booking || null;

  // Financial values belong to the whole BookingId group, not necessarily to
  // the room the user clicked. This is especially important when editing one
  // room from a multi-room booking.
  const existingGroupRows = existing?.bookingId
    ? getBookingRowsForGroup(existing.bookingId).filter((row) => row.dateKey === selectedDate)
    : [];
  calculationRoomIds = existingGroupRows.length
    ? existingGroupRows.map((row) => row.roomId)
    : [...activeRoomIds];

  const standardAmount = calculateStandardAmount(calculationRoomIds);
  const counts = getRoomCounts(calculationRoomIds);
  const isExistingGroup = Boolean(existing?.bookingId && existingGroupRows.length > 1);

  dialogDate.textContent = formatDisplayDate(selectedDate);

  if (activeRoomIds.length === 1) {
    dialogRoom.textContent = firstRoom.label;
    standardAmountLabelEl.textContent = isExistingGroup ? "Standard group rent" : "Standard room rent";
    bookingTypeSummary.textContent = isExistingGroup
      ? `${counts.ac} AC + ${counts.nonAc} Non-AC • Group rooms ${calculationRoomIds.map((id) => getRoom(id)?.short).join(", ")} • Group ${existing.bookingId}`
      : `Room type: ${firstRoom.type}${existing?.bookingId ? ` • Group ${existing.bookingId}` : ""}`;
  } else {
    dialogRoom.textContent =
      `${activeRoomIds.length} rooms selected: ${activeRoomIds.map((id) => getRoom(id)?.short).join(", ")}`;
    standardAmountLabelEl.textContent = "Standard group rent";
    bookingTypeSummary.textContent =
      `${counts.ac} AC + ${counts.nonAc} Non-AC • Standard rent ${formatMoney(standardAmount)}` +
      (existing?.bookingId ? ` • Editing group ${existing.bookingId}` : "");
  }

  bookingForm.elements.name.value = existing?.name || "";
  bookingForm.elements.phone.value = existing?.phone || "";
  bookingForm.elements.notes.value = existing?.notes || "";
  bookingForm.elements.paymentMode.value = existing?.paymentMode || "UPI";

  delete discountInput.dataset.userEdited;

  const storedTotal = Number(existing?.totalAmount || 0);
  const storedDiscount = Number(existing?.discount || 0);

  let discount = storedDiscount;
  if (!existing?.discount && storedTotal > 0) {
    discount = Math.max(standardAmount - storedTotal, 0);
  }

  discountInput.value = discount;
  advanceInput.value = existing?.advancePaid ?? "";

  updateAmounts(standardAmount, storedTotal, Boolean(existing));
  dialog.showModal();
  bookingForm.elements.name.focus();
}

function updateAmounts(standardAmount = calculateStandardAmount(calculationRoomIds.length ? calculationRoomIds : activeRoomIds), legacyTotal = 0, isExisting = false) {
  const discount = Math.max(Number(discountInput.value || 0), 0);
  let total = Math.max(standardAmount - discount, 0);

  // Existing historical totals are preserved until the user changes the
  // discount. Once the discount is edited, the group total is recalculated
  // from the group's standard rent.
  if (isExisting && legacyTotal > 0 && !discountInput.dataset.userEdited) {
    total = legacyTotal;
  }

  standardAmountEl.textContent = formatMoney(standardAmount);
  finalTotalEl.textContent = formatMoney(total);
  balanceInput.value = Math.max(total - Number(advanceInput.value || 0), 0);

  bookingForm.dataset.calculatedTotal = String(total);
}

discountInput.addEventListener("input", () => {
  discountInput.dataset.userEdited = "1";
  updateAmounts();
});

advanceInput.addEventListener("input", () => updateAmounts());

function saveRoomBooking() {
  const form = new FormData(bookingForm);
  const name = String(form.get("name") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const notes = String(form.get("notes") || "").trim();
  const paymentMode = String(form.get("paymentMode") || "UPI");
  const discount = Math.max(Number(form.get("discount") || 0), 0);
  const totalAmount = Math.max(
    Number(bookingForm.dataset.calculatedTotal || calculateStandardAmount(calculationRoomIds.length ? calculationRoomIds : activeRoomIds) - discount),
    0
  );
  const advancePaid = Math.max(Number(form.get("advancePaid") || 0), 0);
  const balanceAmount = Math.max(totalAmount - advancePaid, 0);

  if (!name || activeRoomIds.length === 0) return;

  if (advancePaid > totalAmount) {
    showSyncError(
      "Invalid payment amount",
      "Advance Paid cannot be greater than the final Total Amount."
    );
    return;
  }

  const dateBookings = getDateBookings(selectedDate);
  const selectedBookings = activeRoomIds
    .map((roomId) => dateBookings[roomId])
    .filter(Boolean);
  const existingGroupIds = [...new Set(selectedBookings.map((booking) => booking.bookingId).filter(Boolean))];
  const hasAvailable = activeRoomIds.some((roomId) => !dateBookings[roomId]);

  if (existingGroupIds.length > 1 || (existingGroupIds.length === 1 && hasAvailable)) {
    showSyncError(
      "Invalid room selection",
      "For an edit, select rooms from one existing group only. For a new booking, select available rooms only."
    );
    return;
  }

  let roomsToSave = [...activeRoomIds];
  let bookingId = existingGroupIds[0] || makeBookingId();

  // Editing any rooms from an existing group updates that whole group.
  // This keeps name/phone/payment details consistent across the group.
  if (existingGroupIds.length === 1) {
    roomsToSave = getBookingRowsForGroup(bookingId)
      .filter((row) => row.dateKey === selectedDate)
      .map((row) => row.roomId);
  }

  const roomRows = roomsToSave.map((roomId) => {
    const room = getRoom(roomId);
    return {
      roomId,
      roomType: room.type,
    };
  });

  const payload = {
    action: roomsToSave.length > 1 ? "saveMultiple" : "save",
    date: selectedDate,
    roomId: roomsToSave[0],
    bookingId,
    name,
    phone,
    totalAmount,
    advancePaid,
    balanceAmount,
    discount,
    paymentMode,
    notes,
  };

  if (roomsToSave.length > 1) {
    payload.rooms = JSON.stringify(roomRows);
  } else {
    payload.roomType = roomRows[0].roomType;
  }

  saveBookingButton.disabled = true;
  saveBookingButton.textContent = "Saving...";

  postToGoogleSheet(payload)
    .then(() => {
      if (!bookings[selectedDate]) bookings[selectedDate] = {};
      const timestamp = new Date().toISOString();

      roomsToSave.forEach((roomId, index) => {
        const room = getRoom(roomId);
        bookings[selectedDate][roomId] = {
          name,
          phone,
          roomType: room.type,
          totalAmount: index === 0 ? totalAmount : "",
          advancePaid: index === 0 ? advancePaid : "",
          balanceAmount: index === 0 ? balanceAmount : "",
          discount: index === 0 ? discount : "",
          paymentMode: index === 0 ? paymentMode : "",
          notes,
          bookingId,
          updatedAt: timestamp,
        };
      });

      saveBookings();
      dialog.close();
      isMultiSelectMode = false;
      clearRoomSelection();
      renderCalendar();
      renderRooms();
    })
    .catch((error) => {
      showSyncError(
        "Booking was NOT saved",
        error?.message || "Google Sheets did not confirm the write. No local booking was marked as saved."
      );
    })
    .finally(() => {
      saveBookingButton.disabled = false;
      saveBookingButton.textContent = "Save booking";
    });
}

function applyLocalRoomClear(roomIds) {
  const dateBookings = getDateBookings(selectedDate);
  const affectedBookingIds = new Set();
  const groupFinancials = {};

  // Capture the financial source for each affected group before removing rows.
  Object.entries(dateBookings).forEach(([roomId, booking]) => {
    if (!booking?.bookingId) return;
    if (!groupFinancials[booking.bookingId]) {
      groupFinancials[booking.bookingId] = {
        advance: Number(booking.advancePaid || 0),
        discount: Number(booking.discount || 0),
        paymentMode: booking.paymentMode || "",
      };
    }
    if (booking.advancePaid !== "" && booking.advancePaid !== null && typeof booking.advancePaid !== "undefined") {
      groupFinancials[booking.bookingId].advance = Number(booking.advancePaid || 0);
    }
    if (booking.discount !== "" && booking.discount !== null && typeof booking.discount !== "undefined") {
      groupFinancials[booking.bookingId].discount = Number(booking.discount || 0);
    }
    if (booking.paymentMode) groupFinancials[booking.bookingId].paymentMode = booking.paymentMode;
  });

  roomIds.forEach((roomId) => {
    const booking = dateBookings[roomId];
    if (booking?.bookingId) affectedBookingIds.add(booking.bookingId);
  });

  // Remove the selected rooms immediately so the dialog closes and the right
  // panel responds instantly. The server remains the source of truth and is
  // refreshed in the background after the delete succeeds.
  roomIds.forEach((roomId) => delete dateBookings[roomId]);

  affectedBookingIds.forEach((bookingId) => {
    const remainingRoomIds = Object.keys(dateBookings).filter(
      (roomId) => dateBookings[roomId]?.bookingId === bookingId
    );

    if (!remainingRoomIds.length) return;

    const financial = groupFinancials[bookingId] || {
      advance: 0,
      discount: 0,
      paymentMode: "",
    };
    const standardAmount = calculateStandardAmount(remainingRoomIds);
    const totalAmount = Math.max(standardAmount - financial.discount, 0);
    const balanceAmount = Math.max(totalAmount - financial.advance, 0);

    remainingRoomIds.forEach((roomId, index) => {
      const booking = dateBookings[roomId];
      if (index === 0) {
        booking.totalAmount = totalAmount;
        booking.advancePaid = financial.advance;
        booking.balanceAmount = balanceAmount;
        booking.discount = financial.discount;
        booking.paymentMode = financial.paymentMode;
      } else {
        booking.totalAmount = "";
        booking.advancePaid = "";
        booking.balanceAmount = "";
        booking.discount = "";
        booking.paymentMode = "";
      }
    });
  });

  saveBookings();
  renderCalendar();
  renderRooms();
}

async function deleteRoomBooking() {
  if (activeRoomIds.length === 0) return;

  const idsToDelete = [...activeRoomIds];
  const roomNames = idsToDelete
    .map((roomId) => getRoom(roomId)?.short || roomId)
    .join(", ");
  const confirmed = window.confirm(
    idsToDelete.length > 1
      ? `Clear the selected group booking for rooms ${roomNames}?\n\nThis will clear all selected rooms. The remaining group's advance, discount and total will be recalculated on the remaining room(s).`
      : "Clear this room booking?"
  );

  if (!confirmed) return;

  // Make the UI change first. Previously this function waited for one Google
  // Sheets request per room and then waited for a full reload before closing
  // the dialog. That made even a simple single-room clear feel very slow.
  applyLocalRoomClear(idsToDelete);
  dialog.close();
  isMultiSelectMode = false;
  clearRoomSelection();
  calculationRoomIds = [];
  setSyncStatus("Clearing booking from Google Sheets...");

  try {
    await postToGoogleSheet({
      action: "deleteMultiple",
      date: selectedDate,
      roomIds: JSON.stringify(idsToDelete),
    });

    // Refresh quietly in the background so the UI stays responsive while the
    // server remains the source of truth for group financial values.
    loadFromGoogleSheet().catch(() => {});
  } catch (error) {
    try {
      await loadFromGoogleSheet();
    } catch (_) {
      // Keep the original write error as the user-facing message.
    }
    showSyncError(
      "Booking was NOT fully cleared",
      error?.message || "Google Sheets did not confirm the delete."
    );
  }
}

function toggleRoomSelection(roomId) {
  if (selectedRoomIds.has(roomId)) selectedRoomIds.delete(roomId);
  else selectedRoomIds.add(roomId);
  renderRooms();
}

function clearRoomSelection() {
  selectedRoomIds.clear();
  updateMultiActions();
}

function updateMultiActions() {
  const selectedCount = selectedRoomIds.size;
  toggleMultiButton.textContent = isMultiSelectMode ? "Done selecting" : "Select rooms";
  if (selectedCount === 0) {
    bookSelectedButton.textContent = "Book / Edit selected (0)";
  } else {
    const selectedBookings = [...selectedRoomIds]
      .map((roomId) => getDateBookings(selectedDate)[roomId])
      .filter(Boolean);
    const allBooked = selectedBookings.length === selectedCount;
    bookSelectedButton.textContent = `${allBooked ? "Edit selected" : "Book selected"} (${selectedCount})`;
  }
  bookSelectedButton.disabled = selectedCount === 0;
  clearSelectionButton.hidden = selectedCount === 0;
}

function copySelectedSummary() {
  const dateBookings = getDateBookings(selectedDate);
  const lines = [`SPSS Residency bookings for ${formatDisplayDate(selectedDate)}`];

  rooms.forEach((room) => {
    const booking = dateBookings[room.id];
    lines.push(
      `${room.short}: ${
        booking
          ? `${booking.roomType || room.type} • ${booking.name}` +
            `${booking.phone ? ` (${booking.phone})` : ""}` +
            ` - Advance ${formatMoney(booking.advancePaid || 0)} / Total ${formatMoney(booking.totalAmount || 0)}`
          : "Available"
      }`
    );
  });

  navigator.clipboard?.writeText(lines.join("\n"));
}

document.querySelector("[data-prev-year]").addEventListener("click", () => {
  currentYear -= 1;
  renderCalendar();
});

document.querySelector("[data-next-year]").addEventListener("click", () => {
  currentYear += 1;
  renderCalendar();
});

document.querySelector("[data-close-dialog]").addEventListener("click", () => {
  dialog.close();
  calculationRoomIds = [];
});
document.querySelector("[data-delete-booking]").addEventListener("click", deleteRoomBooking);
document.querySelector("[data-copy-summary]").addEventListener("click", copySelectedSummary);
document.querySelector("[data-close-sync-error]").addEventListener("click", () => syncErrorDialog.close());

toggleMultiButton.addEventListener("click", () => {
  isMultiSelectMode = !isMultiSelectMode;
  if (!isMultiSelectMode) clearRoomSelection();
  renderRooms();
});

bookSelectedButton.addEventListener("click", () => {
  if (selectedRoomIds.size === 0) return;
  openBookingDialog(Array.from(selectedRoomIds));
});

clearSelectionButton.addEventListener("click", () => {
  clearRoomSelection();
  renderRooms();
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveRoomBooking();
});

document.querySelector("[data-export]").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(bookings, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `spss-room-bookings-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector("[data-import]").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    bookings = imported;
    saveBookings();
    renderCalendar();
    renderRooms();
  } catch {
    alert("Could not import this backup file.");
  } finally {
    event.target.value = "";
  }
});

renderCalendar();
renderRooms();
loadFromGoogleSheet().catch(() => {});
