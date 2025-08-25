/**
 * Afrevo Application Backend (Google Apps Script)
 * - Accepts application/x-www-form-urlencoded or JSON POST
 * - Verifies Paystack payment by reference using SECRET KEY
 * - Appends to Google Sheet "Applications"
 * - Returns JSON with redirectUrl to React app
 *
 * Deploy as Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 */

// ================== CONFIG ==================
// TODO: Replace with your actual secret key that matches pk_test_276098ab77d8214a3a7242628c03dffaee6bb827
const PAYSTACK_SECRET_KEY = 'sk_test_YOUR_ACTUAL_SECRET_KEY_HERE'; // Replace with correct secret key
const SHEET_NAME = 'Application_form';
const SPREADSHEET_ID = '1pO4KNhF3dCpiFJpEfGZPW1CZLmYkY1RotbdUOufoVB8';
// React app base URL - update this to your actual deployment URL
const REACT_APP_BASE = 'https://your-react-app-url.com'; // Update this
// ============================================

/** JSON output helper with CORS headers */
function jsonOut(obj, httpCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Handle CORS preflight requests */
function doOptions() {
  return jsonOut({ status: 'ok' });
}

/** Robust request body parser (JSON or x-www-form-urlencoded) */
function parseRequestBody(e) {
  const out = {};

  // Try JSON first
  try {
    if (e.postData && e.postData.type && e.postData.type.indexOf('application/json') !== -1) {
      const parsed = JSON.parse(e.postData.contents || '{}');
      Object.assign(out, parsed);
      return out;
    }
  } catch (err) {
    console.log('JSON parse failed:', err);
  }

  // Fallback: urlencoded
  if (e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    const pairs = raw.split('&');
    pairs.forEach(function (pair) {
      if (!pair) return;
      const parts = pair.split('=');
      const key = parts[0] ? decodeURIComponent(parts[0].replace(/\+/g, ' ')) : '';
      const val = parts[1] ? decodeURIComponent(parts.slice(1).join('=').replace(/\+/g, ' ')) : '';
      if (!key) return;
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        if (Array.isArray(out[key])) out[key].push(val);
        else out[key] = [out[key], val];
      } else {
        out[key] = val;
      }
    });
  }

  return out;
}

function doPost(e) {
  try {
    console.log('Received POST request');
    
    if (!e) {
      console.log('Empty request received');
      return jsonOut({ status: 'error', message: 'Empty request' });
    }

    const data = parseRequestBody(e);
    console.log('Parsed data keys:', Object.keys(data));
    
    const paymentRef = (data.paymentRef || data.reference || '').toString().trim();
    console.log('Payment reference:', paymentRef);

    if (!paymentRef) {
      console.log('Missing payment reference');
      return jsonOut({ status: 'error', message: 'Missing paymentRef' });
    }

    // Check if secret key is configured
    if (PAYSTACK_SECRET_KEY === 'sk_test_YOUR_ACTUAL_SECRET_KEY_HERE') {
      console.log('Secret key not configured');
      return jsonOut({ 
        status: 'error', 
        message: 'Paystack secret key not configured in GAS script' 
      });
    }

    // Verify with Paystack
    console.log('Verifying payment with Paystack...');
    const verifyUrl = 'https://api.paystack.co/transaction/verify/' + encodeURIComponent(paymentRef);
    const options = {
      method: 'GET',
      muteHttpExceptions: true,
      headers: { 
        'Authorization': 'Bearer ' + PAYSTACK_SECRET_KEY,
        'Content-Type': 'application/json'
      }
    };

    const resp = UrlFetchApp.fetch(verifyUrl, options);
    const statusCode = resp.getResponseCode();
    const body = resp.getContentText() || '{}';
    
    console.log('Paystack response status:', statusCode);
    console.log('Paystack response body:', body);

    let verify;
    try { 
      verify = JSON.parse(body); 
    } catch (err) { 
      console.log('Failed to parse Paystack response:', err);
      verify = { status: false, message: 'Invalid JSON from Paystack', raw: body }; 
    }

    // Handle different response scenarios
    if (statusCode === 401) {
      console.log('Paystack authentication failed - check secret key');
      return jsonOut({
        status: 'error',
        message: 'Payment verification failed: Invalid API key',
        detail: 'Please check your Paystack secret key configuration'
      });
    }

    if (statusCode !== 200) {
      console.log('Paystack API error:', statusCode, body);
      return jsonOut({
        status: 'error',
        message: 'Payment verification failed: API error',
        detail: `HTTP ${statusCode}: ${verify.message || 'Unknown error'}`
      });
    }

    if (!(verify && verify.status && verify.data && verify.data.status === 'success')) {
      console.log('Payment not successful:', verify);
      return jsonOut({
        status: 'error',
        message: 'Payment verification failed',
        detail: verify && verify.message ? verify.message : 'Payment not completed successfully',
        paystack: verify
      });
    }

    console.log('Payment verified successfully');

    // Verified — pull info
    const amount = (verify.data.amount || 0) / 100;
    const currency = verify.data.currency || '';
    const payerEmail = (verify.data.customer && verify.data.customer.email) || data['Email Address'] || '';
    const payerName = (data['Full Name'] || [
      verify.data.customer && verify.data.customer.first_name || '',
      verify.data.customer && verify.data.customer.last_name || ''
    ].join(' ').trim());

    console.log('Payment details:', { amount, currency, payerEmail, payerName });

    // Open sheet
    let ss;
    try {
      ss = (SPREADSHEET_ID && SPREADSHEET_ID.length > 10)
        ? SpreadsheetApp.openById(SPREADSHEET_ID)
        : SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {
      console.log('Failed to open spreadsheet:', err);
      return jsonOut({ status: 'error', message: 'Spreadsheet access failed: ' + err.toString() });
    }

    if (!ss) {
      console.log('Spreadsheet not found');
      return jsonOut({ status: 'error', message: 'Spreadsheet not found' });
    }

    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Expected headers (MUST match your HTML field names)
    const headers = [
      "Job Codes","Full Name","Date of Birth","ID Number","Nationality",
      "Country of Residence","Country Code","Phone Number","Email Address",
      "Marital Status","religious affiliation?","Gender","Number of Dependents",
      "Education Level","Institution Name","Graduation Year","Technical Training",
      "English Proficiency","Other Languages","Previous Jobs","Years of Experience",
      "Recent Job","Reason for Leaving","Overseas Experience","Machinery Experience",
      "Physically Demanding Work","Night Shift Experience","Willing to Relocate",
      "Valid Passport","Passport Number","Travel Restrictions","Travel Readiness",
      "Cold Remote Work","Ship Work","Disabilities","Surgery Illness","Medications",
      "Criminal Record","Medical Exam Willing","Availability Start","Motivation Strategy",
      "Learning Adaptability","Team Conflict Resolution","Accept Any Position",
      "Accommodation Agreement","Overtime Willing","Contract Understanding",
      "Work Duration Abroad","Family Support","Understand Long Absence","Financial Readiness",
      "Salary Expectations","Bring Family Later","Rule Agreement",
      // meta columns:
      "Timestamp","Paystack Amount","Currency","Payment Reference","Verification Status"
    ];

    if (sheet.getLastRow() === 0) {
      console.log('Adding headers to sheet');
      sheet.appendRow(headers);
    }

    const row = headers.map(h => {
      switch (h) {
        case 'Timestamp': return new Date();
        case 'Paystack Amount': return amount;
        case 'Currency': return currency;
        case 'Payment Reference': return paymentRef;
        case 'Verification Status': return 'Success';
        default:
          return data[h] || data[h.replace(/\s+/g, '_')] || data[h.toLowerCase()] || '';
      }
    });

    console.log('Adding row to sheet');
    sheet.appendRow(row);

    // Build redirect URL for React app
    const queryParams = new URLSearchParams({
      name: payerName || data['Full Name'] || '',
      email: payerEmail || '',
      ref: paymentRef
    });
    
    const redirectUrl = `${REACT_APP_BASE}/thank-you?${queryParams.toString()}`;
    
    console.log('Success - redirecting to:', redirectUrl);

    return jsonOut({
      status: 'success',
      message: 'Application stored successfully',
      redirectUrl: redirectUrl,
      data: {
        name: payerName || data['Full Name'] || '',
        email: payerEmail || '',
        reference: paymentRef,
        amount: amount,
        currency: currency
      }
    });

  } catch (err) {
    console.log('Server exception:', err);
    return jsonOut({ 
      status: 'error', 
      message: 'Server exception: ' + err.toString(),
      stack: err.stack
    });
  }
}

// Handle GET requests for testing
function doGet(e) {
  return jsonOut({
    status: 'ok',
    message: 'Afrevo Application Backend is running',
    timestamp: new Date().toISOString(),
    version: '2.0'
  });
}