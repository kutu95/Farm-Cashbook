import { NextResponse } from 'next/server';
import { parseBill } from '@/lib/parseBill';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type || file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Parse the bill
      const billData = await parseBill(buffer);
      console.log('Parsed bill data:', billData); // Debug log

      // Initialize Supabase client with awaited cookies
      const cookieStore = cookies();
      const supabase = createServerComponentClient({ cookies: () => cookieStore });

      // Find parties with matching account number
      const { data: matchingParties, error: partiesError } = await supabase
        .from('parties')
        .select('id, name, electricity_account_number')
        .eq('electricity_account_number', billData.accountNumber);

      if (partiesError) {
        console.error('Supabase error:', partiesError);
        throw partiesError;
      }

      // If matching parties found, use them for allocation
      if (matchingParties && matchingParties.length > 0) {
        const partyCount = matchingParties.length;
        const percentagePerParty = 100 / partyCount;

        const allocations = matchingParties.map(party => ({
          party_id: party.id,
          percentage: percentagePerParty
        }));

        return NextResponse.json({
          ...billData,
          allocations,
          description: `Synergy bill for ${billData.accountNumber}`
        });
      }

      // If no matching parties found, get all parties and distribute equally
      const { data: allParties, error: allPartiesError } = await supabase
        .from('parties')
        .select('id, name');

      if (allPartiesError) {
        console.error('Supabase error:', allPartiesError);
        throw allPartiesError;
      }

      if (!allParties || allParties.length === 0) {
        return NextResponse.json(
          { error: 'No parties found in the system' },
          { status: 404 }
        );
      }

      // Calculate equal percentage for all parties
      const percentagePerParty = 100 / allParties.length;

      // Prepare party allocations
      const allocations = allParties.map(party => ({
        party_id: party.id,
        percentage: percentagePerParty
      }));

      return NextResponse.json({
        ...billData,
        allocations,
        description: `Synergy bill for ${billData.accountNumber} (equal split)`
      });

    } catch (parseError) {
      console.error('Bill parsing error:', parseError);
      return NextResponse.json(
        { error: parseError instanceof Error ? parseError.message : 'Failed to parse bill' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 