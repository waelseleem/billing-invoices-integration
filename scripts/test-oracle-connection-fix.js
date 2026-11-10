const oracledb = require('oracledb');

// Test configurations
const configs = [
  {
    name: 'Simple Connection String',
    config: {
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: '192.168.11.118:1521/newcrm',
      connectTimeout: 60000
    }
  },
  {
    name: 'TNS Style Connection',
    config: {
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: '(DESCRIPTION=(CONNECT_TIMEOUT=60)(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=newcrm)))',
      connectTimeout: 60000
    }
  },
  {
    name: 'Alternative Service Name',
    config: {
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: '192.168.11.118:1521/ORCL',
      connectTimeout: 60000
    }
  }
];

// Initialize Oracle client
try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
  console.log('✓ Oracle Client initialized successfully');
} catch (err) {
  if (!err.message.includes('NJS-076') && !err.message.includes('already initialized')) {
    console.error('✗ Failed to initialize Oracle client:', err.message);
    process.exit(1);
  } else {
    console.log('✓ Oracle Client already initialized');
  }
}

async function testConnection(name, config) {
  console.log(`\n--- Testing ${name} ---`);
  console.log(`Connection String: ${config.connectString}`);
  console.log(`User: ${config.user}`);
  
  let connection;
  try {
    const startTime = Date.now();
    connection = await oracledb.getConnection(config);
    const connectTime = Date.now() - startTime;
    
    console.log(`✓ Connection established in ${connectTime}ms`);
    
    // Test basic query
    const result = await connection.execute('SELECT 1 as TEST_VALUE FROM DUAL');
    console.log(`✓ Basic query successful: ${JSON.stringify(result.rows[0])}`);
    
    // Test target table access
    try {
      const tableTest = await connection.execute(
        'SELECT COUNT(*) as ROW_COUNT FROM hcs_edams.data_fin WHERE ROWNUM <= 1'
      );
      console.log(`✓ Target table accessible: ${JSON.stringify(tableTest.rows[0])}`);
    } catch (tableErr) {
      console.log(`⚠ Target table test failed: ${tableErr.message}`);
    }
    
    return { success: true, connectTime };
    
  } catch (err) {
    console.log(`✗ Connection failed: ${err.message}`);
    console.log(`Error Code: ${err.errorNum || 'Unknown'}`);
    return { success: false, error: err.message, errorNum: err.errorNum };
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('✓ Connection closed');
      } catch (closeErr) {
        console.log(`⚠ Error closing connection: ${closeErr.message}`);
      }
    }
  }
}

async function runDiagnostics() {
  console.log('=== Oracle Connection Diagnostics ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Node.js Version: ${process.version}`);
  
  const results = [];
  
  for (const { name, config } of configs) {
    const result = await testConnection(name, config);
    results.push({ name, result });
  }
  
  console.log('\n=== Summary ===');
  results.forEach(({ name, result }) => {
    if (result.success) {
      console.log(`✓ ${name}: SUCCESS (${result.connectTime}ms)`);
    } else {
      console.log(`✗ ${name}: FAILED - ${result.error}`);
    }
  });
  
  const successfulConnections = results.filter(r => r.result.success);
  if (successfulConnections.length > 0) {
    console.log(`\n🎉 ${successfulConnections.length} connection method(s) successful!`);
    console.log('Your Oracle database is accessible.');
  } else {
    console.log('\n❌ All connection methods failed.');
    console.log('\nTroubleshooting steps:');
    console.log('1. Verify Oracle database is running on 192.168.11.118:1521');
    console.log('2. Check if service name "newcrm" is correct');
    console.log('3. Verify username/password: hcs_fin/hcs_fin');
    console.log('4. Test network connectivity: ping 192.168.11.118');
    console.log('5. Check firewall settings for port 1521');
    console.log('6. Verify Oracle listener is running');
  }
}

// Run diagnostics
runDiagnostics().catch(err => {
  console.error('Diagnostic script failed:', err);
  process.exit(1);
}); 