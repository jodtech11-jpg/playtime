# Environment Variables Setup

## Required Environment Variables

Create a `.env` file in the root of the `play-time-admin-panel` directory with the following variables:

```env
# Google Maps API Key (Required for venue location features)
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Gemini API Key (Optional - if using Gemini features)
GEMINI_API_KEY=your_gemini_api_key_here
```

## Getting Your Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Go to "Credentials" and create an API key
5. Restrict the API key to your domain (recommended for production)
6. Copy the API key and add it to your `.env` file

## Important Notes

- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore`
- Restart your development server after adding/updating environment variables
- For production, set these variables in your hosting platform's environment settings

## Current API Key

The current API key in use: `AIzaSyBjRhMJFCD1UGao0twXVlltce9p8ZjPt6c`

**Please update this in your `.env` file and remove it from the codebase.**

