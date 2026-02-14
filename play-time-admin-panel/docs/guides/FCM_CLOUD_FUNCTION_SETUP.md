# 🔔 FCM Cloud Function Setup Guide

## ✅ Cloud Function Successfully Deployed!

The FCM push notification Cloud Function has been successfully deployed to Firebase.

### Function URLs

- **Send Notification**: `https://us-central1-playtime-d9b83.cloudfunctions.net/sendNotification`
- **Health Check**: `https://us-central1-playtime-d9b83.cloudfunctions.net/health`

## 📝 Environment Variable Setup

Add the following to your `.env` file in the `play-time-admin-panel` directory:

```env
# FCM Cloud Function URL (for push notifications)
VITE_FCM_CLOUD_FUNCTION_URL=https://us-central1-playtime-d9b83.cloudfunctions.net/sendNotification
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
You can test if the function is working by visiting:
```
https://us-central1-playtime-d9b83.cloudfunctions.net/health
```

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
- **Authentication**: Public (can be restricted if needed)

## 🔒 Security Considerations

The function is currently publicly accessible. For production, you may want to:

1. **Add authentication**: Require a secret token in the request headers
2. **Restrict by IP**: Limit access to specific IP addresses
3. **Use Firebase App Check**: Verify requests come from your app

## 📚 Related Documentation

- [FCM Implementation Guide](../implementations/FCM_IMPLEMENTATION.md)
- [Environment Setup Guide](./ENV_SETUP.md)

## ✅ Next Steps

1. ✅ Cloud Function deployed
2. ⏳ Add `VITE_FCM_CLOUD_FUNCTION_URL` to `.env` file
3. ⏳ Restart development server
4. ⏳ Test notification sending

---

**Last Updated**: January 7, 2026
**Function Version**: 1.0.0

