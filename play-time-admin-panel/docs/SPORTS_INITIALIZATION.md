# Sports Initialization Guide

## Overview

The sports management system has been initialized with default sports and their templates. This document describes the initialized sports and how to use them.

## Initialized Sports

### 1. Badminton
- **Icon**: `sports_tennis`
- **Color**: `#10b981` (Emerald)
- **Default Team Size**: 1-4 players
- **Match Duration**: 60 minutes
- **Scoring Format**: Best of 3 sets, First to 21
- **Sport-Specific Options**:
  - Court Type: Indoor, Outdoor, Both
  - Game Types: Singles, Doubles, Mixed Doubles
  - Shuttle Type: Plastic, Feather
  - Scoring System: 21 Points, 15 Points, 11 Points

### 2. Cricket
- **Icon**: `sports_cricket`
- **Color**: `#f59e0b` (Amber)
- **Default Team Size**: 11 players
- **Match Duration**: 180 minutes
- **Scoring Format**: Runs scored
- **Sport-Specific Options**:
  - Format: T20, ODI, Test, T10
  - Overs: 6, 10, 20, 50
  - Ball Type: Leather, Tennis, Plastic
  - Pitch Type: Turf, Concrete, Matting, Synthetic
  - Team Size: 11, 7, 5

### 3. Football
- **Icon**: `sports_soccer`
- **Color**: `#3b82f6` (Blue)
- **Default Team Size**: 5-11 players
- **Match Duration**: 90 minutes
- **Scoring Format**: Goals scored
- **Sport-Specific Options**:
  - Field Size: 5v5, 7v7, 9v9, 11v11
  - Match Duration: 20, 30, 45, 90 minutes
  - Ball Size: Size 4, Size 5
  - Field Type: Turf, Grass, Artificial, Indoor

### 4. Tennis
- **Icon**: `sports_tennis`
- **Color**: `#8b5cf6` (Purple)
- **Default Team Size**: 1-2 players
- **Match Duration**: 90 minutes
- **Scoring Format**: Best of 3 sets
- **Sport-Specific Options**:
  - Court Surface: Hard, Clay, Grass, Carpet, Synthetic
  - Match Format: Best of 3, Best of 5
  - Game Type: Singles, Doubles, Mixed Doubles

### 5. Basketball
- **Icon**: `sports_basketball`
- **Color**: `#ef4444` (Red)
- **Default Team Size**: 5 players
- **Match Duration**: 48 minutes
- **Scoring Format**: Points scored
- **Sport-Specific Options**:
  - Court Type: Indoor, Outdoor
  - Ball Size: Size 6, Size 7
  - Game Format: Full Court, Half Court, 3v3

### 6. Volleyball
- **Icon**: `sports_volleyball`
- **Color**: `#ec4899` (Pink)
- **Default Team Size**: 6 players
- **Match Duration**: 60 minutes
- **Scoring Format**: Best of 3 sets, First to 25
- **Sport-Specific Options**:
  - Court Type: Indoor, Outdoor, Beach
  - Game Format: 6v6, 4v4, Beach Volleyball
  - Net Height: Men: 2.43m, Women: 2.24m, Mixed: 2.24m

### 7. Table Tennis
- **Icon**: `sports_handball`
- **Color**: `#06b6d4` (Cyan)
- **Default Team Size**: 1-2 players
- **Match Duration**: 30 minutes
- **Scoring Format**: Best of 5 games, First to 11
- **Sport-Specific Options**:
  - Game Types: Singles, Doubles, Mixed Doubles
  - Table Type: Indoor, Outdoor
  - Paddle Type: Standard, Professional

## How to Use

### Viewing Sports
1. Navigate to **Tournaments** page
2. Click **"Manage Sports"** button next to the sport filter
3. View all created sports with their configurations

### Creating Tournaments
1. When creating a tournament, select a sport from the dropdown
2. The form will auto-fill default team sizes and match duration
3. Sport-specific options are available in the sport's configuration

### Editing Sports
1. Open **Sport Management Modal** from Tournaments page
2. Click **Edit** on any sport
3. Modify common settings or sport-specific options
4. Use **"Apply Template"** to restore default sport-specific options

### Adding New Sports
1. Open **Sport Management Modal**
2. Fill in sport details:
   - Name (required)
   - Description
   - Icon (Material Symbol name)
   - Color (hex code)
   - Display Order
3. Configure common tournament settings
4. Add sport-specific options as JSON or use template
5. Click **"Create Sport"**

## Re-initializing Sports

If you need to re-run the initialization script:

```bash
npm run initialize-sports
```

The script will:
- Create new sports that don't exist
- Update existing sports with new templates
- Skip sports that are already up to date

## Sport-Specific Options Format

Sport-specific options are stored as JSON. Example:

```json
{
  "courtType": ["Indoor", "Outdoor"],
  "gameTypes": ["Singles", "Doubles"],
  "shuttleType": ["Plastic", "Feather"]
}
```

## Customization

You can customize any sport by:
1. Editing the sport in the Sport Management Modal
2. Modifying the JSON configuration
3. Adding custom fields to the sport-specific options

## Notes

- All sports are set to **Active** by default
- Sports are ordered by the `order` field (1-7)
- Sport-specific options are flexible and can be extended
- Default settings are suggestions and can be overridden when creating tournaments

