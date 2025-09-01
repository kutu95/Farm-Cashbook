import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Check if user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get electricity bills
    const { data: bills, error } = await supabase
      .from('electricity_bills')
      .select('*')
      .order('bill_date', { ascending: false });

    if (error) {
      console.error('Error fetching electricity bills:', error);
      return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
    }

    return NextResponse.json({ bills });
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Check if user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleError || userRole?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      billDate, 
      billDateRangeStart, 
      billDateRangeEnd, 
      totalUnitsConsumed, 
      unitsPerDay,
      isEstimated,
      accountNumber, 
      billAmount,
      meterReading
    } = body;

    // Debug logging to see what's being received
    console.log('Received bill data:', {
      billDate,
      billDateRangeStart,
      billDateRangeEnd,
      totalUnitsConsumed,
      unitsPerDay,
      isEstimated,
      accountNumber,
      billAmount,
      meterReading
    });

    // Validate required fields with detailed error messages
    const missingFields = [];
    
    if (!billDate) missingFields.push('billDate');
    if (!billDateRangeStart) missingFields.push('billDateRangeStart');
    if (!billDateRangeEnd) missingFields.push('billDateRangeEnd');
    if (totalUnitsConsumed === undefined || totalUnitsConsumed === null || isNaN(totalUnitsConsumed)) missingFields.push('totalUnitsConsumed');
    if (!accountNumber) missingFields.push('accountNumber');
    if (billAmount === undefined || billAmount === null || isNaN(billAmount)) missingFields.push('billAmount');
    
    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
      return NextResponse.json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      }, { status: 400 });
    }

    // Insert the electricity bill
          const { data: newBill, error: insertError } = await supabase
        .from('electricity_bills')
        .insert({
          bill_date: billDate,
          bill_date_range_start: billDateRangeStart,
          bill_date_range_end: billDateRangeEnd,
          total_units_consumed: totalUnitsConsumed,
          units_per_day: unitsPerDay,
          is_estimated: isEstimated,
          account_number: accountNumber,
          bill_amount: billAmount,
          meter_reading: meterReading
        })
        .select()
        .single();

    if (insertError) {
      console.error('Error inserting electricity bill:', insertError);
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ 
          error: 'A bill with this date range and account number already exists' 
        }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      bill: newBill,
      message: 'Electricity bill created successfully' 
    });
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Check if user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (roleError || userRole?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    // Delete the electricity bill
    const { error: deleteError } = await supabase
      .from('electricity_bills')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting electricity bill:', deleteError);
      return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Electricity bill deleted successfully' 
    });
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
