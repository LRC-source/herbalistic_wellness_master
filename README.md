# Herbalistic Wellness 🌿

![Status: Production](https://img.shields.io/badge/Status-Production-success)
![Tech Stack: HTML/CSS/JS/PHP](https://img.shields.io/badge/Tech_Stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20PHP-blue)
![Hosting: Bluehost](https://img.shields.io/badge/Hosting-Bluehost-blueviolet)

## Executive Summary / Overview
Herbalistic Wellness is a comprehensive e-commerce and informational platform dedicated to providing holistic health solutions, herbal catalogs, and a streamlined purchasing journey. The platform solves the operational challenge of managing a large inventory of wellness products and seamlessly integrating digital storefront operations with secure checkout mechanisms and backend inventory updates. It serves as a unified digital ecosystem for users seeking wellness products, complete with a modern frontend experience.

## Architecture & Tech Stack Breakdown
The repository follows a traditional monolithic architecture utilizing standard web technologies alongside custom PHP backend scripts for handling API integrations and business logic:

### Frontend
- **HTML5 / CSS3**: Responsive page templates (`index.html`, `checkout.html`, `products.html`, etc.) styled with `styles.css`.
- **JavaScript (Vanilla)**: Core application logic (`app.js`), customized checkout behavior (`checkout.js`), experimental WebGL components (`webgl-pipeline.js`), and audio interaction logic (`audio-engine.js`).

### Backend
- **PHP 8.x**: Core backend logic handling checkout processes (`checkout.php`), catalog synchronization (`products.php`), Square API integrations (`push_to_square.php`), and image uploads (`upload_image.php`).
- **Data Storage**: File-based JSON data stores (`products.json`, `products_cache.json`) for quick catalog access.
- **Server Configuration**: Apache configuration via `.htaccess` for URL routing and security.

### Integrations & Services
- **Square API**: E-commerce payment processing and inventory synchronization.
- **Google OAuth / Apps Script**: Secure authentication popups and sheet receivers for form and analytics integration.
- **Hosting**: Bluehost (cPanel / FTP deployment).

## Key Features & Capabilities
- **E-Commerce Checkout Pipeline**: End-to-end shopping cart functionality integrated with Square.
- **Dynamic Catalog Management**: Automated JSON-based product fetching and caching for high-performance load times.
- **Advanced Media Pipelines**: Incorporation of WebGL rendering and custom audio engines for an immersive user experience.
- **SEO & Tracking**: Pre-configured `sitemap.xml`, `robots.txt`, and comprehensive tracking endpoints (`track.php`).
- **Role-Based Workflows**: Custom landing pages for affiliates (`affiliate-marketplace.html`), wholesale shoppers (`wholesale-shopping.html`), and alumni (`alumni-discount.html`).

## Setup & Installation Guide

### Prerequisites
- PHP 8.x or higher installed locally (for testing).
- Apache or Nginx server (if running locally, XAMPP/MAMP are recommended).
- Valid `.env` configuration (see below).

### Installation Steps
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd herbalistic_wellness_master_git
   ```
2. **Environment Configuration**:
   Create a `.env` file in the root directory based on `.env.example`. Make sure to populate the required Square API keys and Google OAuth credentials.
3. **Local Development Server**:
   Start a local PHP development server:
   ```bash
   php -S localhost:8000
   ```
4. **Access the Site**:
   Navigate to `http://localhost:8000` in your web browser.

### Deployment
Refer to `SERVER_SETUP_INSTRUCTIONS.txt` and `BLUEHOST_TOKEN_SETUP.txt` for deploying to Bluehost and configuring sync tokens.

## Architect / Author Attribution
**Full-stack web application development and automated digital operations by LRC.** 
Built with a focus on high-performance digital commerce, secure data handling, and scalable front-end architecture.
