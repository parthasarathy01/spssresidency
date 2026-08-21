const SHEET_NAME = "Bookings";
const SPREADSHEET_ID = "";

// Column order is intentionally backward-compatible.
// Existing A:K data stays in place.
// L = Discount
// M = BookingId
const HEADERS = [
  "Date",
  "RoomId",
  "Name",
  "Phone",
  "RoomType",
  "TotalAmount",
  "AdvancePaid",
  "BalanceAmount",
  "PaymentMode",
  "Notes",
  "UpdatedAt",
  "Discount",
  "BookingId",
];

function doGet(e) {
  e = e || {};
  e.parameter = e.parameter || {};

  const action = e.parameter.action || "list";
  const callback = e.parameter.callback || "callback";

  try {
    if (action !== "list") {
      return jsonp(callback, { ok: false, error: "Unknown action" });
    }

    const sheet = getSheet();
    migrateMissingBookingIds(sheet);

    const values = sheet.getDataRange().getValues();
    const rows = values.slice(1).filter((row) => row[0] && row[1]);
    const bookings = {};

    rows.forEach((row) => {
      const date = normalizeDate(row[0]);
      const roomId = String(row[1]);

      if (!bookings[date]) bookings[date] = {};

      bookings[date][roomId] = {
        name: String(row[2] || ""),
        phone: String(row[3] || ""),
        roomType: String(row[4] || ""),
        totalAmount: numberOrBlank(row[5]),
        advancePaid: numberOrBlank(row[6]),
        balanceAmount: numberOrBlank(row[7]),
        paymentMode: String(row[8] || ""),
        notes: String(row[9] || ""),
        updatedAt: String(row[10] || ""),
        discount: numberOrBlank(row[11]),
        bookingId: String(row[12] || ""),
      };
    });

    return jsonp(callback, { ok: true, bookings });
  } catch (error) {
    return jsonp(callback, {
      ok: false,
      error: errorMessage(error),
    });
  }
}

function doPost(e) {
  e = e || {};
  e.parameter = e.parameter || {};

  const action = e.parameter.action;
  const requestId = e.parameter.requestId || "";

  try {
    const sheet = getSheet();

    if (action === "saveMultiple") {
      const date = e.parameter.date;
      const name = e.parameter.name || "";
      const phone = e.parameter.phone || "";
      const totalAmount = Number(e.parameter.totalAmount || 0);
      const advancePaid = Number(e.parameter.advancePaid || 0);
      const balanceAmount = Number(e.parameter.balanceAmount || 0);
      const discount = Number(e.parameter.discount || 0);
      const paymentMode = e.parameter.paymentMode || "";
      const notes = e.parameter.notes || "";
      const bookingId = e.parameter.bookingId || createBookingId();
      const roomRows = JSON.parse(e.parameter.rooms || "[]");

      if (!date || !name || !roomRows.length) {
        return htmlResponse({
          source: "spss-sheet-sync",
          requestId,
          ok: false,
          error: "Missing date, customer name, or selected rooms.",
        });
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(20000);

      try {
        const timestamp = new Date().toISOString();

        roomRows.forEach((room, index) => {
          const roomId = String(room.roomId || "");
          const roomType = String(room.roomType || "");

          if (!roomId) throw new Error("A selected room has no RoomId.");

          const row = [
            date,
            roomId,
            name,
            phone,
            roomType,
            index === 0 ? totalAmount : "",
            index === 0 ? advancePaid : "",
            index === 0 ? balanceAmount : "",
            index === 0 ? paymentMode : "",
            notes,
            timestamp,
            index === 0 ? discount : "",
            bookingId,
          ];

          const rowIndex = findBookingRow(sheet, date, roomId);

          if (rowIndex > 0) {
            sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([row]);
          } else {
            sheet.appendRow(row);
          }
        });
      } finally {
        lock.releaseLock();
      }

      return htmlResponse({
        source: "spss-sheet-sync",
        requestId,
        ok: true,
        action,
        bookingId,
      });
    }

    const date = e.parameter.date;
    const roomId = e.parameter.roomId;

    if (!date || !roomId) {
      return htmlResponse({
        source: "spss-sheet-sync",
        requestId,
        ok: false,
        error: "Missing date or roomId.",
      });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
      const rowIndex = findBookingRow(sheet, date, roomId);

      if (action === "delete") {
        if (rowIndex > 0) sheet.deleteRow(rowIndex);

        return htmlResponse({
          source: "spss-sheet-sync",
          requestId,
          ok: true,
          action,
        });
      }

      if (action === "save") {
        const existingBookingId =
          rowIndex > 0
            ? String(sheet.getRange(rowIndex, 13).getValue() || "")
            : "";

        const bookingId = e.parameter.bookingId || existingBookingId || createBookingId();

        const row = [
          date,
          roomId,
          e.parameter.name || "",
          e.parameter.phone || "",
          e.parameter.roomType || "",
          Number(e.parameter.totalAmount || 0),
          Number(e.parameter.advancePaid || 0),
          Number(e.parameter.balanceAmount || 0),
          e.parameter.paymentMode || "",
          e.parameter.notes || "",
          new Date().toISOString(),
          Number(e.parameter.discount || 0),
          bookingId,
        ];

        if (rowIndex > 0) {
          sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([row]);
        } else {
          sheet.appendRow(row);
        }

        return htmlResponse({
          source: "spss-sheet-sync",
          requestId,
          ok: true,
          action,
          bookingId,
        });
      }

      return htmlResponse({
        source: "spss-sheet-sync",
        requestId,
        ok: false,
        error: "Unknown action.",
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return htmlResponse({
      source: "spss-sheet-sync",
      requestId,
      ok: false,
      error: errorMessage(error),
    });
  }
}

function getSheet() {
  const spreadsheet = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return sheet;
  }

  if (sheet.getLastColumn() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getLastColumn(), HEADERS.length - sheet.getLastColumn());
  }

  // Do not rewrite existing data. Only make sure the headers exist.
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  return sheet;
}

function migrateMissingBookingIds(sheet) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const bookingIdRange = sheet.getRange(2, 13, lastRow - 1, 1);
    const bookingIds = bookingIdRange.getValues();
    let changed = false;

    bookingIds.forEach((row, index) => {
      if (!row[0]) {
        row[0] = `LEGACY-${String(index + 1).padStart(6, "0")}`;
        changed = true;
      }
    });

    if (changed) bookingIdRange.setValues(bookingIds);
  } finally {
    lock.releaseLock();
  }
}

function findBookingRow(sheet, date, roomId) {
  const values = sheet.getDataRange().getValues();

  for (let index = 1; index < values.length; index += 1) {
    const sheetDate = normalizeDate(values[index][0]);
    const sheetRoomId = String(values[index][1] || "");

    if (sheetDate === String(date) && sheetRoomId === String(roomId)) {
      return index + 1;
    }
  }

  return -1;
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  }

  const text = String(value || "");
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function numberOrBlank(value) {
  if (value === "" || value === null || typeof value === "undefined") return "";
  const number = Number(value);
  return isNaN(number) ? "" : number;
}

function createBookingId() {
  const stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );
  const random = Utilities.getUuid().slice(0, 8).toUpperCase();
  return `BK-${stamp}-${random}`;
}

function errorMessage(error) {
  return String(error && error.message ? error.message : error);
}

function jsonp(callback, payload) {
  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function htmlResponse(payload) {
  const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");

  return HtmlService
    .createHtmlOutput(
      `<script>
        window.parent.postMessage(${safePayload}, "*");
      </script>`
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
