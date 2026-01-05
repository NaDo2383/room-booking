
export interface Booking {
  id: string;
  title: string;
  organizer: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  type: 'client' | 'internal' | 'focus' | 'social';
  bookedBy: string;  // User who created the booking
}
