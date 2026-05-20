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
