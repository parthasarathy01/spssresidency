const SHEET_NAME = "Bookings";

function doGet(e) {
  const action = e.parameter.action || "list";
  const callback = e.parameter.callback || "callback";

  if (action !== "list") {
    return jsonp(callback, { ok: false, error: "Unknown action" });
  }

  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter((row) => row[0] && row[1]);
  const bookings = {};

  rows.forEach((row) => {
    const date = String(row[0]);
    const roomId = String(row[1]);
    if (!bookings[date]) bookings[date] = {};
    bookings[date][roomId] = {
      name: String(row[2] || ""),
      phone: String(row[3] || ""),
      notes: String(row[4] || ""),
      updatedAt: String(row[5] || ""),
    };
  });

  return jsonp(callback, { ok: true, bookings });
}

function doPost(e) {
  const action = e.parameter.action;
  const date = e.parameter.date;
  const roomId = e.parameter.roomId;

  if (!date || !roomId) {
    return text({ ok: false, error: "Missing date or roomId" });
  }

  const sheet = getSheet();
  const rowIndex = findBookingRow(sheet, date, roomId);

  if (action === "delete") {
    if (rowIndex > -1) sheet.deleteRow(rowIndex);
    return text({ ok: true });
  }

  if (action === "save") {
    const row = [
      date,
      roomId,
      e.parameter.name || "",
      e.parameter.phone || "",
      e.parameter.notes || "",
      new Date().toISOString(),
    ];

    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return text({ ok: true });
  }

  return text({ ok: false, error: "Unknown action" });
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Date", "RoomId", "Name", "Phone", "Notes", "UpdatedAt"]);
  }

  return sheet;
}

function findBookingRow(sheet, date, roomId) {
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) === String(date) && String(values[index][1]) === String(roomId)) {
      return index + 1;
    }
  }
  return -1;
}

function jsonp(callback, payload) {
  return ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}

function text(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
