window.renderAnnouncementBanner = function(data) {
  var existing = document.getElementById('global-announcement-banner');
  if (existing) {
    existing.remove();
  }

  // Remove existing banner styles if any
  var existingStyle = document.querySelector('style[data-banner-style]');
  if (existingStyle) {
    existingStyle.remove();
  }

  var isActive = data && (data.active || data.is_active);
  var bannerText = data && (data.text || data.banner_text);
  var bannerLink = data && (data.link || data.banner_link);

  if (isActive && bannerText) {
    // Create CSS style elements
    var style = document.createElement('style');
    style.setAttribute('data-banner-style', 'true');
    style.innerHTML = `
      .dynamic-announcement-banner {
        background: linear-gradient(90deg, #132219 0%, #1f3627 50%, #132219 100%);
        color: #FAF9F6;
        text-align: center;
        padding: 8px 16px;
        font-size: 11px;
        font-family: 'Jost', 'Inter', sans-serif;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        position: relative;
        z-index: 10000;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        box-sizing: border-box;
        border-bottom: 1px solid rgba(230, 176, 128, 0.15);
        max-height: 40px;
        line-height: 1.4;
      }
      .dynamic-announcement-banner span {
        color: #FAF9F6;
      }
      .dynamic-announcement-banner a {
        color: #E6B080; /* Warm Amber accent */
        text-decoration: underline;
        margin-left: 8px;
        font-weight: 600;
        transition: color 0.2s ease;
      }
      .dynamic-announcement-banner a:hover {
        color: #90a880; /* Sage accent blend */
        text-decoration: none;
      }
      @media (max-width: 600px) {
        .dynamic-announcement-banner {
          font-size: 10px;
          padding: 8px 12px;
          max-height: 45px; /* slightly more room for wrap */
        }
      }
    `;
    document.head.appendChild(style);

    // Create HTML banner element
    var banner = document.createElement('div');
    banner.id = 'global-announcement-banner';
    banner.className = 'dynamic-announcement-banner';
    
    var textSpan = document.createElement('span');
    textSpan.textContent = bannerText;
    banner.appendChild(textSpan);

    if (bannerLink) {
      var link = document.createElement('a');
      link.href = bannerLink;
      link.innerHTML = 'Learn More &rarr;';
      banner.appendChild(link);
    }

    // Insert at the absolute top of the body element
    document.body.insertBefore(banner, document.body.firstChild);
  }
};

// Auto load banner on DOM load
document.addEventListener('DOMContentLoaded', function() {
  fetch('announcement_banner_api.php')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      window.renderAnnouncementBanner(data);
    })
    .catch(function(err) {
      console.warn('Failed to load announcement banner:', err);
    });
});
