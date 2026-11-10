const oracledb = require('oracledb');

console.log('🔍 Discovering Oracle View Structure');
console.log('='.repeat(50));

async function discoverViewStructure() {
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

    // Method 1: Try to describe the view structure using metadata query
    console.log('\n📋 Method 1: Querying view metadata...');
    try {
      const metaResult = await connection.execute(`
        SELECT 
          column_name,
          data_type,
          data_length,
          nullable
        FROM user_tab_columns 
        WHERE table_name = UPPER('data_fin')
        ORDER BY column_id
      `);
      
      if (metaResult.rows && metaResult.rows.length > 0) {
        console.log('✅ View columns found:');
        metaResult.rows.forEach((col, index) => {
          console.log(`   ${index + 1}. ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.DATA_LENGTH ? `(${col.DATA_LENGTH})` : ''}) ${col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'}`);
        });
      } else {
        console.log('⚠️ No metadata found for data_fin in user schema');
      }
    } catch (metaErr) {
      console.log('⚠️ Metadata query failed:', metaErr.message);
    }

    // Method 2: Try different schema prefixes
    console.log('\n📋 Method 2: Trying different schema references...');
    const schemas = ['hcs_edams.data_fin', 'HCS_EDAMS.DATA_FIN', 'data_fin', 'DATA_FIN'];
    
    for (const schemaTable of schemas) {
      try {
        console.log(`🔍 Testing: ${schemaTable}`);
        
        // Use ROWNUM = 0 to get structure without data
        const structResult = await connection.execute(`SELECT * FROM ${schemaTable} WHERE ROWNUM = 0`);
        
        console.log(`✅ ${schemaTable} - FOUND! Column structure:`);
        if (structResult.metaData) {
          structResult.metaData.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.name} (Type: ${col.dbType || 'Unknown'})`);
          });
        }
        
        // Now get a few sample rows
        console.log(`\n📄 Getting sample data from ${schemaTable}...`);
        const sampleResult = await connection.execute(`SELECT * FROM ${schemaTable} WHERE ROWNUM <= 3`);
        
        console.log(`📊 Sample data (${sampleResult.rows?.length || 0} rows):`);
        if (sampleResult.rows && sampleResult.rows.length > 0) {
          console.log('🔍 First row structure:');
          const firstRow = sampleResult.rows[0];
          Object.keys(firstRow).forEach(key => {
            const value = firstRow[key];
            const type = typeof value;
            const displayValue = value === null ? 'NULL' : 
                               value instanceof Date ? value.toISOString() :
                               type === 'string' && value.length > 50 ? value.substring(0, 50) + '...' :
                               value;
            console.log(`   ${key}: ${displayValue} (${type})`);
          });
        }
        
        // Success! Exit loop
        break; 
        
      } catch (err) {
        console.log(`❌ ${schemaTable}: ${err.message}`);
      }
    }

    // Method 3: Try to find all available tables/views
    console.log('\n📋 Method 3: Finding all available tables/views...');
    try {
      const tablesResult = await connection.execute(`
        SELECT 
          table_name,
          table_type
        FROM user_catalog 
        WHERE table_name LIKE '%FIN%' 
           OR table_name LIKE '%DATA%'
           OR table_name LIKE '%EDAMS%'
        ORDER BY table_name
      `);
      
      if (tablesResult.rows && tablesResult.rows.length > 0) {
        console.log('📊 Available tables/views with FIN, DATA, or EDAMS:');
        tablesResult.rows.forEach(table => {
          console.log(`   ${table.TABLE_NAME} (${table.TABLE_TYPE})`);
        });
      } else {
        console.log('⚠️ No matching tables found');
      }
    } catch (tablesErr) {
      console.log('⚠️ Tables query failed:', tablesErr.message);
    }

  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
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

discoverViewStructure()
  .then(() => {
    console.log('\n✅ Structure discovery completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Discovery failed:', err);
    process.exit(1);
  }); 