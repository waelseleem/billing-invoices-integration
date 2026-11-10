const oracledb = require('oracledb');
const { execSync } = require('child_process');

// Common Oracle service names and SIDs to try
const commonServices = [
  // Service Names
  'XE', 'ORCL', 'ORCLPDB1', 'XEPDB1', 'PDB1', 'ORCL.WORLD', 
  'PROD', 'DEV', 'TEST', 'HCS', 'BILLING', 'FIN', 'EDAMS',
  // Try with domain variations
  'XE.WORLD', 'ORCL.localdomain', 'ORCL.local'
];

async function diagnoseOracleServices() {
  console.log('🔍 ORACLE SERVICE DISCOVERY TOOL');
  console.log('=' .repeat(60));
  console.log(`📡 Target Server: 192.168.11.118:1521`);
  console.log('=' .repeat(60));

  // Initialize Oracle Client
  try {
    await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
    console.log('✅ Oracle Client initialized successfully');
  } catch (err) {
    if (err.message.includes('NJS-076') || err.message.includes('already initialized')) {
      console.log('✅ Oracle Client was already initialized');
    } else {
      console.log('⚠️  Using Thin mode...');
      oracledb.thin = true;
    }
  }

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  // Method 1: Try tnsping if available
  console.log('\n📋 Method 1: TNS Ping Test');
  console.log('-'.repeat(30));
  try {
    const tnsPing = execSync('tnsping 192.168.11.118:1521', { encoding: 'utf8', timeout: 10000 });
    console.log('✅ TNS Ping result:', tnsPing);
  } catch (err) {
    console.log('⚠️  TNS Ping not available or failed');
  }

  // Method 2: Test various service names
  console.log('\n📋 Method 2: Service Name Discovery');
  console.log('-'.repeat(30));
  
  const workingConfigs = [];
  
  for (const serviceName of commonServices) {
    const testConfigs = [
      // Service name format
      {
        user: 'hcs_fin',
        password: 'hcs_fin',
        connectString: `192.168.11.118:1521/${serviceName}`,
        type: 'SERVICE_NAME',
        name: serviceName
      },
      // SID format
      {
        user: 'hcs_fin',
        password: 'hcs_fin',  
        connectString: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SID=${serviceName})))`,
        type: 'SID',
        name: serviceName
      }
    ];

    for (const config of testConfigs) {
      try {
        console.log(`🔍 Testing ${config.type}: ${config.name}...`);
        
        const connectionPromise = oracledb.getConnection(config);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 5000)
        );
        
        const connection = await Promise.race([connectionPromise, timeoutPromise]);
        
        // If we get here, connection succeeded!
        console.log(`✅ SUCCESS! ${config.type}: ${config.name} works!`);
        
        try {
          // Test basic query
          const result = await connection.execute('SELECT 1 FROM DUAL');
          console.log('✅ Query test passed');
          
          workingConfigs.push({
            ...config,
            status: 'WORKING'
          });
        } catch (queryErr) {
          console.log('⚠️  Connection works but query failed:', queryErr.message);
        }
        
        await connection.close();
        break; // Found working config for this service
        
      } catch (err) {
        if (err.message.includes('timeout')) {
          console.log(`⏱️  ${config.type}: ${config.name} - timeout`);
        } else if (err.message.includes('ORA-01017')) {
          console.log(`🔑 ${config.type}: ${config.name} - Invalid credentials (but service exists!)`);
          workingConfigs.push({
            ...config,
            status: 'WRONG_CREDENTIALS'
          });
        } else if (err.message.includes('ORA-12514') || err.message.includes('ORA-12505')) {
          // Service/SID not found - continue silently
        } else {
          console.log(`❓ ${config.type}: ${config.name} - ${err.message}`);
        }
      }
    }
  }

  // Method 3: Try to discover through listener
  console.log('\n📋 Method 3: Listener Service Query');
  console.log('-'.repeat(30));
  
  // Try connecting as SYSTEM or other system users to query services
  const systemUsers = [
    { user: 'SYSTEM', password: 'oracle' },
    { user: 'SYSTEM', password: 'system' },
    { user: 'SYS', password: 'oracle' },
    { user: 'sys', password: 'sys' }
  ];

  for (const systemUser of systemUsers) {
    for (const serviceName of ['XE', 'ORCL']) {
      try {
        const connection = await oracledb.getConnection({
          user: systemUser.user,
          password: systemUser.password,
          connectString: `192.168.11.118:1521/${serviceName}`
        });
        
        console.log(`✅ Connected as ${systemUser.user} to ${serviceName}`);
        
        try {
          // Query available services
          const services = await connection.execute(`
            SELECT name, pdb FROM v$services 
            WHERE name NOT LIKE 'SYS%'
          `);
          console.log('📊 Available services:', services.rows);
        } catch (serviceErr) {
          console.log('⚠️  Could not query services:', serviceErr.message);
        }
        
        await connection.close();
        break;
        
      } catch (err) {
        // Continue silently
      }
    }
  }

  // Results summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DISCOVERY RESULTS');
  console.log('='.repeat(60));
  
  if (workingConfigs.length > 0) {
    console.log('✅ FOUND WORKING CONFIGURATIONS:');
    workingConfigs.forEach((config, index) => {
      console.log(`\n${index + 1}. ${config.type}: ${config.name}`);
      console.log(`   Connect String: ${config.connectString}`);
      console.log(`   Status: ${config.status}`);
      console.log(`   User: ${config.user}`);
    });
    
    console.log('\n🎯 RECOMMENDED CONNECTION STRING:');
    const best = workingConfigs.find(c => c.status === 'WORKING') || workingConfigs[0];
    console.log(`   ${best.connectString}`);
    
  } else {
    console.log('❌ NO WORKING CONFIGURATIONS FOUND');
    console.log('\n🔧 NEXT STEPS:');
    console.log('   1. Contact your DBA to get the correct:');
    console.log('      - Service Name or SID');
    console.log('      - Port number (if not 1521)');
    console.log('      - Database credentials');
    console.log('   2. Check if Oracle server is actually running');
    console.log('   3. Verify network connectivity and firewall settings');
    console.log('   4. Try running this from server console:');
    console.log('      lsnrctl status');
    console.log('      lsnrctl services');
  }
  
  console.log('='.repeat(60));
}

async function diagnoseOracleConnection() {
    let connection;
    try {
        console.log('Attempting connection to Oracle...');
        
        connection = await oracledb.getConnection({
            user: 'hcs_fin',
            password: 'hcs_fin',
            connectString: '192.168.11.118:1521/newcrm'
        });
        
        console.log('✅ Connection successful');

        // Test 1: Simple connection test
        console.log('\nTest 1: Basic Query');
        const test1 = await connection.execute('SELECT 1 FROM DUAL');
        console.log('✅ Basic query successful');

        // Test 2: Check if view exists
        console.log('\nTest 2: View Existence');
        const test2 = await connection.execute(`
            SELECT VIEW_NAME, OWNER 
            FROM ALL_VIEWS 
            WHERE OWNER = 'HCS_EDAMS' 
            AND VIEW_NAME = 'DATA_FIN'
        `);
        console.log('View check result:', test2.rows);

        // Test 3: Get row count
        console.log('\nTest 3: Row Count');
        const test3 = await connection.execute(`
            SELECT COUNT(*) as total_rows 
            FROM hcs_edams.data_fin
        `);
        console.log('Total rows:', test3.rows[0].TOTAL_ROWS);

        // Test 4: Sample data without date conversion
        console.log('\nTest 4: Sample Data (No Date Conversion)');
        const test4 = await connection.execute(`
            SELECT 
                CSTYPE, BRANCHE, COSTCENTER, CONTRACT,
                ENTAGTAM, SEWER, TANZEEM, ESTDAMA
            FROM hcs_edams.data_fin
            WHERE ROWNUM <= 5
        `);
        console.log('Sample data:', test4.rows);

        // Test 5: Check date format in the database
        console.log('\nTest 5: Date Format Check');
        const test5 = await connection.execute(`
            SELECT 
                BILNG_DATE,
                TO_CHAR(BILNG_DATE, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM hcs_edams.data_fin
            WHERE ROWNUM = 1
        `);
        console.log('Date format check:', test5.rows);

    } catch (err) {
        console.error('Error during diagnosis:', err);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('\nConnection closed successfully');
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

// Run diagnostics
console.log('🚀 Starting Oracle Service Discovery...\n');
diagnoseOracleServices()
  .then(() => {
    console.log('✅ Discovery completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Discovery failed:', err);
    process.exit(1);
  });

diagnoseOracleConnection(); 