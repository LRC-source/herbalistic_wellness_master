/**
 * Herbalistic Wellness Wholesale Database - Advanced Tracking & Notifications System
 * 
 * Instructions:
 * 1. Open your Google Sheet named "Herbalistic Wellness Wholesale Database".
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this entire code, completely overwriting anything currently there.
 * 4. Save the project (click the floppy disk icon).
 * 5. Run the "Initial Setup" from the custom "Wholesale Admin" menu in your Sheet.
 * 6. Click Deploy > New Deployment > Web App (Execute as: Me, Access: Anyone).
 */

var ADMIN_EMAIL = "lacarmsu38@gmail.com";

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Wholesale Admin')
      .addItem('Initial Setup & Activate Daily Trackers', 'setupDatabaseAndTriggers')
      .addItem('Run Manual System Check Now', 'dailySystemChecker')
      .addToUi();
}

// 1. Core Setup & Automated Triggers
function setupDatabaseAndTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create or verify Orders Sheet
  var ordersSheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
  if (ordersSheet.getLastRow() === 0) {
    ordersSheet.appendRow(["Timestamp", "Order ID", "Business Name", "Contact Name", "Contact Email", "Shipping Address", "Billing Address", "User Tier", "Order Total", "Payment Method", "Fulfillment Status", "Item Breakdown"]);
    ordersSheet.getRange("A1:L1").setFontWeight("bold").setBackground("#482C6A").setFontColor("#FAF9F6");
    ordersSheet.setFrozenRows(1);
  }

  // Create or verify Applications Sheet
  var appsSheet = ss.getSheetByName("Applications") || ss.insertSheet("Applications");
  if (appsSheet.getLastRow() === 0) {
    appsSheet.appendRow(["Timestamp", "Business Name", "Contact Name", "Phone", "Email", "Tax ID", "Business Type", "Status"]);
    appsSheet.getRange("A1:H1").setFontWeight("bold").setBackground("#482C6A").setFontColor("#FAF9F6");
    appsSheet.setFrozenRows(1);
  }

  // Create Tier 1, Tier 2, Tier 3 Partner Sheets
  var tiers = ["Tier 1 Partners", "Tier 2 Partners", "Tier 3 (White Label)"];
  tiers.forEach(function(tier) {
    var tierSheet = ss.getSheetByName(tier) || ss.insertSheet(tier);
    if (tierSheet.getLastRow() === 0) {
      tierSheet.appendRow(["Date Approved", "Business Name", "Contact Name", "Email", "Phone", "Tax ID", "Notes"]);
      tierSheet.getRange("A1:G1").setFontWeight("bold").setBackground("#D88C43").setFontColor("#FAF9F6");
      tierSheet.setFrozenRows(1);
    }
  });

  // Create or verify System Logs
  var logSheet = ss.getSheetByName("System Logs") || ss.insertSheet("System Logs");
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(["Timestamp", "Event Type", "Details", "Status"]);
    logSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#666666").setFontColor("#FAF9F6");
    logSheet.setFrozenRows(1);
  }

  setupDailyTrigger();
  SpreadsheetApp.getUi().alert("✅ Database Architecture Complete!\n\nAdded comprehensive Order tracking, Tier 1/2/3 sheets, and activated Daily Email Trackers.");
}

function setupDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() == "dailySystemChecker") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("dailySystemChecker").timeBased().atHour(8).everyDays(1).create();
}

// 2. Real-Time Webhook Listener
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var timestamp = new Date();
    var logSheet = ss.getSheetByName("System Logs");

    // NEW ORDER HANDLING
    if (data.type === "new_order") {
      var orderSheet = ss.getSheetByName("Orders");
      
      var cName = data.contact_name || "N/A";
      var sAddr = data.shipping_address || "N/A";
      var bAddr = data.billing_address || "N/A";
      var uTier = data.user_tier || "Tier 1";
      
      orderSheet.appendRow([
        timestamp, 
        data.order_id, 
        data.business_name, 
        cName, 
        data.email, 
        sAddr, 
        bAddr, 
        uTier, 
        data.total, 
        data.payment_method, 
        "Pending", 
        JSON.stringify(data.items)
      ]);
      
      // Trigger Instant Admin Notification
      var subject = "🚨 NEW WHOLESALE ORDER: " + data.business_name + " (" + uTier + ")";
      var body = "A new B2B wholesale order has just been placed and paid via Square.\n\n" +
                 "Business: " + data.business_name + "\n" +
                 "Contact Name: " + cName + "\n" +
                 "Email: " + data.email + "\n" +
                 "Tier: " + uTier + "\n" +
                 "Shipping Address: " + sAddr + "\n" +
                 "Order Total: $" + data.total + "\n" +
                 "Payment Method: " + data.payment_method + "\n\n" +
                 "Check your Google Sheet for exact item breakdown and fulfillment routing.";
      MailApp.sendEmail(ADMIN_EMAIL, subject, body);
      
      logSheet.appendRow([timestamp, "Order Received", "Order ID: " + data.order_id, "Success"]);
    } 
    
    // NEW PARTNERSHIP APPLICATION HANDLING
    else if (data.type === "new_application") {
      var appsSheet = ss.getSheetByName("Applications");
      appsSheet.appendRow([timestamp, data.business_name, data.contact_name, data.phone, data.email, data.tax_id, data.business_type, "Pending Review"]);
      
      var subject = "📝 NEW WHOLESALE PARTNERSHIP APP: " + data.business_name;
      var body = "A new Wholesale Partnership Application has been submitted on the portal.\n\n" +
                 "Business: " + data.business_name + "\n" +
                 "Contact: " + data.contact_name + "\n" +
                 "Email: " + data.email + "\n" +
                 "Phone: " + data.phone + "\n" +
                 "Tax ID: " + data.tax_id + "\n\n" +
                 "Please review the application in your Google Sheet database to approve or deny.";
      MailApp.sendEmail(ADMIN_EMAIL, subject, body);
      
      logSheet.appendRow([timestamp, "Application Received", "Business: " + data.business_name, "Success"]);
    }

    return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    var errTime = new Date();
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("System Logs").appendRow([errTime, "CRITICAL ERROR", error.toString(), "Failed"]);
    MailApp.sendEmail(ADMIN_EMAIL, "⚠️ Wholesale Portal Data Error", "An error occurred attempting to sync portal data to the sheet:\n\n" + error.toString());
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// 3. Automated Daily System Checker
function dailySystemChecker() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName("Orders");
  var appsSheet = ss.getSheetByName("Applications");
  
  var pendingOrders = 0;
  var pendingApps = 0;
  
  if (ordersSheet && ordersSheet.getLastRow() > 1) {
    var orderStatuses = ordersSheet.getRange(2, 11, ordersSheet.getLastRow() - 1, 1).getValues(); // Column K is Fulfillment Status
    for (var i = 0; i < orderStatuses.length; i++) {
      if (orderStatuses[i][0] === "Pending") pendingOrders++;
    }
  }
  
  if (appsSheet && appsSheet.getLastRow() > 1) {
    var appStatuses = appsSheet.getRange(2, 8, appsSheet.getLastRow() - 1, 1).getValues(); // Column H is Status
    for (var j = 0; j < appStatuses.length; j++) {
      if (appStatuses[j][0] === "Pending Review") pendingApps++;
    }
  }
  
  var subject = "📊 Herbalistic Wellness Wholesale: Daily Tracking Report";
  var body = "Good morning,\n\nHere is your daily Wholesale System Status Report. Below are the items requiring your attention:\n\n" +
             "ACTION REQUIRED:\n" +
             "• Pending Wholesale Orders to Fulfill: " + pendingOrders + "\n" +
             "• Pending Partnership Applications to Review: " + pendingApps + "\n\n" +
             "Log into your Wholesale Database to process these items.";
             
  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
  
  var logSheet = ss.getSheetByName("System Logs");
  if (logSheet) {
    logSheet.appendRow([new Date(), "Daily System Check", "Audited: " + pendingOrders + " orders, " + pendingApps + " applications.", "Active"]);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Herbalistic Wellness Wholesale Data API is fully active and listening.");
}
