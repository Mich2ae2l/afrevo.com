# Afrevo Payment Integration Setup

## ✅ Completed
- Updated Google Apps Script with improved error handling and CORS
- Enhanced frontend with better error messages and payment flow
- Fixed form data structure to match GAS expectations

## 🔧 Required Setup Steps

### 1. Update Google Apps Script Configuration

In your `google-apps-script.js` file, update these two variables:

```javascript
// Replace with your actual secret key that matches pk_test_276098ab77d8214a3a7242628c03dffaee6bb827
const PAYSTACK_SECRET_KEY = 'sk_test_YOUR_MATCHING_SECRET_KEY_HERE';

// Replace with your React app URL
const REACT_APP_BASE = 'https://your-react-app-url.com';
```

### 2. Get Your Matching Paystack Secret Key

1. Log into your Paystack dashboard
2. Go to Settings > API Keys & Webhooks
3. Find the secret key that matches your public key: `pk_test_276098ab77d8214a3a7242628c03dffaee6bb827`
4. Copy the corresponding `sk_test_...` secret key

### 3. Deploy Updated Google Apps Script

1. Open your Google Apps Script project
2. Copy the updated code from `google-apps-script.js`
3. Click **Deploy > New Deployment**
4. Choose "Web app" as type
5. Set execute as "Me" and access to "Anyone"
6. Click Deploy and copy the new URL (if it changed)

### 4. Test the Complete Flow

1. **Fill out the application form**
2. **Click Submit** - should open Paystack payment modal
3. **Complete payment** with test card: `4084084084084081`
4. **Verify success** - should redirect to thank-you page
5. **Check Google Sheet** - application data should be saved

## 🚨 Troubleshooting

### Common Issues:
- **"Invalid key" error**: Secret key doesn't match public key
- **"Network error"**: Check GAS deployment URL and permissions
- **"Payment failed"**: Use Paystack test cards for testing
- **"Redirect failed"**: Update REACT_APP_BASE URL in GAS

### Test Cards (Paystack):
- **Success**: `4084084084084081`
- **Insufficient funds**: `4084084084084081` (with CVV `000`)
- **Invalid card**: `5060666666666666666`

## 🎯 Expected Flow

1. User fills form → 2. Paystack payment → 3. Payment verification → 4. Data saved to Google Sheet → 5. Redirect to thank-you page

All error handling and logging is now in place for easier debugging!