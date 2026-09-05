# Herbalistic Wellness – E-Commerce & Apothecary Platform

![Status: Production](https://img.shields.io/badge/Status-Production-success?style=for-the-badge)
![Tech Stack: Vanilla JS / PHP](https://img.shields.io/badge/Tech_Stack-Vanilla_JS_%7C_PHP-blue?style=for-the-badge)
![Payments: Square SDK](https://img.shields.io/badge/Payments-Square_SDK-lightgrey?style=for-the-badge)
![Database: Google Sheets API](https://img.shields.io/badge/Database-Google_Sheets_API-green?style=for-the-badge)

## Executive Summary / Overview

The Herbalistic Wellness Platform is a fully custom, high-performance retail and wholesale e-commerce web application. Designed to eliminate the overhead of traditional CMS platforms like WordPress or Shopify, this system leverages a lightweight Single Page Application (SPA) architecture combined with secure PHP backend endpoints. It solves the critical business need for a highly customizable, zero-latency shopping experience that integrates directly with Square for payments and Google Sheets for inventory management.

## Architecture & Tech Stack Breakdown

*   **Frontend UI/UX:** HTML5, CSS3, Vanilla JavaScript (ES6+), custom responsive grid systems.
*   **Routing:** Custom vanilla JS SPA router enabling instantaneous page transitions with clean URLs and strict .htaccess fallback logic.
*   **Backend / Middleware:** Secure PHP API endpoints for handling cart validation, inventory syncing, and review management.
*   **Database / CRM:** Real-time data hydration using products.json background syncing and Google Apps Script endpoints for automated lead generation.
*   **Payment Gateway:** Square Web Payments SDK for secure, PCI-compliant checkout flows.

## Key Features & Capabilities

*   **Non-Destructive Live Sync:** Background API polling silently updates prices and product reviews on mobile and desktop clients without interrupting the user layout.
*   **Wholesale & Retail Segmentation:** Distinct portals and pricing logic separating standard retail consumers from B2B wholesale partners.
*   **Zero-Flicker SPA Routing:** Advanced pre-rendering and routing logic prevents UI flashes during page transitions, mimicking a static site experience.
*   **Integrated Admin Dashboard:** Localized, browser-based administrative controls for managing product visibility, discount codes, and customer reviews.
*   **Automated Cart Validation:** Server-side and client-side cart verification preventing out-of-stock purchases or tampered pricing.

## Setup & Installation Guide

1.  **Clone the Repository:**
    `ash
    git clone https://github.com/LRC-source/herbalistic_wellness_master.git
    cd herbalistic_wellness_master
    `
2.  **Configure Environment Variables:**
    *   Duplicate .env.example to .env.
    *   Insert your Square Application ID and Location ID.
3.  **Local Server Deployment:**
    *   Due to PHP backend requirements, host the directory using a local LAMP/MAMP stack or PHP's built-in server:
    `ash
    php -S localhost:8000
    `
4.  **Security Notice:**
    *   Ensure all *.php and .json cache files remain excluded from public version control as defined in the .gitignore.

## Architect / Author Attribution

**Designed and engineered by LRC-source.**
Focusing on full-stack web application development, automated digital operations, and bespoke e-commerce architectures.
