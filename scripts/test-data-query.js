const oracledb = require('oracledb');

console.log('🧪 Testing Data Query with Date Handling');
console.log('='.repeat(50));

async function testDataQuery() {
  let connection;
  
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

    // Test the corrected query with proper date handling
    console.log('\n🔍 Testing corrected query with date handling...');
    
    const query = `
      SELECT 
        LINE_ID,
        CSTYPE,
        BRANCHE,
        COSTCENTER,
        TO_CHAR(BILNG_DATE, 'YYYY-MM-DD') as BILNG_DATE,
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
      FROM hcs_edams.data_fin
      WHERE ROWNUM <= 5
    `;

    const result = await connection.execute(query);
    
    console.log('✅ Query executed successfully!');
    console.log('📊 Results:');
    console.log(`   Rows returned: ${result.rows?.length || 0}`);
    console.log(`   Columns: ${result.metaData?.length || 0}`);
    
    if (result.metaData) {
      console.log('\n📋 Column Information:');
      result.metaData.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.name} (${col.dbType || 'Unknown'})`);
      });
    }
    
    if (result.rows && result.rows.length > 0) {
      console.log('\n📄 Sample Data (First Row):');
      const firstRow = result.rows[0];
      Object.keys(firstRow).forEach(key => {
        console.log(`   ${key}: ${firstRow[key]}`);
      });
      
      console.log('\n📊 All Rows:');
      result.rows.forEach((row, index) => {
        console.log(`   Row ${index + 1}: LINE_ID=${row.LINE_ID}, CSTYPE=${row.CSTYPE}, BILNG_DATE=${row.BILNG_DATE}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    
    // Try alternative approaches if the main query fails
    if (error.message.includes('ORA-01843') || error.message.includes('date')) {
      console.log('\n🔧 Trying alternative date handling...');
      
      try {
        // Try without date conversion
        const simpleResult = await connection.execute(`
          SELECT LINE_ID, CSTYPE, BRANCHE, COSTCENTER, ENTAGTAM 
          FROM hcs_edams.data_fin 
          WHERE ROWNUM <= 3
        `);
        
        console.log('✅ Simplified query works!');
        console.log('📊 Rows:', simpleResult.rows?.length);
        
        // Now try to understand the date column issue
        const dateResult = await connection.execute(`
          SELECT 
            LINE_ID,
            BILNG_DATE,
            TYPEOF(BILNG_DATE) as date_type
          FROM hcs_edams.data_fin 
          WHERE ROWNUM <= 1
        `);
        
        console.log('📅 Date column info:', dateResult.rows);
        
      } catch (altError) {
        console.error('❌ Alternative query also failed:', altError.message);
      }
    }
    
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

testDataQuery()
  .then(() => {
    console.log('\n✅ Data query test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }); 