# SPSS Residency Website

Modern static website for SPSS Residency, Nagalapuram.

## Files

- `index.html` - page content and sections
- `styles.css` - visual design and responsive layout
- `script.js` - WhatsApp booking form, sticky header, gallery lightbox
- `assets/` - hotel photos

## Preview locally

Use any simple static server from this folder. For example:

```bash
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg'};http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/' )p='/index.html';const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(d)})}).listen(4173,'127.0.0.1',()=>console.log('http://localhost:4173'))"
```

## Updating Photos

Add new images to `assets/`, then add a new gallery button in `index.html` inside the `data-gallery` section.

## Updating Announcements

Use the `announcements` section in `index.html` for temporary posters such as poojas, temple timings, waterfall season
updates, offers, or new room announcements. Add the image to `assets/`, then replace one of the
`announcement-placeholder` cards or duplicate the existing `announcement-feature` card.

## Booking Number

WhatsApp booking is configured in `script.js`:

```js
const whatsappNumber = "919790891558";
```

## Owner Room Calendar

The internal booking page is `owner-calendar.html`. It lets you select a year/date and mark any of the 11 rooms as
booked with customer name, mobile number, and notes.

Important: this first version stores data in the current browser using `localStorage`. It is useful on one shared
computer/browser. For live shared use across different phones or computers, connect this page to a shared database such
as Firebase, Supabase, or Google Sheets.

### Google Sheets Sync

Use `google-sheets-apps-script.gs` to create a free Google Sheets backend:

1. Create a new Google Sheet named `SPSS Room Bookings`.
2. In the sheet, open `Extensions > Apps Script`.
3. Paste the full contents of `google-sheets-apps-script.gs`.
4. Optional but recommended: copy the Sheet ID from your Google Sheet URL and paste it into `SPREADSHEET_ID` in the Apps Script.
4. Click `Deploy > New deployment`.
5. Choose type `Web app`.
6. Set `Execute as` to `Me`.
7. Set `Who has access` to `Anyone`.
8. Deploy and copy the Web App URL.
9. In `owner-calendar.js`, paste that URL into:

```js
const googleSheetWebAppUrl = "";
```

After that, upload `owner-calendar.js` again. The owner calendar will load and save bookings through Google Sheets.

If sync fails, open this URL in a browser after replacing `YOUR_WEB_APP_URL`:

```text
YOUR_WEB_APP_URL?action=list&callback=test
```

It should show text like `test({"ok":true,"bookings":{}});`. If it shows a Google sign-in page, the Web App access is
not set to `Anyone`. If it shows an authorization or spreadsheet error, redeploy after authorizing the Apps Script.
