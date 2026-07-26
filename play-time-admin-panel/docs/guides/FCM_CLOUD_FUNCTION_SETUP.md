# 🔔 FCM Cloud Function Setup Guide

## Deployment requirement

The admin panel requires the authenticated `sendNotification` HTTPS function. This
document does not assert that any environment is currently deployed.

### Function URLs

- **Send Notification**: `${VITE_CLOUD_FUNCTIONS_BASE_URL}/sendNotification`
- **Health Check**: `${VITE_CLOUD_FUNCTIONS_BASE_URL}/health`

## 📝 Environment Variable Setup

Add the following to your `.env` file in the `play-time-admin-panel` directory:

```env
# FCM Cloud Function URL (for push notifications)
VITE_CLOUD_FUNCTIONS_BASE_URL=https://us-central1-your-project-id.cloudfunctions.net
# Optional legacy override used only by the push client:
VITE_FCM_CLOUD_FUNCTION_URL=https://us-central1-your-project-id.cloudfunctions.net/sendNotification
```

## 🔄 After Adding the Environment Variable

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Verify the setup**:
   - Go to the Notifications page
   - The warning banner should disappear
   - Try sending a test notification

## 🧪 Testing the Function

### Health Check
Use the health URL derived from `VITE_CLOUD_FUNCTIONS_BASE_URL`.

This should return:
```json
{
  "status": "ok",
  "service": "FCM Notification Service",
  "timestamp": "2026-01-07T..."
}
```

### Send Test Notification
The function accepts POST requests with the following structure:

```json
{
  "notification": {
    "title": "Test Notification",
    "body": "This is a test notification",
    "imageUrl": "https://example.com/image.png" // optional
  },
  "data": {
    "type": "general",
    "actionUrl": "https://example.com",
    "actionText": "View",
    "notificationId": "test-123"
  },
  "tokens": ["fcm-token-1", "fcm-token-2"]
}
```

## 📋 Function Details

### Endpoints

#### POST /sendNotification
Sends push notifications to multiple FCM tokens.

**Request Body:**
- `notification` (required): Object with `title`, `body`, and optional `imageUrl`
- `data` (optional): Object with `type`, `actionUrl`, `actionText`, `notificationId`
- `tokens` (required): Array of FCM token strings

**Response:**
```json
{
  "success": 2,
  "failed": 0,
  "responses": [
    {
      "token": "fcm-token-1",
      "success": true,
      "error": null
    },
    {
      "token": "fcm-token-2",
      "success": true,
      "error": null
    }
  ]
}
```

#### GET /health
Health check endpoint to verify the function is running.

## 🔧 Function Configuration

- **Runtime**: Node.js 20
- **Region**: us-central1
- **Generation**: 2nd Gen (Cloud Functions v2)
- **Authentication**: `sendNotification` requires a Firebase ID token for an authorized admin

## 🔒 Security Considerations

Never place an FCM server key or service-account credential in a `VITE_*` variable.
The browser sends the signed-in admin's Firebase ID token. The function must verify
that token, enforce admin permissions and venue scope, validate payload sizes, and
rate-limit requests. App Check can be added as defense in depth.

## 📚 Related Documentation

- [FCM Implementation Guide](../implementations/FCM_IMPLEMENTATION.md)
- [Environment Setup Guide](./ENV_SETUP.md)

## ✅ Next Steps

1. Deploy the authenticated function through the normal release process.
2. Set the function base URL in the target environment.
3. Restart the development server.
4. Test with an authorized admin and confirm function logs.

---

**Last Updated**: July 26, 2026

