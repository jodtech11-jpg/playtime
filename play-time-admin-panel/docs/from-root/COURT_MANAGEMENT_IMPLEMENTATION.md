# 🏸 Court Management - Complete Implementation

## ✅ What Has Been Implemented

### 1. Court Form Modal (`components/CourtFormModal.tsx`)
- ✅ Create new court form
- ✅ Edit existing court form
- ✅ All court fields:
  - Court name
  - Sport type (Badminton, Cricket, Football, Tennis, Basketball)
  - Court type (Indoor, Outdoor, Synthetic, etc.)
  - Price per hour
  - Status (Active, Maintenance, Inactive)
  - **Availability schedule** (per day of week)
- ✅ Day-by-day availability configuration
- ✅ Set all days at once feature
- ✅ Form validation
- ✅ Loading and error states

### 2. Court Management Modal (`components/CourtManagementModal.tsx`)
- ✅ View all courts for a venue
- ✅ Grid layout showing court cards
- ✅ Court information display:
  - Name, sport, type
  - Price per hour
  - Status badge
  - Availability summary
- ✅ Quick actions:
  - Add new court
  - Edit court
  - Delete court
- ✅ Empty state when no courts
- ✅ Real-time updates

### 3. Updated Venues Page
- ✅ "Manage Courts" button on each venue card
- ✅ Opens Court Management Modal
- ✅ Integrated with venue management workflow

### 4. Enhanced useCourts Hook
- ✅ Real-time subscriptions support
- ✅ Filter by venue ID
- ✅ Loading and error states

### 5. Enhanced Firebase Service
- ✅ Added `subscribeAll` to `courtsCollection`
- ✅ Enhanced `getAll` with ordering and limit support

---

## 🎯 Key Features

### Court Creation/Editing
- **Basic Info**: Name, sport, type, price
- **Availability Schedule**: 
  - Per-day configuration (Monday-Sunday)
  - Start and end times per day
  - Available/Closed toggle per day
  - "Set All Days" quick action
- **Status Management**: Active, Maintenance, Inactive

### Court Management
- **View**: Grid of all courts for a venue
- **Create**: Add new court with full configuration
- **Edit**: Modify court details and availability
- **Delete**: Remove court (with confirmation)
- **Real-time**: Updates automatically when courts change

### Availability Schedule
- Each day can be:
  - **Available**: With start and end times
  - **Closed**: Not available for bookings
- Default: All days 8 AM - 10 PM, available
- Customizable per day

---

## 📊 Data Flow

1. **User clicks "Manage Courts"** → Opens Court Management Modal
2. **Modal loads** → Fetches courts for venue (real-time)
3. **User adds court** → Opens Court Form Modal
4. **User configures** → Sets name, sport, price, availability
5. **User saves** → Creates/updates court in Firestore
6. **UI updates** → Automatically reflects changes

---

## 🔧 Technical Implementation

### Availability Schedule Structure
```typescript
availability: {
  'Monday': { start: '08:00', end: '22:00', available: true },
  'Tuesday': { start: '08:00', end: '22:00', available: true },
  // ... other days
}
```

### Court Creation
```typescript
await courtsCollection.create({
  name: 'Court 1',
  venueId: venue.id,
  sport: 'Badminton',
  pricePerHour: 500,
  availability: { /* schedule */ },
  status: 'Active'
});
```

### Real-Time Updates
```typescript
const unsubscribe = courtsCollection.subscribeAll(
  (courts) => {
    setCourts(courts);
  },
  [{ field: 'venueId', operator: '==', value: venueId }]
);
```

---

## 📝 Usage Examples

### Adding a Court
1. Click "Manage Courts" on venue card
2. Click "Add Court" button
3. Fill in court details:
   - Name: "Court 1"
   - Sport: "Badminton"
   - Type: "Indoor"
   - Price: ₹500/hour
4. Configure availability:
   - Set each day's times
   - Or use "Set All Days"
5. Click "Create Court"

### Editing Court Availability
1. Open "Manage Courts"
2. Click "Edit" on a court
3. Modify availability schedule:
   - Toggle days on/off
   - Change start/end times
4. Click "Update Court"

### Setting Court to Maintenance
1. Open "Manage Courts"
2. Click "Edit" on a court
3. Change status to "Maintenance"
4. Save

---

## 🎨 UI Components

### Court Form Modal
- Sticky header with title
- Scrollable form content
- Availability schedule grid
- Day-by-day configuration
- "Set All Days" quick action
- Save/Cancel buttons

### Court Management Modal
- Header with venue name
- "Add Court" button
- Grid of court cards
- Each card shows:
  - Court name and sport
  - Status badge
  - Price
  - Availability summary
  - Edit/Delete buttons

### Court Cards
- Compact information display
- Status color coding
- Availability preview (first 3 days)
- Quick action buttons

---

## ⚠️ Important Notes

1. **Firestore Data Structure**: Courts must have:
   - `id` (auto-generated)
   - `venueId` (string)
   - `name` (string)
   - `sport` (string)
   - `type` (string, optional)
   - `pricePerHour` (number)
   - `availability` (object with day schedules)
   - `status` ('Active' | 'Maintenance' | 'Inactive')

2. **Availability Format**:
   - Day names: 'Monday', 'Tuesday', etc.
   - Time format: 'HH:MM' (24-hour, e.g., '08:00', '22:00')
   - Available: boolean

3. **Court Status**:
   - **Active**: Available for bookings
   - **Maintenance**: Temporarily unavailable
   - **Inactive**: Permanently unavailable

4. **Real-Time Updates**: All court changes are reflected immediately via Firestore subscriptions

5. **Venue Integration**: Courts are linked to venues via `venueId`. When viewing a venue, you can manage all its courts.

---

## 🚀 Future Enhancements

- [ ] Bulk court operations
- [ ] Copy court configuration
- [ ] Court-specific rules
- [ ] Court images
- [ ] Court capacity settings
- [ ] Advanced availability (holidays, special dates)
- [ ] Court analytics (usage, revenue)
- [ ] Maintenance scheduling
- [ ] Court equipment tracking

---

## 📚 Files Created/Modified

### New Files
- `components/CourtFormModal.tsx` - Court create/edit form
- `components/CourtManagementModal.tsx` - Court management interface
- `COURT_MANAGEMENT_IMPLEMENTATION.md` - This file

### Modified Files
- `pages/Venues.tsx` - Added "Manage Courts" button and modal integration
- `hooks/useCourts.ts` - Added real-time subscription support
- `services/firebase.ts` - Enhanced courtsCollection with subscribeAll

---

## 🧪 Testing Checklist

- [ ] Add new court to venue
- [ ] Edit existing court
- [ ] Delete court (with confirmation)
- [ ] Configure availability schedule
- [ ] Set all days at once
- [ ] Change court status
- [ ] View courts in management modal
- [ ] Real-time updates work
- [ ] Court appears in bookings calendar
- [ ] Error handling works

---

## 💡 Usage Tips

1. **Quick Setup**: Use "Set All Days" to quickly configure all days with the same schedule
2. **Maintenance Mode**: Set status to "Maintenance" to temporarily disable bookings
3. **Pricing**: Set competitive prices per hour for each court
4. **Availability**: Configure realistic hours based on venue operations
5. **Court Types**: Use descriptive types (e.g., "Indoor AC", "Outdoor Synthetic")

---

**Status**: ✅ Court Management fully implemented with real-time updates and availability scheduling!

