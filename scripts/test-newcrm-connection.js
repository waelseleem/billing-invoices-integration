const oracledb = require('oracledb');

console.log('🚀 Testing Oracle 11g Connection to "newcrm" service');
console.log('='.repeat(60));
console.log('📊 Server: 192.168.11.118:1521');
console.log('🏷️  Service: newcrm');
console.log('👤 User: hcs_fin');
console.log('📋 View: hcs_edams.data_fin');
console.log('='.repeat(60));

async function testNewCrmConnection() {
  let connection;
  
  try {
    // Initialize Oracle Client
    try {
      await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
      console.log('✅ Oracle Client initialized (Thick mode)');
    } catch (err) {
      if (err.message.includes('NJS-076') || err.message.includes('already initialized')) {
        console.log('✅ Oracle Client already initialized (Thick mode)');
      } else {
        console.log('⚠️  Falling back to Thin mode');
        oracledb.thin = true;
      }
    }

    console.log('📊 Oracle Client Version:', oracledb.versionString);
    console.log('🔧 Driver Mode:', oracledb.thin ? 'Thin' : 'Thick');
    
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    // Test configurations for newcrm service
    const configs = [
      {
        user: 'hcs_fin',
        password: 'hcs_fin',
        connectString: '192.168.11.118:1521/newcrm',
        type: 'SERVICE_NAME',
        description: 'Standard service name format'
      },
      {
        user: 'hcs_fin',
        password: 'hcs_fin',
        connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=newcrm)))',
        type: 'TNS_SERVICE',
        description: 'TNS descriptor with SERVICE_NAME'
      },
      {
        user: 'hcs_fin',
        password: 'hcs_fin',
        connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SID=newcrm)))',
        type: 'TNS_SID',
        description: 'TNS descriptor with SID'
      }
    ];

    console.log('\n🔍 Testing connection configurations...\n');
    
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      console.log(`--- Test ${i + 1}/3: ${config.description} ---`);
      console.log(`Type: ${config.type}`);
      console.log(`Connect String: ${config.connectString}`);
      
      try {
        console.log('🔌 Connecting...');
        
        // Add connection timeout
        const connectionPromise = oracledb.getConnection(config);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 20 seconds')), 20000)
        );
        
        connection = await Promise.race([connectionPromise, timeoutPromise]);
        console.log('✅ CONNECTION SUCCESSFUL!');
        
        // Test basic query
        console.log('🧪 Testing basic query...');
        const basicResult = await connection.execute('SELECT 1 as test_value FROM DUAL');
        console.log('✅ Basic query successful:', basicResult.rows[0]);
        
        // Test database version and info
        try {
          const dbInfo = await connection.execute(`
            SELECT 
              banner as database_version
            FROM v$version 
            WHERE banner LIKE 'Oracle%'
          `);
          console.log('📋 Database Info:', dbInfo.rows[0]?.DATABASE_VERSION || 'Oracle 11g');
        } catch (infoErr) {
          console.log('ℹ️  Database info query skipped (limited privileges)');
        }
        
        // Test access to the specific view
        console.log('🎯 Testing access to hcs_edams.data_fin...');
        try {
          const countResult = await connection.execute(`
            SELECT COUNT(*) as row_count 
            FROM hcs_edams.data_fin
          `);
          console.log('✅ View access successful!');
          console.log('📊 Row count:', countResult.rows[0]);
          
          // Get sample data
          console.log('📄 Fetching sample data...');
          const sampleResult = await connection.execute(`
            SELECT * FROM hcs_edams.data_fin 
            WHERE ROWNUM <= 3
          `);
          
          console.log('✅ Sample data retrieved:');
          console.log('📋 Columns:', sampleResult.metaData?.map(col => col.name) || []);
          console.log('📄 Sample rows:', sampleResult.rows?.length || 0);
          
          if (sampleResult.rows && sampleResult.rows.length > 0) {
            console.log('🔍 First row sample:', JSON.stringify(sampleResult.rows[0], null, 2));
          }
          
        } catch (viewErr) {
          console.log('❌ View access failed:', viewErr.message);
          
          // Try alternative view/table names
          const alternatives = [
            'HCS_EDAMS.DATA_FIN',
            'DATA_FIN', 
            'hcs_edams.DATA_FIN_TABLE'
          ];
          
          console.log('🔍 Trying alternative table names...');
          for (const altName of alternatives) {
            try {
              const altResult = await connection.execute(`SELECT COUNT(*) as row_count FROM ${altName}`);
              console.log(`✅ Found alternative: ${altName} - Row count:`, altResult.rows[0]);
              break;
            } catch (altErr) {
              console.log(`❌ ${altName}: ${altErr.message}`);
            }
          }
        }
        
        await connection.close();
        console.log('🔌 Connection closed successfully');
        
        console.log('\n🎊 SUCCESS! This configuration works:');
        console.log(`   Connection String: ${config.connectString}`);
        console.log(`   Type: ${config.type}`);
        console.log('   Ready for production use! ✨');
        
        return; // Exit on first successful connection
        
      } catch (err) {
        console.log('❌ Connection failed:', err.message);
        
        if (err.message.includes('ORA-12514')) {
          console.log('💡 Service "newcrm" not found - check if Oracle service is running');
        } else if (err.message.includes('ORA-12505')) {
          console.log('💡 SID "newcrm" not found - may need to use SERVICE_NAME instead');
        } else if (err.message.includes('ORA-01017')) {
          console.log('💡 Invalid credentials - check username/password');
        } else if (err.message.includes('ORA-12541')) {
          console.log('💡 Cannot connect to server - check network connectivity');
        } else if (err.message.includes('timeout')) {
          console.log('💡 Connection timeout - check network/firewall');
        }
        
        console.log(''); // Empty line for readability
        
      } finally {
        if (connection) {
          try {
            await connection.close();
          } catch (closeErr) {
            console.error('⚠️ Error closing connection:', closeErr);
          }
        }
      }
    }
    
    console.log('❌ All connection attempts failed');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Verify Oracle service "newcrm" is running');
    console.log('2. Check Oracle listener status on 192.168.11.118:1521');
    console.log('3. Confirm network connectivity and firewall settings');
    console.log('4. Validate credentials with DBA');
    console.log('5. Verify view hcs_edams.data_fin exists and is accessible');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testNewCrmConnection()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test error:', err);
    process.exit(1);
  }); 