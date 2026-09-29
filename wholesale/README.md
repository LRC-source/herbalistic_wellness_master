# LRC Wholesale Portal — B2B E-Commerce & Inventory Management Platform

[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-00E676?style=for-the-badge&logo=vercel)](https://herbalisticwellness.com/wholesale)
[![Tech Stack](https://img.shields.io/badge/Stack-PHP%20%7C%20Vanilla%20JS%20%7C%20Square-9B6FFF?style=for-the-badge)](#)
[![Backend: File-Based NoSQL](https://img.shields.io/badge/Backend-JSON%20%2B%20Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google)](#)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary%20%2F%20LRC-D4AF37?style=for-the-badge)](#)

---

## 🏢 Executive Summary

The **LRC Wholesale Portal** is an enterprise-grade B2B e-commerce platform built to manage high-volume wholesale partnerships, real-time inventory overriding, and complex logistical checkout calculations. Designed to bypass the limitations of standard e-commerce plugins, this application acts as a standalone portal allowing verified retailers to quickly order bulk units, calculate dynamic weight-based shipping logistics, and process secure payments or net-terms financing through Square.

This project showcases robust server-side processing without a heavy SQL database—utilizing secure JSON file-based NoSQL architecture for instant reads/writes, coupled with automated Google Apps Script webhooks to synchronize incoming orders with administrative Google Sheets.

---

## ⚙️ Architecture & Tech Stack

* **Frontend:** HTML5, Tailwind CSS (via CDN), Vanilla ES6 JavaScript
* **Backend:** PHP 7.4+ (Custom routing & file processing)
* **Database:** Flat-file JSON NoSQL architecture (`catalog.json`)
* **Payments:** Square Web Payments SDK (Credit Card & Afterpay/Clearpay integration)
* **Automation:** Google Apps Script Webhooks (Order tracking and synchronization)
* **Security:** Built-in WAF anti-bot auto-bypass, strict MIME-type image verification, PHP Output Buffering for XSS/Error sanitization.

---

## ✨ Key Features & Capabilities

* **Dynamic Weight-Based Shipping Math:** Automatically aggregates line-item ounce weights, converts to pounds, and calculates tiered logistics fees (e.g., handling baseline + $19.50 per 15 lbs overage).
* **Inventory Control Dashboard:** A secure administrative backend that allows store managers to instantly override stock statuses (Published / In Stock) and upload 4K product imagery with client-side compression alerts.
* **Persistent LocalStorage Pipeline:** Cart sessions survive page reloads and browser closures seamlessly without requiring heavy session tokens or database hits until the point of checkout.
* **Intelligent Square Integration:** Full API integration for instant processing of standard Card payments alongside B2B Afterpay financing workflows, applying dynamic percentage-based surcharges dynamically at checkout.

---

## 🚀 Setup & Installation Guide

### Prerequisites
* A PHP-compatible web server (Apache/Nginx).
* A Square Developer Account (for Application ID and Location ID).

### Local Deployment
1. **Clone the repository:**
   ```bash
   git clone https://github.com/LRC-source/wholesale-portal.git
   cd wholesale-portal
   ```

2. **Configure Environment Variables:**
   Create a `.env` (or configure your PHP server variables) for the Square Sandbox:
   ```ini
   SQUARE_APP_ID="sandbox-sq0idb-..."
   SQUARE_LOCATION_ID="L..."
   GAS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
   ```
   *Note: Update the hardcoded keys in `checkout.php` if injecting securely via server variables.*

3. **Set Directory Permissions:**
   Ensure your web server has write access to the catalog and image directories.
   ```bash
   chmod 666 catalog.json
   chmod -R 775 assets/images/products/
   ```

4. **Launch Local Server:**
   ```bash
   php -S localhost:8000
   ```
   Navigate to `http://localhost:8000/index.html` to view the master catalog.

---

## 👨‍💻 Architect

**LRC Source**  
*Digital Agency & Full-Stack Development*  
Showcasing elite operational solutions bridging business logistics and technical architecture.
