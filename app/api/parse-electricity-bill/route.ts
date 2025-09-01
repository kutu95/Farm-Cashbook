import { NextResponse } from 'next/server';
import { parseElectricityBill } from '@/lib/parseElectricityBill';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function POST(request: Request) {
  try {
    console.log('parse-electricity-bill API called');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    console.log('File received:', file ? `${file.name} (${file.size} bytes, type: ${file.type})` : 'No file');
    
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
      console.log('File converted to buffer, size:', buffer.length);

      // Parse the electricity bill
      console.log('Starting to parse electricity bill...');
      const billData = await parseElectricityBill(buffer);
      console.log('Parsed electricity bill data:', billData); // Debug log

      return NextResponse.json({
        success: true,
        data: billData
      });

    } catch (parseError) {
      console.error('Electricity bill parsing error:', parseError);
      return NextResponse.json(
        { error: parseError instanceof Error ? parseError.message : 'Failed to parse electricity bill' },
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
