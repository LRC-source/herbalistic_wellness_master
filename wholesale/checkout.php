<?php
// checkout.php - Square SDK Live Production Checkout Integration

// 1. Intercept API POST requests for Square Payment Processing
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $req = json_decode($raw, true);

    if (isset($req['sourceId'])) {
        header('Content-Type: application/json');
        
        $sourceId = $req['sourceId'];
        $amountInCents = (int)round((float)$req['total'] * 100);
        $productionAccessToken = getenv('SQUARE_ACCESS_TOKEN') ?: 'EAAAl61nPYCaLTz2-d3zvSvz6bSKDfZaH83MbWVQXA3Bsm_nrUkuEDQXcZebzMq4';
        $idempotencyKey = bin2hex(random_bytes(16));

        $squarePayload = [
            'source_id'            => $sourceId,
            'idempotency_key'      => $idempotencyKey,
            'amount_money'         => [
                'amount'   => $amountInCents,
                'currency' => 'USD'
            ],
            'buyer_email_address'  => $req['email'] ?? '',
            'note'                 => 'Herbalistic Wellness Wholesale Order'
        ];

        // Send cURL Request to Square Production Payments API
        $ch = curl_init('https://connect.squareup.com/v2/payments');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($squarePayload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $productionAccessToken,
            'Content-Type: application/json',
            'Square-Version: 2026-06-06'
        ]);

        $response = curl_exec($ch);
        $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $responseObj = json_decode($response, true);

        if ($httpStatus === 200 && isset($responseObj['payment'])) {
            echo json_encode(['success' => true, 'transactionId' => $responseObj['payment']['id']]);
        } else {
            echo json_encode(['success' => false, 'error' => $responseObj['errors'][0]['detail'] ?? 'Payment failed', 'raw' => $responseObj]);
        }
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wholesale Secure Checkout | Herbalistic Wellness</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="styles.css">
    
    <!-- Square Web Payments SDK - LIVE PRODUCTION -->
    <script src="https://web.squarecdn.com/v1/square.js"></script>
    <script>
        const appId = 'sq0idp-jw760RR9HEUoeIUXosaCxw';
        const locationId = 'BGW0EEK56YNKC';
        const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwkeRyHe8RHcF137WBvrGsDJUapUH9OVF_bOtbOC0FNXTYR4O0aPwRNhCQhYQZrhOEp/exec'; // Live Apps Script Web App URL

        function calculateShippingFee(totalWeightLbs) {
            if (totalWeightLbs < 1.0) return 6.50;
            if (totalWeightLbs < 3.0) return 10.50;
            if (totalWeightLbs < 5.0) return 14.50;
            
            let fee = 19.50;
            if (totalWeightLbs > 5.0) {
                // For every additional 15 lbs over 5 lbs, add 19.50
                let extraWeight = totalWeightLbs - 5.0;
                let additionalTiers = Math.ceil(extraWeight / 15.0);
                fee += (additionalTiers * 19.50);
            }
            return fee;
        }

        async function initializeSquare() {
            if (!window.Square) {
                console.error('Square.js failed to load properly');
                return;
            }

            // Pull real cart from LocalStorage
            let cartItems = JSON.parse(localStorage.getItem('hw_wholesale_cart')) || [];
            
            // Fetch catalog to determine real-time item weights
            let totalWeightOunces = 0;
            let subtotal = 0;
            
            try {
                const catalogResp = await fetch('/wholesale/catalog.json?t=' + new Date().getTime());
                const catalogData = await catalogResp.json();
                
                const container = document.getElementById('cart-items-container');
                container.innerHTML = ''; // clear demo items
                
                cartItems.forEach(cartItem => {
                    const lineTotal = cartItem.price * cartItem.qty;
                    subtotal += lineTotal;
                    
                    // Render HTML
                    container.innerHTML += `
                        <div class="flex justify-between">
                            <span>${cartItem.name} (x${cartItem.qty})</span>
                            <span>$${lineTotal.toFixed(2)}</span>
                        </div>
                    `;

                    // Match by exact title logic
                    const catItem = catalogData.data.find(p => p.title.trim().toLowerCase() === cartItem.name.trim().toLowerCase());
                    if (catItem && catItem.shipping_weight) {
                        const ozMatch = catItem.shipping_weight.match(/([\d\.]+)/);
                        if (ozMatch) {
                            const unitWeight = parseFloat(ozMatch[1]);
                            totalWeightOunces += (unitWeight * cartItem.qty);
                        }
                    }
                });
            } catch(e) {
                console.error("Failed to fetch catalog weights:", e);
            }

            const totalWeightLbs = totalWeightOunces / 16.0;
            
            // Apply 6% Tax
            const taxAmount = parseFloat((subtotal * 0.06).toFixed(2));
            
            // Apply 2.3% Surcharge based on total order BEFORE shipping is applied
            const totalBeforeShipping = subtotal + taxAmount;
            const surcharge = parseFloat((totalBeforeShipping * 0.023).toFixed(2));
            
            // Apply HW Weight-Based Shipping Logic
            const shippingFee = calculateShippingFee(totalWeightLbs);
            
            const finalTotal = (subtotal + taxAmount + surcharge + shippingFee).toFixed(2);
            
            // Update UI dynamically
            document.getElementById('summary-subtotal').textContent = '$' + subtotal.toFixed(2);
            document.getElementById('summary-tax').textContent = '$' + taxAmount.toFixed(2);
            document.getElementById('summary-surcharge').textContent = '$' + surcharge.toFixed(2);
            document.getElementById('summary-shipping').textContent = '$' + shippingFee.toFixed(2) + ' (' + totalWeightLbs.toFixed(2) + ' lbs)';
            document.getElementById('summary-total').textContent = '$' + finalTotal;

            try {
                const payments = window.Square.payments(appId, locationId);
                
                // Initialize Card Payment
                const card = await payments.card();
                await card.attach('#card-container');

                // Initialize Afterpay/Clearpay for Wholesale Financing
                const paymentRequest = payments.paymentRequest({
                    countryCode: 'US',
                    currencyCode: 'USD',
                    total: {
                        amount: finalTotal.toString(),
                        label: 'Wholesale Order Total'
                    }
                });
                
                const afterpay = await payments.afterpayClearpay(paymentRequest);
                await afterpay.attach('#afterpay-container');

                afterpay.addEventListener('click', async () => {
                    try {
                        const result = await afterpay.tokenize();
                        if (result.status === 'OK') {
                            console.log('Afterpay Token:', result.token);
                            
                            // Send token to backend
                            const paymentResponse = await fetch('checkout.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    sourceId: result.token,
                                    total: finalTotal,
                                    email: document.getElementById('contact-email').value || "N/A"
                                })
                            });
                            const paymentResult = await paymentResponse.json();
                            
                            if (paymentResult.success) {
                                const orderPayload = {
                                type: "new_order",
                                order_id: "HW-" + Math.floor(Math.random() * 1000000),
                                business_name: document.getElementById('business-name').value || "Guest Business",
                                contact_name: document.getElementById('contact-name').value || "N/A",
                                email: document.getElementById('contact-email').value || "N/A",
                                shipping_address: document.getElementById('shipping-address').value || "N/A",
                                billing_address: document.getElementById('billing-address').value || "N/A",
                                user_tier: document.getElementById('user-tier').value || "Tier 1",
                                total: finalTotal,
                                tax: taxAmount.toFixed(2),
                                surcharge: surcharge.toFixed(2),
                                shipping_fee: shippingFee.toFixed(2),
                                payment_method: "Afterpay",
                                items: cartItems
                            };

                            if(GAS_WEBHOOK_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_WEBHOOK_URL') {
                                await fetch(GAS_WEBHOOK_URL, {
                                    method: 'POST',
                                    mode: 'no-cors',
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(orderPayload)
                                });
                            }

                            alert('Wholesale Order Processed Successfully! Your fulfillment pipeline has been updated.');
                            localStorage.removeItem('hw_wholesale_cart');
                            window.location.href = "/wholesale/thank-you";
                            } else {
                                alert("Card Payment failed: " + (paymentResult.error || "Please try again."));
                                btn.textContent = 'Pay Now';
                                btn.disabled = false;
                            }
                        } else {
                                alert("Afterpay Payment failed: " + (paymentResult.error || "Please try again."));
                            }
                        }
                    } catch (e) {
                        console.error('Afterpay Error:', e);
                        alert("Afterpay failed. Please ensure all shipping/billing fields are filled.");
                    }
                });

                document.getElementById('card-button').addEventListener('click', async () => {
                    const btn = document.getElementById('card-button');
                    btn.textContent = 'Processing...';
                    btn.disabled = true;

                    try {
                        const result = await card.tokenize();
                        if (result.status === 'OK') {
                            console.log('Payment Token:', result.token);
                            
                            // Send token to backend
                            const paymentResponse = await fetch('checkout.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    sourceId: result.token,
                                    total: finalTotal,
                                    email: document.getElementById('contact-email').value || "N/A"
                                })
                            });
                            const paymentResult = await paymentResponse.json();
                            
                            if (paymentResult.success) {
                                const orderPayload = {
                                type: "new_order",
                                order_id: "HW-" + Math.floor(Math.random() * 1000000),
                                business_name: document.getElementById('business-name').value || "Guest Business",
                                contact_name: document.getElementById('contact-name').value || "N/A",
                                email: document.getElementById('contact-email').value || "N/A",
                                shipping_address: document.getElementById('shipping-address').value || "N/A",
                                billing_address: document.getElementById('billing-address').value || "N/A",
                                user_tier: document.getElementById('user-tier').value || "Tier 1",
                                total: finalTotal,
                                tax: taxAmount.toFixed(2),
                                surcharge: surcharge.toFixed(2),
                                shipping_fee: shippingFee.toFixed(2),
                                payment_method: "Square Live SDK",
                                items: cartItems
                            };

                            // Send to Google Sheets Wholesale Database
                            if(GAS_WEBHOOK_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_WEBHOOK_URL') {
                                await fetch(GAS_WEBHOOK_URL, {
                                    method: 'POST',
                                    body: JSON.stringify(orderPayload)
                                });
                            }

                            alert('Wholesale Order Processed Successfully! Your fulfillment pipeline has been updated.');
                            window.location.href = '/wholesale/index';
                        }
                    } catch (e) {
                        console.error(e);
                        btn.textContent = 'Pay Wholesale Total';
                        btn.disabled = false;
                    }
                });

            } catch (e) {
                console.error('Square Initialization Error:', e);
            }
        }

        document.addEventListener('DOMContentLoaded', initializeSquare);
    </script>
</head>
<body class="bg-gray-50 flex flex-col min-h-screen">
    <header class="bg-[#482C6A] text-[#FAF9F6] sticky top-0 z-50 shadow-md">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between items-center h-20">
                <a href="/wholesale/index" class="flex items-center gap-3 no-underline">
                    <img src="https://www.herbalisticwellness.com/assets/images/logo.png" alt="Herbalistic Wellness Logo" class="h-12 w-auto" onerror="this.onerror=null; this.src='https://www.herbalisticwellness.com/assets/images/logo-light.png';">
                    <span class="font-heading text-2xl tracking-wide text-[#FAF9F6] hidden md:inline">Wholesale Checkout</span>
                </a>
                <a href="/wholesale/index" class="text-sm hover:underline">Return to Catalog</a>
            </div>
        </div>
    </header>

    <main class="flex-grow max-w-6xl mx-auto px-4 py-16 w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <!-- Left Column: Customer Info & Order Summary -->
        <div class="space-y-8">
            <div class="bg-white p-8 rounded-lg shadow-sm border-t-4 border-[#D88C43]">
                <h2 class="font-heading text-2xl text-[#482C6A] mb-6">Shipping & Billing Details</h2>
                <div class="space-y-4 text-sm">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-gray-700 font-bold mb-1">Business Name *</label>
                            <input type="text" id="business-name" class="w-full p-2 border rounded" placeholder="Your Business LLC" required>
                        </div>
                        <div>
                            <label class="block text-gray-700 font-bold mb-1">Contact Name (First & Last) *</label>
                            <input type="text" id="contact-name" class="w-full p-2 border rounded" placeholder="Jane Doe" required>
                        </div>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-bold mb-1">Contact Email *</label>
                        <input type="email" id="contact-email" class="w-full p-2 border rounded" placeholder="jane@business.com" required>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-bold mb-1">Shipping Address *</label>
                        <textarea id="shipping-address" class="w-full p-2 border rounded" rows="2" placeholder="123 Wholesale Blvd, Suite 100, City, ST 12345" required></textarea>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-bold mb-1">Billing Address *</label>
                        <textarea id="billing-address" class="w-full p-2 border rounded" rows="2" placeholder="Same as shipping" required></textarea>
                    </div>
                    <div>
                        <label class="block text-gray-700 font-bold mb-1">Assigned Partner Tier</label>
                        <input type="text" id="user-tier" class="w-full p-2 border rounded bg-gray-100 text-gray-600 cursor-not-allowed" value="Tier 1" readonly>
                        <p class="text-xs text-gray-500 mt-1">Tier assigned automatically by wholesale account standing.</p>
                    </div>
                </div>
            </div>

            <div class="bg-white p-8 rounded-lg shadow-sm border-t-4 border-gray-300">
                <h2 class="font-heading text-2xl text-[#482C6A] mb-6">Order Summary</h2>
                <div class="space-y-4 mb-4 border-b pb-4 text-sm" id="cart-items-container">
                    <!-- Dynamic cart items would go here. For demo, we have the two hardcoded items -->
                    <div class="flex justify-between">
                        <span>Arnica Flower Dried Organic - 1oz (x24)</span>
                        <span>$158.40</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Arnica Oil - 1oz (x24)</span>
                        <span>$290.40</span>
                    </div>
                </div>
                
                <!-- Tax & Shipping Logic Applied -->
                <div class="space-y-2 mb-4 border-b pb-4 text-sm text-gray-600">
                    <div class="flex justify-between">
                        <span>Subtotal</span>
                        <span id="summary-subtotal">$448.80</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Estimated Tax (6%)</span>
                        <span id="summary-tax">$26.93</span>
                    </div>
                    <div class="flex justify-between text-[#D88C43]">
                        <span>Payment Processing Surcharge (2.3%)</span>
                        <span id="summary-surcharge">$10.94</span>
                    </div>
                    <div class="flex justify-between font-medium">
                        <span>Shipping (Wholesale Rate)</span>
                        <span id="summary-shipping">$14.50</span>
                    </div>
                </div>

                <div class="flex justify-between font-bold text-xl text-[#482C6A]">
                    <span>Total</span>
                    <span id="summary-total">$501.17</span>
                </div>
            </div>
        </div>

        <!-- Right Column: Square Payment Container -->
        <div>
            <div class="bg-white p-8 rounded-lg shadow-sm border-t-4 border-[#482C6A] sticky top-24">
                <h2 class="font-heading text-2xl text-[#482C6A] mb-6">Payment</h2>
                <p class="text-xs text-gray-500 mb-6">Secured by Square Live Production SDK. Wholesale accounts are not eligible for in-house credit.</p>
                
                <form id="payment-form" class="space-y-6">
                    <div>
                        <h3 class="font-bold text-gray-700 mb-3">Credit / Debit Card</h3>
                        <div id="card-container" class="min-h-[80px] p-2 border rounded"></div>
                        <button id="card-button" type="button" class="w-full bg-[#482C6A] text-white font-bold py-3 rounded hover:opacity-90 transition mt-4">Pay Wholesale Total</button>
                    </div>
                    
                    <div class="relative flex py-4 items-center">
                        <div class="flex-grow border-t border-gray-300"></div>
                        <span class="flex-shrink-0 mx-4 text-gray-400 text-sm">OR</span>
                        <div class="flex-grow border-t border-gray-300"></div>
                    </div>

                    <div>
                        <h3 class="font-bold text-gray-700 mb-3">Buy Now, Pay Later</h3>
                        <p class="text-xs text-gray-500 mb-3">Need to split your wholesale cost? Use Afterpay.</p>
                        <div id="afterpay-container" class="min-h-[50px]"></div>
                    </div>
                </form>
            </div>
        </div>
    </main>
</body>
</html>


