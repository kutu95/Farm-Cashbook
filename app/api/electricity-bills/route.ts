import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
  ElectricityBillSaveError,
  expenseStatusMessage,
  saveElectricityBillWithExpense,
} from '@/lib/electricityBillExpense';

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

    const result = await saveElectricityBillWithExpense(supabase, session.user.id, {
      billDate,
      billDateRangeStart,
      billDateRangeEnd,
      totalUnitsConsumed,
      unitsPerDay,
      isEstimated,
      accountNumber,
      billAmount,
      meterReading,
    });

    return NextResponse.json({
      success: true,
      bill: result.bill,
      expenseStatus: result.expenseStatus,
      message: expenseStatusMessage(result.expenseStatus),
    });
  } catch (error) {
    console.error('Request processing error:', error);
    if (error instanceof ElectricityBillSaveError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
