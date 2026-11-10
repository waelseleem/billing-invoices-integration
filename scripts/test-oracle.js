const oracledb = require('oracledb');

// Enable debug mode
process.env.NODE_ORACLEDB_DRIVER_MODE = 'thin';
oracledb.thin = true;

// Configuration
const dbConfig = {
  user: process.env.ORACLE_USER || 'hcs_fin',
  password: process.env.ORACLE_PASSWORD || 'hcs_fin',
  connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XE',
  poolMin: 2,
  poolMax: 5,
  poolIncrement: 1,
  poolTimeout: 60
};

async function initializeOracleClient() {
  try {
    await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
    console.log('Oracle Client initialized successfully');
  } catch (err) {
    if (err.message.includes('NJS-076')) {
      console.log('Oracle Client was already initialized');
    } else {
      console.error('Error initializing Oracle Client:', err);
      throw err;
    }
  }
}

async function createConnectionPool() {
  try {
    // Create a connection pool
    await oracledb.createPool(dbConfig);
    console.log('Connection pool created successfully');
  } catch (err) {
    console.error('Error creating connection pool:', err);
    throw err;
  }
}

async function validateData(rows) {
  if (!rows || rows.length === 0) {
    console.warn('Warning: No data returned from query');
    return;
  }

  console.log(`Retrieved ${rows.length} rows of data`);
  
  // Basic data validation
  rows.forEach((row, index) => {
    if (!row.LINE_ID) {
      console.warn(`Warning: Row ${index + 1} missing LINE_ID`);
    }
    if (!row.BILNG_DATE) {
      console.warn(`Warning: Row ${index + 1} missing BILNG_DATE`);
    }
  });
}

async function testConnection() {
  let connection;
  
  try {
    console.log('Oracle Configuration:');
    
    // Initialize Oracle Client
    try {
      await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
      console.log('- Oracle Client initialized successfully');
    } catch (err) {
      if (err.message.includes('NJS-076')) {
        console.log('- Oracle Client was already initialized');
      } else {
        throw err;
      }
    }

    console.log('- Driver Mode:', process.env.NODE_ORACLEDB_DRIVER_MODE || 'thick');
    console.log('- Oracle Client Version:', oracledb.versionString);
    console.log('- Oracle Client Runtime: Thick');

    // Set output format to OBJECT
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    
    // Oracle connection configuration
    const connectionConfig = {
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: 'localhost:1521/XE'
    };

    console.log('\nConnection Configuration:');
    console.log('- User:', connectionConfig.user);
    console.log('- Connect String:', connectionConfig.connectString);

    console.log('\nAttempting to connect to Oracle...');
    connection = await oracledb.getConnection(connectionConfig);
    console.log('Successfully connected to Oracle');

    // Test query
    console.log('\nExecuting test query...');
    const result = await connection.execute(
      'SELECT * FROM HCS_EDAMS.DATA_FIN',
      [], // No bind parameters
      { maxRows: 5 } // Limit rows for testing
    );

    console.log('\nQuery Results:');
    console.log('- Row Count:', result.rows?.length || 0);
    console.log('- First Row:', JSON.stringify(result.rows?.[0], null, 2));
    console.log('- Metadata:', JSON.stringify(result.metaData, null, 2));

  } catch (err) {
    console.error('\nOracle Error Details:');
    console.error('- Error Message:', err.message);
    console.error('- Error Code:', err.errorNum || err.code);
    console.error('- Error Stack:', err.stack);
    
    // Additional error information
    if (err.offset) console.error('- Error Offset:', err.offset);
    if (err.context) console.error('- Error Context:', err.context);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\nConnection closed successfully');
      } catch (err) {
        console.error('\nError closing connection:', err);
      }
    }
  }
}

// Run the test
console.log('Starting Oracle connection test...\n');
testConnection()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nTest failed:', err);
    process.exit(1);
  }); 