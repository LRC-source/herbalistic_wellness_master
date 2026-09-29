const fs = require('fs');
const itemsMap = JSON.parse(fs.readFileSync('square_items_map.json', 'utf8'));

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(',');
  const rows = [];
  for(let i=1; i<lines.length; i++) {
    let line = lines[i];
    let row = [];
    let inQuotes = false;
    let curr = '';
    for(let j=0; j<line.length; j++) {
      if(line[j] === '"') {
        inQuotes = !inQuotes;
      } else if(line[j] === ',' && !inQuotes) {
        row.push(curr);
        curr = '';
      } else {
        curr += line[j];
      }
    }
    row.push(curr);
    
    let obj = {};
    for(let j=0; j<headers.length; j++) {
      let key = headers[j].trim();
      obj[key] = row[j] ? row[j].trim() : '';
    }
    rows.push(obj);
  }
  return {headers, rows};
}

function escapeCSV(str) {
  if (str === null || str === undefined) return '';
  str = String(str);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const csvText = fs.readFileSync('downloaded_feed.csv', 'utf8');
const {headers, rows} = parseCSV(csvText);

let updatedCount = 0;

for(let row of rows) {
  // Extract slug and clean link
  let slug = '';
  if (row.link) {
    const parts = row.link.split('/');
    slug = parts[parts.length - 1] || parts[parts.length - 2];
    slug = slug.replace(/\?.*$/, '').replace(/#.*$/, '');
  }
  if (!slug && row.title) {
    slug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  
  row.link = 'https://herbalisticwellness.com/products/' + slug;

  let sku = row.id;
  let title = row.title;
  let match = itemsMap[sku.toLowerCase()] || itemsMap[title.toLowerCase()];
  
  if (!match) {
    const allKeys = Object.keys(itemsMap);
    let titleClean = title.split('-')[0].trim().toLowerCase();
    const possibleMatch = allKeys.find(k => k.includes(titleClean) || titleClean.includes(k));
    if (possibleMatch) match = itemsMap[possibleMatch];
  }

  if (match) {
    if (match.img1) {
      row.image_link = match.img1;
    }
    if (match.img2) {
      row.additional_image_link = match.img2;
    } else if (match.img1) {
      row.additional_image_link = match.img1;
    }
    row.availability = 'in_stock';
    updatedCount++;
  } else {
    // If we can't find it in Square, keep whatever image_link it had or duplicate it
    if (row.image_link && !row.additional_image_link) {
        row.additional_image_link = row.image_link;
    }
  }
}

let output = headers.map(h => escapeCSV(h.trim())).join(',') + '\n';
for(let row of rows) {
  let line = headers.map(h => escapeCSV(row[h.trim()])).join(',');
  output += line + '\n';
}

fs.writeFileSync('google_merchant_master_feed_updated.csv', output);
console.log('Successfully processed ' + rows.length + ' products. Updated images for ' + updatedCount + ' products.');
