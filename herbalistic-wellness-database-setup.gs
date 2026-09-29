$tempDir = New-Item -ItemType Directory -Force -Path ".\temp_deploy"

# Copy files
$files = @(
    "index.html", "app.js", "app-live.js", "data.js", "styles.css", 
    "webgl-pipeline.js", "audio-engine.js", "logo.png", 
    "404.html", "affiliate-marketplace.html", "alumni-discount.html", 
    "privacy-policy.html", "refund-policy.html", "reviews.html", 
    "shipping-policy-faq.html", "wholesale-shopping.html", 
    "wishlist.html", "google-oauth-popup.html", "checkout.php", 
    "start_backend.php", ".htaccess", "herbalistic-wellness-sheets-receiver.gs", 
    "herbalistic-wellness-database-setup.gs", "sitemap.xml"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $tempDir -ErrorAction SilentlyContinue
    }
}

if (Test-Path "assets") {
    Copy-Item -Path "assets" -Destination $tempDir -Recurse -ErrorAction SilentlyContinue
}
if (Test-Path "brand") {
    Copy-Item -Path "brand" -Destination $tempDir -Recurse -ErrorAction SilentlyContinue
}

# Compress using tar.exe (robust against file locks and handles paths better)
tar.exe -a -c -f ".\herbalistic_wellness_deploy.zip" -C $tempDir .

# Clean up
Remove-Item -Path $tempDir -Recurse -Force
