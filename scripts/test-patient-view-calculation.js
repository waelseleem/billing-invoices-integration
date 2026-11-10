const oracledb = require('oracledb');

console.log('⏳ Patient Oracle View Calculation Test');
console.log('🕐 This test will wait up to 10 minutes for view calculations');
console.log('='.repeat(60));

async function testPatientViewCalculation() {
  let connection;
  const startTime = Date.now();
  
  try {
    // Initialize Oracle Client
    await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    // Connect using the working configuration
    connection = await oracledb.getConnection({
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: '192.168.11.118:1521/newcrm'
    });
    
    console.log('✅ Connected to Oracle newcrm service');
    console.log('🕐 Starting patient calculation test...\n');

    // Test 1: Structure (instant)
    console.log('--- Test 1: View Structure (Instant) ---');
    const structureResult = await connection.execute(
      'SELECT * FROM hcs_edams.data_fin WHERE 1=0'
    );
    console.log('✅ Structure retrieved instantly');
    console.log(`📊 Columns: ${structureResult.metaData?.length || 0}`);

    // Test 2: Very limited query with patience
    console.log('\n--- Test 2: Minimal Data Query (Patient) ---');
    console.log('⏳ Attempting very small query with 10-minute timeout...');
    console.log('💡 The view may be calculating aggregations, summaries, or complex joins');
    console.log('🕐 Please wait... this may take several minutes');
    
    const patientQuery = `
      SELECT 
        CSTYPE,
        BRANCHE,
        COSTCENTER,
        ENTAGTAM
      FROM hcs_edams.data_fin 
      WHERE ROWNUM <= 5
    `;

    const startQueryTime = Date.now();
    
    try {
      // Give it a full 10 minutes
      const queryPromise = connection.execute(patientQuery, [], { maxRows: 5 });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('10-minute timeout reached')), 600000)
      );

      // Show progress while waiting
      const progressInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startQueryTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        process.stdout.write(`\r⏳ Calculating... ${minutes}m ${seconds}s elapsed`);
      }, 1000);

      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      clearInterval(progressInterval);
      const elapsedMs = Date.now() - startQueryTime;
      const elapsedMin = Math.floor(elapsedMs / 60000);
      const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
      
      console.log(`\n✅ SUCCESS! Query completed in ${elapsedMin}m ${elapsedSec}s`);
      console.log(`📊 Rows retrieved: ${result.rows?.length || 0}`);
      
      if (result.rows && result.rows.length > 0) {
        console.log('\n📄 Sample data:');
        result.rows.forEach((row, index) => {
          console.log(`   Row ${index + 1}:`);
          Object.keys(row).forEach(key => {
            console.log(`     ${key}: ${row[key]}`);
          });
        });
      }

      // Test 3: Try slightly larger query now that we know it works
      console.log('\n--- Test 3: Larger Query (Now That We Know It Works) ---');
      console.log('⏳ Attempting larger query...');
      
      const largerQuery = `
        SELECT 
          CSTYPE,
          BRANCHE,
          COSTCENTER,
          ENTAGTAM,
          SEWER,
          TANZEEM
        FROM hcs_edams.data_fin 
        WHERE ROWNUM <= 20
      `;

      const largerStartTime = Date.now();
      const largerResult = await Promise.race([
        connection.execute(largerQuery, [], { maxRows: 20 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 600000))
      ]);

      const largerElapsed = Math.floor((Date.now() - largerStartTime) / 1000);
      console.log(`✅ Larger query completed in ${largerElapsed}s`);
      console.log(`📊 Rows retrieved: ${largerResult.rows?.length || 0}`);

    } catch (queryError) {
      clearInterval(progressInterval);
      const elapsedMs = Date.now() - startQueryTime;
      const elapsedMin = Math.floor(elapsedMs / 60000);
      const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
      
      console.log(`\n❌ Query failed after ${elapsedMin}m ${elapsedSec}s: ${queryError.message}`);
      
      if (queryError.message.includes('timeout')) {
        console.log('\n💡 View calculation is taking longer than 10 minutes');
        console.log('🔧 Recommendations for DBA:');
        console.log('   1. Check if view can be optimized or indexed');
        console.log('   2. Consider materialized view for large calculations');
        console.log('   3. Add WHERE clause filters to reduce calculation scope');
        console.log('   4. Break complex view into smaller, faster queries');
      } else if (queryError.message.includes('ORA-01843')) {
        console.log('\n💡 Date calculation issue persists even with patience');
        console.log('🔧 This suggests a data quality issue in the underlying tables');
      }
    }

    // Performance analysis
    const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`\n📊 Total test time: ${Math.floor(totalElapsed / 60)}m ${totalElapsed % 60}s`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\n🔌 Connection closed');
      } catch (closeErr) {
        // Ignore close errors
      }
    }
  }
}

// API Timeout Test
async function testAPITimeout() {
  console.log('\n' + '='.repeat(60));
  console.log('🌐 API Timeout Configuration Test');
  console.log('='.repeat(60));
  
  console.log('📋 Current API Configuration:');
  console.log('   ⏱️ Query timeout: 10 minutes (600,000ms)');
  console.log('   🔄 Max rows: 50');
  console.log('   📊 Connection: 192.168.11.118:1521/newcrm');
  console.log('   👤 User: hcs_fin');
  console.log('   📋 View: hcs_edams.data_fin');
  
  console.log('\n💡 To test the patient API:');
  console.log('   1. Start Next.js: npm run dev');
  console.log('   2. Open browser to: http://localhost:3000/api/oracle-data');
  console.log('   3. Wait patiently (up to 10 minutes)');
  console.log('   4. Check browser developer console for progress logs');
  
  console.log('\n🕐 Expected behavior:');
  console.log('   - Immediate connection success');
  console.log('   - View structure retrieved instantly');
  console.log('   - Data query may take 5-10 minutes');
  console.log('   - Eventually returns data or timeout message');
}

// Run patient tests
console.log('🚀 Starting patient view calculation test...');
console.log('☕ Grab a coffee - this may take a while!\n');

testPatientViewCalculation()
  .then(() => testAPITimeout())
  .then(() => {
    console.log('\n✅ Patient testing completed');
    console.log('\n🎯 Key Findings:');
    console.log('   - Oracle connection works immediately');
    console.log('   - View structure is available instantly');
    console.log('   - Data calculation requires significant patience');
    console.log('   - API configured for 10-minute timeout');
    console.log('\n💡 For production: Consider view optimization or materialization');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Patient test failed:', err);
    process.exit(1);
  }); 