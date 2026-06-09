const calendarEl = document.querySelector("[data-calendar]");
const roomsEl = document.querySelector("[data-rooms]");
const yearLabel = document.querySelector("[data-year-label]");
const selectedDateLabel = document.querySelector("[data-selected-date]");
const bookedCountEl = document.querySelector("[data-booked-count]");
const availableCountEl = document.querySelector("[data-available-count]");
const selectedSummaryEl = document.querySelector("[data-selected-summary]");
const totalBookingsEl = document.querySelector("[data-total-bookings]");
const fullDaysEl = document.querySelector("[data-full-days]");
const dialog = document.querySelector("[data-dialog]");
const bookingForm = document.querySelector("[data-booking-form]");
const dialogDate = document.querySelector("[data-dialog-date]");
const dialogRoom = document.querySelector("[data-dialog-room]");
const syncStatus = document.querySelector("[data-sync-status]");

const storageKey = "spss-room-calendar-v1";
const googleSheetWebAppUrl = "https://script.google.com/macros/s/AKfycbw9XLJPIQ9w__Lkji2iuk_lB5GVLpPubi24yjWVibvCZ9bu60PirzzB6Q9ogmEdZWCaiQ/exec";
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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

function loadFromGoogleSheet() {
  if (!isSheetSyncEnabled()) {
    setSyncStatus("Using browser storage. Add Google Apps Script URL to sync across devices.");
    return;
  }

  setSyncStatus("Loading shared bookings from Google Sheets...");
  const callbackName = `spssSheetCallback_${Date.now()}`;
  const script = document.createElement("script");
  const separator = googleSheetWebAppUrl.includes("?") ? "&" : "?";
  const timeout = window.setTimeout(() => {
    delete window[callbackName];
    script.remove();
    setSyncStatus("Google Sheets did not respond. Check Apps Script deployment access.", "error");
  }, 12000);

  window[callbackName] = (payload) => {
    window.clearTimeout(timeout);
    delete window[callbackName];
    script.remove();

    if (!payload?.ok) {
      setSyncStatus(`Google Sheets error: ${payload?.error || "Unknown error"}`, "error");
      return;
    }

    bookings = payload.bookings || {};
    saveBookings();
    renderCalendar();
    renderRooms();
    setSyncStatus("Synced with Google Sheets.", "online");
  };

  script.onerror = () => {
    window.clearTimeout(timeout);
    delete window[callbackName];
    script.remove();
    setSyncStatus("Google Sheets sync failed. Check Web App access is set to Anyone.", "error");
  };

  script.src = `${googleSheetWebAppUrl}${separator}action=list&callback=${callbackName}&cache=${Date.now()}`;
  document.body.append(script);
}

function postToGoogleSheet(payload) {
  if (!isSheetSyncEnabled()) return;

  const form = document.createElement("form");
  form.method = "POST";
  form.action = googleSheetWebAppUrl;
  form.target = "sheetSyncFrame";
  form.hidden = true;

  Object.entries(payload).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.name = key;
    input.value = value ?? "";
    form.append(input);
  });

  document.body.append(form);
  form.submit();
  form.remove();
  setSyncStatus("Saved to Google Sheets.", "online");
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", {
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
      const dateKey = `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = `room-button${booking ? " is-booked" : ""}`;
    button.innerHTML = `
      <span class="room-number">${room.short}</span>
      <span class="room-text">
        <strong>${room.label}</strong>
         
        // <span>${booking ? `${booking.name}${booking.phone ? ` - ${booking.phone}` : ""}` : "Available"}</span>
        <span>
      ${booking
        ? `${booking.roomType || "AC"} • ${booking.name}`
        : "Available"}
      </span>
      </span>
      <span class="room-status">${booking ? "Booked" : "Free"}</span>
    `;
    button.addEventListener("click", () => openBookingDialog(room.id));
    roomsEl.append(button);
  });
}

function renderStats() {
  let totalBookings = 0;
  let fullDays = 0;
  Object.entries(bookings).forEach(([dateKey, roomsForDate]) => {
    if (dateKey.startsWith(`${currentYear}-`)) {
      const count = Object.keys(roomsForDate).length;
      totalBookings += count;
      if (count === rooms.length) fullDays += 1;
    }
  });
  totalBookingsEl.textContent = totalBookings;
  fullDaysEl.textContent = fullDays;
}

function openBookingDialog(roomId) {
  activeRoomId = roomId;
  const room = rooms.find((item) => item.id === roomId);
  const booking = getDateBookings(selectedDate)[roomId];
  dialogDate.textContent = formatDisplayDate(selectedDate);
  dialogRoom.textContent = room.label;
  bookingForm.elements.name.value = booking?.name || "";
  bookingForm.elements.phone.value = booking?.phone || "";
  bookingForm.elements.notes.value = booking?.notes || "";
  const roomType = booking?.roomType || "AC";

  document.querySelector(
    `input[name="roomType"][value="${roomType}"]`
  ).checked = true;
  dialog.showModal();
  bookingForm.elements.name.focus();
}

function saveRoomBooking() {
  const form = new FormData(bookingForm);
  const name = String(form.get("name") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const notes = String(form.get("notes") || "").trim();
  const roomType = String(form.get("roomType") || "AC");
  if (!name || !activeRoomId) return;

  if (!bookings[selectedDate]) bookings[selectedDate] = {};
  bookings[selectedDate][activeRoomId] = {
    name,
    phone,
    roomType,
    notes,
    updatedAt: new Date().toISOString(),
  };

  saveBookings();
  postToGoogleSheet({
    action: "save",
    date: selectedDate,
    roomId: activeRoomId,
    name,
    phone,
    roomType,
    notes,
  });
  dialog.close();
  renderCalendar();
  renderRooms();
}

function deleteRoomBooking() {
  if (!activeRoomId || !bookings[selectedDate]) return;
  delete bookings[selectedDate][activeRoomId];
  if (Object.keys(bookings[selectedDate]).length === 0) {
    delete bookings[selectedDate];
  }
  saveBookings();
  postToGoogleSheet({
    action: "delete",
    date: selectedDate,
    roomId: activeRoomId,
  });
  dialog.close();
  renderCalendar();
  renderRooms();
}

function copySelectedSummary() {
  const dateBookings = getDateBookings(selectedDate);
  const lines = [`SPSS Residency bookings for ${formatDisplayDate(selectedDate)}`];
  rooms.forEach((room) => {
    const booking = dateBookings[room.id];
    lines.push(`${room.short}: ${booking ? `${booking.name}${booking.phone ? ` (${booking.phone})` : ""}` : "Available"}`);
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

document.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
document.querySelector("[data-delete-booking]").addEventListener("click", deleteRoomBooking);
document.querySelector("[data-copy-summary]").addEventListener("click", copySelectedSummary);

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
loadFromGoogleSheet();
