const fs = require('fs');

const indexHtmlPath = 'C:/Users/lacar/Desktop/herbalistic_wellness_master_git/index.html';
const productsJsonPath = 'C:/Users/lacar/Desktop/herbalistic_wellness_master_git/products.json';

const products = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));
const books = products.filter(p => p.cat === 'books');

let html = fs.readFileSync(indexHtmlPath, 'utf8');

if (!html.includes("{id:'books',name:'Books'}")) {
  html = html.replace(
    "{id:'dried-herbs',name:'Dried Herbs'}",
    "{id:'dried-herbs',name:'Dried Herbs'},{id:'books',name:'Books'}"
  );
}

const productsStart = html.indexOf('products: [');
if (productsStart > -1) {
  // avoid double insertion
  if (html.indexOf('advanced-herbal-techniques-for-beginners') > -1 && html.indexOf('advanced-herbal-techniques-for-beginners') > productsStart && html.indexOf('advanced-herbal-techniques-for-beginners') < productsStart + 100000) {
      console.log('Books appear to already be in index.html products array.');
  } else {
      const insertionPoint = productsStart + 'products: ['.length;
      const booksStr = books.map(b => JSON.stringify(b, null, 4)).join(',\n') + ',';
      html = html.slice(0, insertionPoint) + '\n' + booksStr + '\n' + html.slice(insertionPoint);
      fs.writeFileSync(indexHtmlPath, html, 'utf8');
      console.log('index.html patched with books successfully.');
  }
} else {
  console.log('Could not find products array start.');
}
