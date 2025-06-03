import pdfParse from 'pdf-parse-fork';

export interface BillData {
  accountNumber: string;
  amount: number;
  date: string;
}

const MONTH_MAP: { [key: string]: string } = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
  'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
};

export async function parseBill(file: Buffer): Promise<BillData> {
  try {
    // Parse the PDF buffer
    const data = await pdfParse(file);
    const text = data.text;
    console.log('Raw extracted text:', text); // Debug log

    // Extract account number - look for patterns like "291 431 120" or "291431120"
    const accountMatch = text.match(/(?:Account|A\s*c\s*c\s*o\s*u\s*n\s*t)(?:\s*Number|\s*n\s*u\s*m\s*b\s*e\s*r)?[\s:]*((?:\d[\s]*){9,12})/i);
    if (!accountMatch) {
      console.log('No account number match found in text'); // Debug log
      throw new Error("Could not find account number in bill");
    }
    // Clean up the account number by removing spaces
    const accountNumber = accountMatch[1].replace(/\s+/g, '').toUpperCase();
    console.log('Found account number:', accountNumber); // Debug log

    // Extract amount - look for amounts next to "This bill" or "New charges"
    const amountMatch = text.match(/(?:This\s*bill|New\s*charges)[\s:]*\$?\s*([\d,]+\.?\d*)/i);
    if (!amountMatch) {
      console.log('No amount match found in text'); // Debug log
      throw new Error("Could not find amount in bill");
    }
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    console.log('Found amount:', amount); // Debug log

    // Extract date - look for date patterns with potential spaces between characters
    const dateMatch = text.match(/(?:Date\s*of\s*issue|Bill\s*Date)[\s:]*((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))/i) ||
                    text.match(/((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))/i) ||
                    text.match(/(?:Bill\s*)?Date[\s:]*((?:\d[\s]*){1,2}[\/-](?:\d[\s]*){1,2}[\/-](?:\d[\s]*){4})/i);
    
    if (!dateMatch) {
      console.log('No date match found in text'); // Debug log
      throw new Error("Could not find date in bill");
    }
    
    let date: string;
    const dateStr = dateMatch[1].trim();
    
    // Check if the date is in the format "13 Mar 2018"
    const monthNameMatch = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
    if (monthNameMatch) {
      const day = monthNameMatch[1].padStart(2, '0');
      const month = MONTH_MAP[monthNameMatch[2].toLowerCase()];
      const year = monthNameMatch[3];
      date = `${year}-${month}-${day}`;
    } else {
      // Handle numeric date format (fallback)
      const cleanDate = dateStr.replace(/\s+/g, '');
      const dateParts = cleanDate.split(/[/-]/);
      const [day, month, year] = dateParts;
      date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    console.log('Found date:', date); // Debug log

    return {
      accountNumber,
      amount,
      date
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw error instanceof Error ? error : new Error('Failed to parse bill');
  }
} 