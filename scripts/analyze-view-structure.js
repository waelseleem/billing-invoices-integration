const oracledb = require('oracledb');

async function analyzeViewStructure() {
  let connection;
  
  try {
    await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    connection = await oracledb.getConnection({
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: '192.168.11.118:1521/newcrm'
    });
    
    console.log('Connected to Oracle Database');

    // Step 1: Get view definition
    console.log('\n=== View Definition ===');
    try {
      const viewDef = await connection.execute(`
        SELECT TEXT 
        FROM ALL_VIEWS 
        WHERE OWNER = 'HCS_EDAMS' 
        AND VIEW_NAME = 'DATA_FIN'
      `);
      
      if (viewDef.rows?.length > 0) {
        console.log('\nView SQL:');
        console.log(viewDef.rows[0].TEXT);
      } else {
        console.log('View definition not found or no access');
      }
    } catch (e) {
      console.log('Error getting view definition:', e.message);
    }

    // Step 2: Get column structure
    console.log('\n=== Column Structure ===');
    try {
      const columns = await connection.execute(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          DATA_LENGTH,
          NULLABLE,
          COLUMN_ID
        FROM ALL_TAB_COLUMNS
        WHERE OWNER = 'HCS_EDAMS'
        AND TABLE_NAME = 'DATA_FIN'
        ORDER BY COLUMN_ID
      `);
      
      if (columns.rows?.length > 0) {
        columns.rows.forEach(col => {
          console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.DATA_LENGTH}) ${col.NULLABLE}`);
        });
      } else {
        console.log('No columns found or no access');
      }
    } catch (e) {
      console.log('Error getting column structure:', e.message);
    }

    // Step 3: Get execution plan
    console.log('\n=== Execution Plan ===');
    try {
      // First explain the plan
      await connection.execute(`
        EXPLAIN PLAN FOR 
        SELECT * FROM hcs_edams.data_fin
      `);
      
      // Then display it
      const plan = await connection.execute(`
        SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY)
      `);
      
      if (plan.rows?.length > 0) {
        plan.rows.forEach(row => {
          console.log(row.PLAN_TABLE_OUTPUT);
        });
      }
    } catch (e) {
      console.log('Error getting execution plan:', e.message);
    }

    // Step 4: Get sample data structure
    console.log('\n=== Sample Data Structure ===');
    try {
      const sample = await connection.execute(`
        SELECT * FROM hcs_edams.data_fin 
        WHERE ROWNUM <= 1
      `);
      
      if (sample.metaData) {
        console.log('\nActual Columns from Query:');
        sample.metaData.forEach(col => {
          console.log(`${col.name}: ${col.dbType}`);
        });
      }
    } catch (e) {
      console.log('Error getting sample data:', e.message);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('\nConnection closed');
      } catch (err) {
        console.error('Error closing connection:', err.message);
      }
    }
  }
}

analyzeViewStructure()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  }); 