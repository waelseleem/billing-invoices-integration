import oracledb from 'oracledb';
import { logger } from './logger';
import { MonthBillingDto } from '@/lib/types/billing';

// Oracle Client initialization flag
let oracleClientInitialized = false;

// Oracle configuration
export const ORACLE_CONFIG = {
  user: 'hcs_fin',
  password: 'hcs_fin',
  connectString: '192.168.11.118:1521/newcrm',
  connectTimeout: 60000,
  // Oracle client library path
  libDir: 'C:\\oracle\\instantclient_19_26'
};

/**
 * Initialize Oracle Instant Client
 * This should be called once when the application starts
 */
export function initializeOracleClient(): void {
  if (!oracleClientInitialized) {
    try {
      oracledb.initOracleClient({ 
        libDir: ORACLE_CONFIG.libDir
      });
      logger.info('✅ Oracle Instant Client initialized successfully');
      oracleClientInitialized = true;
      
      // Set global Oracle DB options
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];
      
    } catch (err: any) {
      // Handle already initialized case (which is OK)
      if (err.message.includes('NJS-076') || err.message.includes('already initialized')) {
        logger.info('✅ Oracle Instant Client already initialized');
        oracleClientInitialized = true;
      } else {
        logger.error('❌ Failed to initialize Oracle Instant Client:', err.message);
        throw new Error(`Oracle Client initialization failed: ${err.message}`);
      }
    }
  }
}

/**
 * Get Oracle database connection
 */
export async function getOracleConnection(): Promise<oracledb.Connection> {
  // Ensure Oracle client is initialized
  initializeOracleClient();
  
  try {
    const connection = await oracledb.getConnection({
      user: ORACLE_CONFIG.user,
      password: ORACLE_CONFIG.password,
      connectString: ORACLE_CONFIG.connectString,
      connectTimeout: ORACLE_CONFIG.connectTimeout
    });
    
    return connection;
  } catch (err: any) {
    logger.error('❌ Failed to get Oracle connection:', { error: err });
    throw err;
  }
}

/**
 * Close Oracle connection safely
 */
export async function closeOracleConnection(connection: oracledb.Connection): Promise<void> {
  if (connection) {
    try {
      await connection.close();
      logger.info('✅ Oracle connection closed successfully');
    } catch (err: any) {
      logger.error('⚠️ Error closing Oracle connection:', err.message);
    }
  }
}

/**
 * Test Oracle connectivity
 */
export async function testOracleConnection(): Promise<{
  success: boolean;
  connectionTime?: number;
  error?: string;
  version?: string;
}> {
  let connection: oracledb.Connection | null = null;
  
  try {
    const startTime = Date.now();
    connection = await getOracleConnection();
    const connectionTime = Date.now() - startTime;
    
    // Test basic query
    const result = await connection.execute('SELECT banner FROM v$version WHERE ROWNUM = 1');
    const version = (result.rows?.[0] as any)?.BANNER || 'Unknown';
    
    return {
      success: true,
      connectionTime,
      version
    };
    
  } catch (err: any) {
    return {
      success: false,
      error: err.message
    };
  } finally {
    if (connection) {
      await closeOracleConnection(connection);
    }
  }
}

/**
 * Execute Oracle query with proper error handling
 */
export async function executeOracleQuery<T = any>(
  query: string,
  binds: oracledb.BindParameters = {},
  options: oracledb.ExecuteOptions = {}
): Promise<{
  success: boolean;
  data?: T[];
  error?: string;
  rowCount?: number;
}> {
  let connection: oracledb.Connection | null = null;
  
  try {
    connection = await getOracleConnection();
    
    const defaultOptions: oracledb.ExecuteOptions = {
      prefetchRows: 100,
      fetchArraySize: 100,
      ...options
    };
    
    const result = await connection.execute(query, binds, defaultOptions);
    
    return {
      success: true,
      data: result.rows as T[],
      rowCount: result.rows?.length || 0
    };
    
  } catch (err: any) {
    logger.error('❌ Oracle query failed:', err.message);
    return {
      success: false,
      error: err.message
    };
  } finally {
    if (connection) {
      await closeOracleConnection(connection);
    }
  }
}

async function extractBillingData(startDate?: Date, endDate?: Date): Promise<MonthBillingDto[]> {
  // Default to the previous month if no dates are provided
  const now = new Date();
  const firstDayLastMonth = startDate || new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = endDate || new Date(now.getFullYear(), now.getMonth(), 0);

  // Format dates to YYYY-MM-DD for explicit TO_DATE conversion
  const formattedStartDate = firstDayLastMonth.toISOString().split('T')[0];
  const formattedEndDate = lastDayLastMonth.toISOString().split('T')[0];
  
  const query = `
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
      CONSUMP,
      '' as GL_ACCOUNT_CODE,
      '' as GL_ACCOUNT_NAME,
      '' as ACTIVITY_CODE,
      '' as BRANCH_CODE
    FROM HCS_EDAMS.DATA_FIN
    WHERE TRUNC(BILNG_DATE) BETWEEN TO_DATE(:startDate, 'YYYY-MM-DD') AND TO_DATE(:endDate, 'YYYY-MM-DD')
  `;

  const binds = {
    startDate: formattedStartDate,
    endDate: formattedEndDate,
  };

  const result = await executeOracleQuery(query, binds);

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch billing data from Oracle.');
  }

  // Map Oracle result to our data structure
  const billingData: MonthBillingDto[] = result.data.map((row: any) => ({
    lineId: row.LINE_ID.toString(),
    csType: row.CSTYPE || '',
    branche: row.BRANCHE || '',
    costCenter: row.COSTCENTER || '',
    billingDate: row.BILNG_DATE ? new Date(row.BILNG_DATE) : new Date(),
    entagtam: Number(row.ENTAGTAM || 0),
    sewer: Number(row.SEWER || 0),
    tanzeem: Number(row.TANZEEM || 0),
    estdama: Number(row.ESTDAMA || 0),
    contract: Number(row.CONTRACT || 0),
    taxes: Number(row.TAXES || 0),
    rounding: Number(row.ROUNDING || 0),
    waterCredit: Number(row.WATERCREDIT || 0),
    sewerCredit: Number(row.SEWERCREDIT || 0),
    waterDebit: Number(row.WATERDEBIT || 0),
    sewerDebit: Number(row.SEWERDEBIT || 0),
    consump: Number(row.CONSUMP || 0),
    glAccountCode: row.GL_ACCOUNT_CODE || row.CSTYPE || '',
    glAccountName: row.GL_ACCOUNT_NAME || '',
    activityCode: row.ACTIVITY_CODE || '21',
    branchCode: row.BRANCH_CODE || row.BRANCHE || ''
  }));

  logger.info(`Oracle data extraction completed. Records found: ${billingData.length}`);
  return billingData;
}

export const oracleService = {
  initializeOracleClient,
  getOracleConnection,
  closeOracleConnection,
  testOracleConnection,
  executeOracleQuery,
  extractBillingData
};

process.on('SIGINT', async () => {
  console.log('Shutting down Oracle service...');
  process.exit(0);
}); 