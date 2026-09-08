import { supabase, projectId } from './supabase';

// All database operations now use Supabase backend
// This file provides a simple interface for database operations

export async function saveBooking(bookingData: any) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(bookingData)
    });

    if (!response.ok) {
      throw new Error('Failed to save booking');
    }

    const { booking } = await response.json();
    return booking;
  } catch (error) {
    console.error('Save booking error:', error);
    throw error;
  }
}

export async function getBookings(userId?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get bookings');
    }

    const { bookings } = await response.json();
    return bookings || [];
  } catch (error) {
    console.error('Get bookings error:', error);
    return [];
  }
}

export async function updateBooking(id: string, updates: any) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update booking');
    }

    const { booking } = await response.json();
    return booking;
  } catch (error) {
    console.error('Update booking error:', error);
    throw error;
  }
}

export async function deleteBooking(id: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete booking');
    }

    return true;
  } catch (error) {
    console.error('Delete booking error:', error);
    throw error;
  }
}