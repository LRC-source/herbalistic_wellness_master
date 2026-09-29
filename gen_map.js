const fs = require('fs');

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

const text = fs.readFileSync('google_merchant_master_feed_updated.csv', 'utf8');
const {rows} = parseCSV(text);

const feedMap = {};
for(let row of rows) {
  const feedId = row.id;
  const link = row.link;
  if (link && link.includes('/products/')) {
    const slug = link.split('/products/')[1].replace(/"/g, '');
    feedMap[feedId] = slug;
  }
}
fs.writeFileSync('feed_map.json', JSON.stringify(feedMap, null, 2));
console.log('Map generated with ' + Object.keys(feedMap).length + ' keys.');
