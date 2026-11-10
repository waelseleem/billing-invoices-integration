const oracledb = require('oracledb');

console.log('⏳ Simple Patient Oracle View Test');
console.log('🕐 Waiting up to 10 minutes for view calculation');
console.log('='.repeat(50));

async function simplePatientTest() {
  let connection;
  
  try {
    console.log('🔌 Connecting to Oracle...');
    await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    connection = await oracledb.getConnection({
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: '192.168.11.118:1521/newcrm'
    });
    
    console.log('✅ Connected successfully');

    // Test: Give the view 10 minutes to calculate
    console.log('\n⏳ Starting patient query (max 10 minutes)...');
    console.log('💡 The view is calculating a large dataset');
    console.log('☕ Please be patient...');
    
    const startTime = Date.now();
    
    const patientQuery = `
      SELECT 
        CSTYPE,
        BRANCHE,
        COSTCENTER,
        ENTAGTAM
      FROM hcs_edams.data_fin 
      WHERE ROWNUM <= 3
    `;

    try {
      // 10-minute timeout
      const result = await Promise.race([
        connection.execute(patientQuery, [], { maxRows: 3 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('10-minute timeout')), 600000)
        )
      ]);
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      
      console.log(`\n🎉 SUCCESS! View calculated in ${minutes}m ${seconds}s`);
      console.log(`📊 Rows retrieved: ${result.rows?.length || 0}`);
      
      if (result.rows && result.rows.length > 0) {
        console.log('\n📄 Data sample:');
        result.rows.forEach((row, index) => {
          console.log(`   Row ${index + 1}: ${JSON.stringify(row)}`);
        });
      }
      
      console.log('\n✅ View calculation successful with patience!');
      console.log('🚀 Your API should now work with 10-minute timeout');
      
    } catch (queryError) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      
      console.log(`\n❌ Query failed after ${minutes}m ${seconds}s`);
      console.log(`Error: ${queryError.message}`);
      
      if (queryError.message.includes('timeout')) {
        console.log('\n💡 View needs more than 10 minutes to calculate');
        console.log('🔧 Consider asking DBA about view optimization');
      } else {
        console.log('\n💡 Issue is not just timing - may need DBA help');
      }
    }

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n🔌 Connection closed');
      } catch (closeErr) {
        // Ignore
      }
    }
  }
}

console.log('🚀 Starting simple patient test...');
simplePatientTest()
  .then(() => {
    console.log('\n✅ Patient test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }); 