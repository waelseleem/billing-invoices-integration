const oracledb = require('oracledb');

// Most common production Oracle service names
const productionServices = [
  // Most likely candidates for production
  'ORCL',
  'PROD', 
  'PRODUCTION',
  'ORACLE',
  'DB01',
  'MAIN',
  'PRIMARY',
  // SAP-related names
  'SAP',
  'SAPDB',
  'B1',
  'SBO',
  // HCS-specific names
  'HCS',
  'HCSDB',
  'BILLING',
  'FINANCE',
  'EDAMS'
];

async function testCommonServices() {
  console.log('🎯 Testing Most Common Production Oracle Services');
  console.log('='.repeat(55));
  
  try {
    await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
    console.log('✅ Oracle Client initialized');
  } catch (err) {
    if (!err.message.includes('NJS-076')) {
      oracledb.thin = true;
      console.log('ℹ️  Using Thin mode');
    }
  }

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  for (const service of productionServices) {
    const configs = [
      {
        connectString: `192.168.11.118:1521/${service}`,
        type: 'SERVICE',
        name: service
      },
      {
        connectString: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=192.168.11.118)(PORT=1521))(CONNECT_DATA=(SID=${service})))`,
        type: 'SID',
        name: service
      }
    ];

    for (const config of configs) {
      try {
        console.log(`🔍 ${config.type}: ${config.name}`);
        
        const connection = await Promise.race([
          oracledb.getConnection({
            user: 'hcs_fin',
            password: 'hcs_fin',
            connectString: config.connectString
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
        ]);

        console.log(`✅ SUCCESS! Found working connection:`);
        console.log(`   Type: ${config.type}`);
        console.log(`   Name: ${config.name}`);
        console.log(`   Connection String: ${config.connectString}`);
        
        // Test query
        const result = await connection.execute('SELECT 1 FROM DUAL');
        console.log(`   Query Test: PASSED`);
        
        await connection.close();
        
        console.log('\n🎊 COPY THIS CONNECTION STRING FOR YOUR API:');
        console.log(`"${config.connectString}"`);
        
        return; // Exit on first success
        
      } catch (err) {
        if (err.message.includes('ORA-01017')) {
          console.log(`🔑 ${config.type}: ${service} - Service exists but wrong credentials!`);
          console.log(`   Connection String: ${config.connectString}`);
          console.log('   ⚠️  Check username/password with your DBA');
        } else if (!err.message.includes('ORA-12514') && !err.message.includes('ORA-12505')) {
          console.log(`❓ ${config.type}: ${service} - ${err.message}`);
        }
      }
    }
  }
  
  console.log('\n❌ No working services found in common list.');
  console.log('💡 Please contact your DBA for the correct service name.');
}

testCommonServices()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  }); 