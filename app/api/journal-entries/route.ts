import { NextRequest, NextResponse } from 'next/server';
import { SapJournalIntegration } from '@/lib/services/sap-journal-integration';
import { logger } from '@/lib/services/logger';
import oracledb from 'oracledb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locale = searchParams.get('locale') || 'en';
    
    logger.info('Fetching branch-based journal entries for viewer', { locale });

    // Get Oracle data using the same approach as oracle-data route
    let connection;
    let oracleData: any[] = [];
    
    try {
      console.log('Setting up Oracle connection for journal entries...');
      
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

      console.log('✅ Connected to Oracle for journal entries');

      // Set date format
      await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'DD/MM/YYYY'`);
      await connection.execute(`ALTER SESSION SET NLS_DATE_LANGUAGE = 'AMERICAN'`);
      
      // Execute the billing data query
      const result = await connection.execute(`
        SELECT 
          ROWNUM AS LINE_ID,
          CSTYPE,
          BRANCHE,
          COSTCENTER,
          BILNG_DATE,
          ENTAGTAM,
          SEWER,
          TANZEEM,
          ESTDAMA,
          CONTRACT,
          TAXES,
          ROUNDING,
          WATERCREDIT,
          SEWERCREDIT,
          WATERDEBIT,
          SEWERDEBIT,
          CONSUMP
        FROM HCS_EDAMS.DATA_FIN
        WHERE TRUNC(BILNG_DATE) BETWEEN TO_DATE('01/07/2025', 'DD/MM/YYYY') AND TO_DATE('31/07/2025', 'DD/MM/YYYY')
      `);

      if (result.rows && result.rows.length > 0) {
        oracleData = result.rows;
        console.log(`✅ Retrieved ${oracleData.length} records for journal entries`);
      }

    } catch (error) {
      logger.error('Oracle query failed for journal entries', { error });
      throw error;
    } finally {
      if (connection) {
        try {
          await connection.close();
          console.log('✅ Oracle connection closed for journal entries');
        } catch (err) {
          console.error('Error closing Oracle connection:', err);
        }
      }
    }
    
    if (!oracleData || oracleData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Oracle data available to create journal entries',
        journalEntry: null
      });
    }

    // Create journal integration instance
    const sapJournalIntegration = new SapJournalIntegration();
    
    // Get the branch-based journal entries data
    const result = await sapJournalIntegration.getJournalEntryData(oracleData, locale);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      journalEntries: result.journalEntries,
      summary: result.summary,
      oracleDataCount: oracleData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching journal entry data', { error });
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch journal entry data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 