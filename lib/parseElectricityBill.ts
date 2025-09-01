import pdfParse from 'pdf-parse-fork';

export interface ElectricityBillData {
  accountNumber: string;
  billAmount: number;
  billDate: string;
  billDateRangeStart: string;
  billDateRangeEnd: string;
  totalUnitsConsumed: number;
  unitsPerDay: number;
  isEstimated: boolean;
  meterReading: number;
}

const MONTH_MAP: { [key: string]: string } = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
  'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
};

export async function parseElectricityBill(file: Buffer): Promise<ElectricityBillData> {
  try {
    // Parse the PDF buffer with options to preserve whitespace
    const data = await pdfParse(file, {
      normalizeWhitespace: false,
      disableCombineTextItems: false,
      preserveWhitespace: true
    });
    const text = data.text;
    console.log('Raw extracted text length:', text.length); // Debug log
    console.log('First 500 characters:', text.substring(0, 500)); // Debug log
    
    // Look for meter reading related text
    const meterReadingIndex = text.toLowerCase().indexOf('meter reading');
    if (meterReadingIndex !== -1) {
      console.log('Found "meter reading" at index:', meterReadingIndex);
      console.log('Text around meter reading:', text.substring(Math.max(0, meterReadingIndex - 50), meterReadingIndex + 100));
    }
    
    // Look for usage summary section
    const usageSummaryIndex = text.toLowerCase().indexOf('usage summary');
    if (usageSummaryIndex !== -1) {
      console.log('Found "usage summary" at index:', usageSummaryIndex);
      console.log('Text around usage summary:', text.substring(Math.max(0, usageSummaryIndex - 50), usageSummaryIndex + 200));
    }
    
    // Look for "Anytime usage" pattern
    const anytimeUsageIndex = text.toLowerCase().indexOf('anytime usage');
    if (anytimeUsageIndex !== -1) {
      console.log('Found "anytime usage" at index:', anytimeUsageIndex);
      console.log('Text around anytime usage:', text.substring(Math.max(0, anytimeUsageIndex - 50), anytimeUsageIndex + 200));
      
      // Look for the specific line with meter readings
      const usageLine = text.substring(anytimeUsageIndex, anytimeUsageIndex + 100);
      console.log('Usage line:', usageLine);
      
      // Try to find the exact pattern
      const usageMatch = usageLine.match(/Anytime usage(\d+)/);
      if (usageMatch) {
        console.log('Usage match:', usageMatch[1]);
        console.log('Usage match length:', usageMatch[1].length);
      }
    }

    // Extract account number - look for patterns like "291 431 120" or "291431120"
    const accountMatch = text.match(/(?:Account|A\s*c\s*c\s*o\s*u\s*n\s*t)(?:\s*Number|\s*n\s*u\s*m\s*b\s*e\s*r)?[\s:]*((?:\d[\s]*){9,12})/i);
    if (!accountMatch) {
      console.log('No account number match found in text'); // Debug log
      throw new Error("Could not find account number in bill");
    }
    // Clean up the account number by removing spaces
    const accountNumber = accountMatch[1].replace(/\s+/g, '').toUpperCase();
    console.log('Found account number:', accountNumber); // Debug log

    // Extract bill amount - look for amounts next to "This bill" or "New charges" or "Total amount due"
    let amountMatch = text.match(/(?:This\s*bill|New\s*charges|Total\s*amount\s*due|Amount\s*due)[\s:]*\$?\s*([\d,]+\.?\d*)/i);
    
    // If not found, try alternative patterns
    if (!amountMatch) {
      amountMatch = text.match(/(?:Total|Amount)[\s:]*\$?\s*([\d,]+\.?\d*)/i);
    }
    
    // If still not found, try looking for any dollar amount
    if (!amountMatch) {
      amountMatch = text.match(/\$?\s*([\d,]+\.?\d*)/i);
    }
    
    if (!amountMatch) {
      console.log('No amount match found in text'); // Debug log
      console.log('Looking for bill amount in text...'); // Debug log
      throw new Error("Could not find bill amount in bill");
    }
    
    const billAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(billAmount)) {
      console.log('Invalid bill amount parsed:', amountMatch[1]);
      throw new Error("Could not parse bill amount as a valid number");
    }
    console.log('Found bill amount:', billAmount); // Debug log

    // Extract bill date - look for date patterns with potential spaces between characters
    const billDateMatch = text.match(/(?:Date\s*of\s*issue|Bill\s*Date|Issue\s*Date)[\s:]*((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))/i) ||
                         text.match(/((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))/i) ||
                         text.match(/(?:Bill\s*)?Date[\s:]*((?:\d[\s]*){1,2}[\/-](?:\d[\s]*){1,2}[\/-](?:\d[\s]*){4})/i);
    
    if (!billDateMatch) {
      console.log('No bill date match found in text');
      throw new Error("Could not find bill date in bill");
    }
    
    const billDate = parseDate(billDateMatch[1].trim());
    console.log('Found bill date:', billDate); // Debug log

    // Extract date range - look for patterns like "Reading period: 13 Mar 2018 - 12 Apr 2018"
    const dateRangeMatch = text.match(/(?:Reading\s*period|Billing\s*period|Period|From|Between)[\s:]*((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))[\s-]+((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))/i) ||
                          text.match(/((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))[\s-]+((?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:\d{4}))/i);
    
    let billDateRangeStart: string;
    let billDateRangeEnd: string;
    
    if (dateRangeMatch) {
      billDateRangeStart = parseDate(dateRangeMatch[1].trim());
      billDateRangeEnd = parseDate(dateRangeMatch[2].trim());
      console.log('Found date range:', billDateRangeStart, 'to', billDateRangeEnd);
    } else {
      // If no date range found, use bill date as both start and end
      billDateRangeStart = billDate;
      billDateRangeEnd = billDate;
      console.log('No date range found, using bill date for both start and end');
    }

    // Extract total units consumed - prioritize total consumption over average daily usage
    // Look for the most reliable pattern first: "This bill: 268" which appears in the usage chart
    let unitsMatch = text.match(/This\s*bill:\s*(\d+\.?\d*)/i);
    
    // If not found, look for other patterns in order of reliability
    if (!unitsMatch) {
      unitsMatch = text.match(/(?:Units\s*imported\s*\(kWh\)|Total\s*consumption|Total\s*usage|Units\s*consumed)[\s:]*([\d,]+\.?\d*)/i);
    }
    
    if (!unitsMatch) {
      unitsMatch = text.match(/(?:This\s*bill|Current\s*bill)[\s:]*([\d,]+\.?\d*)\s*kWh/i);
    }
    
    if (!unitsMatch) {
      unitsMatch = text.match(/([\d,]+\.?\d*)\s*kWh/i);
    }
    
    if (!unitsMatch) {
      console.log('No units consumed match found in text');
      throw new Error("Could not find total units consumed in bill");
    }
    
    const totalUnitsConsumed = parseFloat(unitsMatch[1].replace(/,/g, ''));
    if (isNaN(totalUnitsConsumed)) {
      console.log('Invalid total units consumed parsed:', unitsMatch[1]);
      throw new Error("Could not parse total units consumed as a valid number");
    }
    console.log('Found total units consumed:', totalUnitsConsumed); // Debug log

    // Extract units per day - look for patterns like "Your average daily usage: 12.7619 units"
    const unitsPerDayMatch = text.match(/(?:Your\s*average\s*daily\s*usage|Average\s*daily\s*usage)[\s:]*([\d,]+\.?\d*)\s*(?:units?|kWh)?/i);
    let unitsPerDay = 0;
    
    if (unitsPerDayMatch) {
      unitsPerDay = parseFloat(unitsPerDayMatch[1].replace(/,/g, ''));
      console.log('Found units per day:', unitsPerDay);
    } else {
      // Calculate units per day if not found in text
      const startDate = new Date(billDateRangeStart);
      const endDate = new Date(billDateRangeEnd);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 0) {
        unitsPerDay = totalUnitsConsumed / daysDiff;
        console.log('Calculated units per day:', unitsPerDay);
      }
    }

    // Extract current meter reading - look for "Current meter reading" or similar patterns
    // Handle the case where the reading might be prefixed with '^' for estimated readings
    let meterReading = 0;
    
    // Look for "Anytime usage" text and parse the concatenated numbers manually
    const anytimeUsageRegex = /Anytime usage[^\n]*/gi;
    const matches = text.match(anytimeUsageRegex);
    if (matches) {
      console.log('Found "Anytime usage" lines:', matches);
      
             // Parse the first match manually
       const firstMatch = matches[0];
       const numbersOnly = firstMatch.replace(/Anytime usage/i, '').replace(/\^/g, '').trim();
       console.log('Numbers only:', numbersOnly);
       
       // Check if we have spaces (like "876 1604 728.0000") or concatenated numbers
       if (numbersOnly.includes(' ')) {
         console.log('Found spaced format, parsing with spaces');
         const spacedMatch = numbersOnly.match(/^(\d+)\s+(\d+)\s+(\d+\.?\d*)$/);
         if (spacedMatch) {
           console.log('Found spaced format match:', spacedMatch[0]);
           console.log('Previous reading:', spacedMatch[1]);
           console.log('Current reading:', spacedMatch[2]);
           console.log('Units:', spacedMatch[3]);
           
           const previousReading = parseFloat(spacedMatch[1]);
           const currentReading = parseFloat(spacedMatch[2]);
           const consumedUnits = parseFloat(spacedMatch[3]);
           
           // Validate: Current = Previous + Consumed
           const expectedCurrent = previousReading + consumedUnits;
           const difference = Math.abs(currentReading - expectedCurrent);
           
           console.log('Spaced format validation:');
           console.log('  Previous reading:', previousReading);
           console.log('  Current reading:', currentReading);
           console.log('  Consumed units:', consumedUnits);
           console.log('  Expected current:', expectedCurrent);
           console.log('  Difference:', difference);
           
           if (difference <= 1) {
             console.log('Spaced format validation passed');
             meterReading = currentReading;
             console.log('Using current reading as meter reading:', meterReading);
           } else {
             console.log('Spaced format validation failed');
           }
         }
              } else {
         console.log('Found concatenated format, trying digit patterns');
         
         // For the example "8409084220130.0000", we need to parse:
         // Previous: 84090 (5 digits)
         // Current: 84220 (5 digits)
         // Consumed: 130.0000
         
         // Try different combinations of digit lengths
         const possibleParsings = [
           // Try 5+5 digits first (most common for meter readings)
           { pattern: /^(\d{5})(\d{5})(\d+\.?\d*)$/, desc: '5+5 digits' },
           // Try 4+4 digits
           { pattern: /^(\d{4})(\d{4})(\d+\.?\d*)$/, desc: '4+4 digits' },
           // Try 4+5 digits
           { pattern: /^(\d{4})(\d{5})(\d+\.?\d*)$/, desc: '4+5 digits' },
           // Try 5+4 digits
           { pattern: /^(\d{5})(\d{4})(\d+\.?\d*)$/, desc: '5+4 digits' },
           // Try 6+6+5 digits (for cases with 5-digit consumed units)
           { pattern: /^(\d{6})(\d{6})(\d{5}\.?\d*)$/, desc: '6+6+5 digits' },
           // Try 6+6+4 digits (for cases with 4-digit consumed units)
           { pattern: /^(\d{6})(\d{6})(\d{4}\.?\d*)$/, desc: '6+6+4 digits' },
           // Try 6+6+3 digits (for cases like 13631013639282.0000)
           { pattern: /^(\d{6})(\d{6})(\d{3}\.?\d*)$/, desc: '6+6+3 digits' },
           // Try 6+6+2 digits (for cases with 2-digit consumed units)
           { pattern: /^(\d{6})(\d{6})(\d{2}\.?\d*)$/, desc: '6+6+2 digits' },
           // Try 5+6+3 digits (for cases like 13631013639282.0000)
           { pattern: /^(\d{5})(\d{6})(\d{3}\.?\d*)$/, desc: '5+6+3 digits' },
           // Try 3+3+3 digits (for cases like 410876466.0000)
           { pattern: /^(\d{3})(\d{3})(\d{3}\.?\d*)$/, desc: '3+3+3 digits' },
           // Try 3+4+3 digits (for cases like 77860^78128268.0000)
           { pattern: /^(\d{3})(\d{4})(\d{3}\.?\d*)$/, desc: '3+4+3 digits' },
           // Try 5+4+3 digits (for cases like 77860^78128268.0000)
           { pattern: /^(\d{5})(\d{4})(\d{3}\.?\d*)$/, desc: '5+4+3 digits' }
         ];
         
         for (const parsing of possibleParsings) {
           const match = numbersOnly.match(parsing.pattern);
           if (match) {
             console.log(`Found match with ${parsing.desc}:`, match[0]);
             console.log('Previous reading:', match[1]);
             console.log('Current reading:', match[2]);
             console.log('Units:', match[3]);
             
             const previousReading = parseFloat(match[1]);
             const currentReading = parseFloat(match[2]);
             const consumedUnits = parseFloat(match[3]);
             
             // Validate: Current = Previous + Consumed
             const expectedCurrent = previousReading + consumedUnits;
             const difference = Math.abs(currentReading - expectedCurrent);
             
             console.log('Validation check:');
             console.log('  Previous reading:', previousReading);
             console.log('  Current reading:', currentReading);
             console.log('  Consumed units:', consumedUnits);
             console.log('  Expected current (Previous + Consumed):', expectedCurrent);
             console.log('  Difference:', difference);
             
             if (difference <= 1) { // Allow for small rounding differences
               console.log('Validation passed - readings are consistent');
               meterReading = currentReading;
               console.log('Using current reading as meter reading:', meterReading);
               break; // Found a valid parsing
             } else {
               console.log('Validation failed - trying next pattern');
             }
           }
         }
         
         if (meterReading === 0) {
           console.log('No valid parsing found with any pattern');
         }
       }
    } else {
      console.log('No "Anytime usage" text found at all');
    }
    
    if (meterReading === 0) {
      throw new Error("Could not find meter reading in bill - meter reading must be a positive number");
    }
    
    console.log('Final meter reading value being returned:', meterReading);
    
    // Validate that we have a valid meter reading
    if (meterReading <= 0) {
      throw new Error("Invalid meter reading - must be a positive number");
    }

    // Check if the reading is estimated - look for "^" symbol next to meter readings
    const isEstimated = /\^/.test(text);
    console.log('Is estimated reading:', isEstimated);

    return {
      accountNumber,
      billAmount,
      billDate,
      billDateRangeStart,
      billDateRangeEnd,
      totalUnitsConsumed,
      unitsPerDay,
      isEstimated,
      meterReading
    };
  } catch (error) {
    console.error('Electricity bill parsing error:', error);
    throw error instanceof Error ? error : new Error('Failed to parse electricity bill');
  }
}

function parseDate(dateStr: string): string {
  // Check if the date is in the format "13 Mar 2018"
  const monthNameMatch = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (monthNameMatch) {
    const day = monthNameMatch[1].padStart(2, '0');
    const month = MONTH_MAP[monthNameMatch[2].toLowerCase()];
    const year = monthNameMatch[3];
    return `${year}-${month}-${day}`;
  } else {
    // Handle numeric date format (fallback)
    const cleanDate = dateStr.replace(/\s+/g, '');
    const dateParts = cleanDate.split(/[/-]/);
    if (dateParts.length === 3) {
      const [day, month, year] = dateParts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    throw new Error(`Unable to parse date: ${dateStr}`);
  }
}
