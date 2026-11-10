import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import oracledb from 'oracledb';

export const dynamic = 'force-dynamic';

// Helper function to safely handle date conversion
function safeDateConvert(dateStr: any): string | null {
  if (!dateStr) return null;
  try {
    // Try to parse and format the date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (err) {
    return null;
  }
}

export async function GET(request: Request) {
  const headersList = await headers();
  const accept = headersList.get('accept');

  // Check if client is requesting Server-Sent Events
  if (accept?.includes('text/event-stream')) {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendProgress = async (message: string) => {
      await writer.write(encoder.encode(`data: ${message}\n\n`));
    };

    // Keep connection alive with shorter interval
    const keepAlive = setInterval(async () => {
      await sendProgress('Processing...');
    }, 5000);

    setTimeout(() => {
      clearInterval(keepAlive);
      writer.close();
    }, 120000); // 2 minute timeout

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  let connection;
  let errorDetails = [];
  
  try {
    console.log('Setting up Oracle connection...');
    
    // Force thick mode for Oracle 11g compatibility
    try {
      await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
      console.log('Oracle Client initialized in thick mode');
    } catch (err: any) {
      if (!err.message.includes('NJS-076') && !err.message.includes('already initialized')) {
        throw new Error('Oracle thick mode is required for this database version. Please ensure Oracle Client is installed.');
      }
    }

    // Set output format and fetch type
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];
    
    connection = await oracledb.getConnection({
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: '192.168.11.118:1521/newcrm'
    });

    console.log('✅ Connected to Oracle');

    // First get the current NLS settings
    const nlsSettings = await connection.execute(`
      SELECT PARAMETER, VALUE 
      FROM NLS_SESSION_PARAMETERS 
      WHERE PARAMETER IN ('NLS_DATE_FORMAT', 'NLS_DATE_LANGUAGE')
    `);
    console.log('Current NLS Settings:', nlsSettings.rows);
    
    // Try different date formats
    const dateFormats = [
      'DD-MON-RR',
      'YYYY-MM-DD',
      'DD/MM/YYYY',
      'MM/DD/YYYY',
      'YYYY/MM/DD'
    ];
    
    let successfulFormat = null;
    for (const format of dateFormats) {
      try {
        await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = '${format}'`);
        await connection.execute(`ALTER SESSION SET NLS_DATE_LANGUAGE = 'AMERICAN'`);
        
        // Try to fetch a single date to test the format
        const testResult = await connection.execute(`
          SELECT BILNG_DATE 
          FROM hcs_edams.data_fin_gov 
          WHERE BILNG_DATE IS NOT NULL 
          AND ROWNUM = 1
        `);
        
        if (testResult.rows && testResult.rows.length > 0) {
          successfulFormat = format;
          console.log(`✅ Found working date format: ${format}`);
          break;
        }
      } catch (err: any) {
        errorDetails.push(`Format ${format} failed: ${err.message}`);
        continue;
      }
    }

    if (!successfulFormat) {
      console.log('⚠️ No date format worked, proceeding with base query only');
    }

    // Get non-date data
    const baseQuery = `
      SELECT 
        CSTYPE,
        BRANCHE,
        COSTCENTER,
        CONTRACT,
        ENTAGTAM,
        SEWER,
        TANZEEM,
        ESTDAMA,
        TAXES,
        ROUNDING,
        WATERCREDIT,
        SEWERCREDIT,
        WATERDEBIT,
        SEWERDEBIT,
        CONSUMP
      FROM hcs_edams.data_fin_gov
      WHERE ROWNUM <= 100
    `;

    console.log('Executing base query...');
    const baseResult = await connection.execute(baseQuery, [], {
      prefetchRows: 100,
      fetchArraySize: 100
    });

    let dateResults = [];
    
    // If we found a working date format, try to get dates
    if (successfulFormat) {
      try {
        console.log(`Attempting to get dates using format: ${successfulFormat}`);
        const dateResult = await connection.execute(`
          SELECT ROWID, 
                 TO_CHAR(BILNG_DATE, '${successfulFormat}') as BILNG_DATE,
                 DUMP(BILNG_DATE) as DATE_DUMP
          FROM hcs_edams.data_fin_gov
          WHERE ROWNUM <= 100
        `);
        if (dateResult.rows) {
          dateResults = dateResult.rows as any[];
        }
      } catch (err: any) {
        errorDetails.push(`Final date query failed: ${err.message}`);
      }
    }

    // Merge the results
    const mergedRows = (baseResult.rows || []).map((row: any, index: number) => {
      const dateInfo = dateResults[index] || {};
      return {
        ...row,
        BILNG_DATE: dateInfo.BILNG_DATE ? safeDateConvert(dateInfo.BILNG_DATE) : null,
        DATE_DUMP: dateInfo.DATE_DUMP || null
      };
    });
    
    console.log(`✅ Query successful! Retrieved ${mergedRows.length} rows`);

    return NextResponse.json({
      success: true,
      data: mergedRows,
      metadata: {
        ...baseResult.metaData,
        dateStatus: dateResults.length > 0 ? 'included' : 'error',
        dateFormat: successfulFormat,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined
      },
      rowCount: mergedRows.length
    });

  } catch (err: any) {
    console.error('Error:', err.message);
    return NextResponse.json({
      success: false,
      error: err.message,
      errorDetails: errorDetails,
      details: err.stack
    }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
} 