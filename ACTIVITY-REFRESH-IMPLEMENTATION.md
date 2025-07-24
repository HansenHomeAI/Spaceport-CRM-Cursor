# Activity-Triggered Refresh & Auto-Save Implementation

## Overview
Implemented a smart refresh system that updates data when users interact with the application after 15+ minutes, plus immediate auto-save functionality to eliminate manual save steps.

## Features Implemented

### 1. Activity-Triggered Refresh (`hooks/use-activity-refresh.ts`)
- **Purpose**: Automatically refresh data when user activity is detected after 15+ minutes of inactivity
- **Triggers**: scroll, click, keydown, mousemove, touchstart events
- **Throttling**: Max one check per second to avoid excessive calls
- **Benefits**: 
  - No excessive database calls when tab is in background
  - Fresh data when users return to active use
  - No manual refresh needed

### 2. Strong Consistency for DynamoDB
- **Problem**: DynamoDB eventual consistency could cause 1-second delays seeing changes
- **Solution**: Added `ConsistentRead: true` to all GET/Scan operations
- **Cost**: 2x read capacity but ensures immediate read-after-write consistency
- **Impact**: Eliminates the "changes don't appear immediately" issue

### 3. Auto-Save Implementation
- **Behavior**: All lead updates save immediately to database without manual save action
- **User Experience**: 
  - Optimistic updates (UI responds instantly)
  - Background save to database
  - Automatic revert if save fails
  - Console logging for debugging
- **Attribution**: Tracks who made changes with user ID and name

### 4. Visual Indicators
- **Database Status**: Shows connection status in header badges
- **Background Refresh**: Spinning icon when refresh is in progress
- **Auto-Save Feedback**: Console messages for save success/failure

## How It Works

### Activity Detection Flow:
1. User interacts with page (scroll, click, etc.)
2. Check if 15+ minutes since last data refresh
3. If yes, trigger background refresh from database
4. Update local state with fresh data
5. Mark new refresh timestamp

### Auto-Save Flow:
1. User makes change (edit lead, change status, etc.)
2. UI updates immediately (optimistic update)
3. API call sent to database in background
4. If save fails, revert UI to previous state
5. Log success/failure for debugging

### Benefits:
- **Efficient**: No polling or constant database hits
- **Responsive**: UI feels instant with optimistic updates
- **Fresh Data**: Ensures users see recent changes from other accounts
- **Automatic**: No manual save buttons or refresh requirements
- **Reliable**: Handles errors gracefully with rollback

## Usage
The system is automatically active when:
- User is authenticated
- In production mode with database connection
- Database status is 'connected'

No additional setup required - it works transparently in the background. 