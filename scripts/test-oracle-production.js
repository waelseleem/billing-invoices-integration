const oracledb = require('oracledb');

// Production Oracle server configurations to test
const productionConfigs = [
  // Standard service name format
  {
    user: 'hcs_fin',
    password: 'hcs_fin',
    connectString: '192.168.11.118:1521/XE',
    description: 'Production - Service Name XE'
  },
  // Alternative service names
  {
    user: 'hcs_fin',
    password: 'hcs_fin',
    connectString: '192.168.11.118:1521/ORCL',
    description: 'Production - Service Name ORCL'
  },
  // SID format
  {
    user: 'hcs_fin',
    password: 'hcs_fin',
    connectString: '192.168.11.118:1521:XE',
    description: 'Production - SID XE'
  },
  // Full TNS descriptor with SERVICE_NAME
  {
    user: 'hcs_fin',
    password: 'hcs_fin',
    connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=XE)))',
    description: 'Production - TNS with SERVICE_NAME XE'
  },
  // Full TNS descriptor with SID
  {
    user: 'hcs_fin',
    password: 'hcs_fin',
    connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SID=XE)))',
    description: 'Production - TNS with SID XE'
  },
  // Try ORCL as SID
  {
    user: 'hcs_fin',
    password: 'hcs_fin',
    connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SID=ORCL)))',
    description: 'Production - TNS with SID ORCL'
  }
];

async function testProductionConnections() {
  console.log('='.repeat(60));
  console.log('TESTING PRODUCTION ORACLE SERVER: 192.168.11.118');
  console.log('='.repeat(60));

  // Initialize Oracle Client
  try {
    await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
    console.log('✅ Oracle Client initialized successfully');
  } catch (err) {
    if (err.message.includes('NJS-076') || err.message.includes('already initialized')) {
      console.log('✅ Oracle Client was already initialized');
    } else {
      console.log('⚠️  Thick mode failed, trying Thin mode...');
      oracledb.thin = true;
    }
  }

  console.log('📊 Oracle Client Version:', oracledb.versionString);
  console.log('🔧 Driver Mode:', oracledb.thin ? 'Thin' : 'Thick');
  
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  let successfulConfig = null;

  for (let i = 0; i < productionConfigs.length; i++) {
    const config = productionConfigs[i];
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔍 Test ${i + 1}/${productionConfigs.length}: ${config.description}`);
    console.log(`📡 Connect String: ${config.connectString}`);
    console.log(`👤 User: ${config.user}`);
    console.log(`${'='.repeat(50)}`);
    
    let connection;
    try {
      console.log('🔌 Attempting connection...');
      
      // Set a timeout for connection attempts
      const connectionPromise = oracledb.getConnection(config);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
      );
      
      connection = await Promise.race([connectionPromise, timeoutPromise]);
      console.log('✅ CONNECTION SUCCESSFUL!');
      
      // Test basic query
      console.log('🧪 Testing basic query (SELECT 1 FROM DUAL)...');
      const result = await connection.execute('SELECT 1 as test_value FROM DUAL');
      console.log('✅ Basic query successful:', result.rows[0]);
      
      // Test database version
      try {
        const versionResult = await connection.execute('SELECT * FROM v$version WHERE rownum = 1');
        console.log('📋 Database Version:', versionResult.rows[0]);
      } catch (vErr) {
        console.log('⚠️  Could not get database version (normal for restricted users)');
      }
      
      // Test your schema access
      console.log('🔍 Testing schema access...');
      try {
        const schemaResult = await connection.execute(`
          SELECT table_name 
          FROM user_tables 
          WHERE table_name LIKE '%DATA_FIN%' 
          OR table_name LIKE '%FIN%'
        `);
        console.log('📊 Available tables matching FIN pattern:', schemaResult.rows);
      } catch (schemaErr) {
        console.log('⚠️  Schema query failed:', schemaErr.message);
      }
      
      // Try to access your specific table/view
      console.log('🎯 Testing access to HCS_EDAMS.DATA_FIN...');
      try {
        const dataResult = await connection.execute('SELECT COUNT(*) as row_count FROM HCS_EDAMS.DATA_FIN');
        console.log('✅ Table access successful! Row count:', dataResult.rows[0]);
        
        // Get a sample record
        const sampleResult = await connection.execute(`
          SELECT * FROM HCS_EDAMS.DATA_FIN 
          WHERE rownum <= 1
        `);
        console.log('📄 Sample record:', JSON.stringify(sampleResult.rows[0], null, 2));
        
      } catch (tableErr) {
        console.log('❌ Table access failed:', tableErr.message);
        
        // Try alternative table names
        const alternativeTables = [
          'DATA_FIN',
          'DATA_FIN_TABLE',
          'HCS_EDAMS.DATA_FIN_TABLE'
        ];
        
        for (const tableName of alternativeTables) {
          try {
            const altResult = await connection.execute(`SELECT COUNT(*) as row_count FROM ${tableName}`);
            console.log(`✅ Found alternative table ${tableName}! Row count:`, altResult.rows[0]);
            break;
          } catch (altErr) {
            console.log(`❌ ${tableName} not accessible:`, altErr.message);
          }
        }
      }
      
      successfulConfig = config;
      console.log('🎉 THIS CONFIGURATION WORKS! Use this for your API.');
      break; // Success! Exit the loop
      
    } catch (err) {
      console.log('❌ Connection failed:', err.message);
      if (err.message.includes('ORA-12514')) {
        console.log('💡 Hint: Service name not found. Try different service name or SID.');
      } else if (err.message.includes('ORA-12541')) {
        console.log('💡 Hint: Cannot connect to server. Check IP address and port.');
      } else if (err.message.includes('ORA-01017')) {
        console.log('💡 Hint: Invalid credentials. Check username/password.');
      } else if (err.message.includes('timeout')) {
        console.log('💡 Hint: Connection timeout. Check network connectivity.');
      }
    } finally {
      if (connection) {
        try {
          await connection.close();
          console.log('🔌 Connection closed successfully');
        } catch (closeErr) {
          console.error('⚠️  Error closing connection:', closeErr);
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (successfulConfig) {
    console.log('🎊 SUCCESS! Working configuration found:');
    console.log('📋 Connection String:', successfulConfig.connectString);
    console.log('👤 User:', successfulConfig.user);
    console.log('🔧 Description:', successfulConfig.description);
  } else {
    console.log('❌ No working configuration found.');
    console.log('🔧 Troubleshooting suggestions:');
    console.log('   1. Verify Oracle server is running on 192.168.11.118:1521');
    console.log('   2. Check firewall settings');
    console.log('   3. Verify user credentials (hcs_fin/hcs_fin)');
    console.log('   4. Ask DBA for correct service name or SID');
    console.log('   5. Verify user has necessary privileges');
  }
  console.log('='.repeat(60));
}

// Run the production test
console.log('🚀 Starting Production Oracle Server Test...\n');
testProductionConnections()
  .then(() => {
    console.log('\n✅ Production testing completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Production test failed:', err);
    process.exit(1);
  }); 