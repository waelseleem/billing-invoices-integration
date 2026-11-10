const oracledb = require('oracledb');

async function testOracleConnection() {
    let connection;
    try {
        console.log('\n🔍 STEP 1: Oracle Client Initialization');
        console.log('=====================================');
        try {
            await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
            console.log('✅ Oracle Client initialized in Thick mode');
        } catch (err) {
            if (err.message.includes('NJS-076') || err.message.includes('already initialized')) {
                console.log('✅ Oracle Client was already initialized');
            } else {
                console.log('⚠️ Falling back to Thin mode');
                oracledb.thin = true;
            }
        }

        // Configure Oracle settings
        console.log('\nConfiguring Oracle settings...');
        oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
        oracledb.fetchAsString = [oracledb.DATE];
        console.log('✅ Oracle settings configured');

        console.log('\n🔍 STEP 2: Database Connection');
        console.log('=====================================');
        console.log('Attempting connection to 192.168.11.118:1521/newcrm...');
        
        connection = await oracledb.getConnection({
            user: 'hcs_fin',
            password: 'hcs_fin',
            connectString: '192.168.11.118:1521/newcrm'
        });
        console.log('✅ Connected to Oracle Database');

        console.log('\n🔍 STEP 3: Session Parameters');
        console.log('=====================================');
        const sessionParams = await connection.execute(`
            SELECT * FROM NLS_SESSION_PARAMETERS 
            WHERE PARAMETER IN (
                'NLS_DATE_FORMAT',
                'NLS_TIMESTAMP_FORMAT',
                'NLS_DATE_LANGUAGE',
                'NLS_TERRITORY'
            )
        `);
        console.log('Current session parameters:');
        sessionParams.rows.forEach(param => {
            console.log(`${param.PARAMETER}: ${param.VALUE}`);
        });

        console.log('\n🔍 STEP 4: View Structure');
        console.log('=====================================');
        const viewStructure = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE, NULLABLE
            FROM ALL_TAB_COLUMNS
            WHERE TABLE_NAME = 'DATA_FIN'
            AND OWNER = 'HCS_EDAMS'
            ORDER BY COLUMN_ID
        `);
        console.log('View structure:');
        viewStructure.rows.forEach(col => {
            console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE}(${col.DATA_LENGTH}) ${col.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL'}`);
        });

        console.log('\n🔍 STEP 5: Row Count');
        console.log('=====================================');
        try {
            const countResult = await connection.execute(`
                SELECT COUNT(*) as total FROM hcs_edams.data_fin
            `);
            console.log(`Total rows in view: ${countResult.rows[0].TOTAL}`);
        } catch (err) {
            console.log('❌ Failed to get row count:', err.message);
        }

        console.log('\n🔍 STEP 6: Sample Data Test');
        console.log('=====================================');
        try {
            // First try with default format
            console.log('Attempting to fetch sample data...');
            const sampleData = await connection.execute(`
                SELECT 
                    CSTYPE,
                    BRANCHE,
                    COSTCENTER,
                    BILNG_DATE,
                    CONTRACT,
                    WATERDEBIT,
                    SEWERDEBIT
                FROM hcs_edams.data_fin
                WHERE ROWNUM <= 3
            `);

            if (sampleData.rows.length > 0) {
                console.log('✅ Sample data retrieved successfully:');
                sampleData.rows.forEach((row, index) => {
                    console.log(`\nRow ${index + 1}:`);
                    Object.entries(row).forEach(([key, value]) => {
                        console.log(`  ${key}: ${value}`);
                    });
                });
            } else {
                console.log('⚠️ No data found in the view');
            }
        } catch (err) {
            console.log('❌ Failed to fetch sample data:', err.message);
            
            console.log('\nTrying alternative date format...');
            try {
                await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'DD-MON-RR'`);
                await connection.execute(`ALTER SESSION SET NLS_DATE_LANGUAGE = 'AMERICAN'`);
                
                const altSampleData = await connection.execute(`
                    SELECT 
                        CSTYPE,
                        BRANCHE,
                        COSTCENTER,
                        TO_CHAR(BILNG_DATE, 'DD-MON-RR') as BILNG_DATE,
                        CONTRACT,
                        WATERDEBIT,
                        SEWERDEBIT
                    FROM hcs_edams.data_fin
                    WHERE ROWNUM <= 3
                `);
                
                if (altSampleData.rows.length > 0) {
                    console.log('✅ Sample data retrieved with alternative date format:');
                    altSampleData.rows.forEach((row, index) => {
                        console.log(`\nRow ${index + 1}:`);
                        Object.entries(row).forEach(([key, value]) => {
                            console.log(`  ${key}: ${value}`);
                        });
                    });
                }
            } catch (altErr) {
                console.log('❌ Alternative format also failed:', altErr.message);
            }
        }

        console.log('\n🔍 STEP 7: Performance Test');
        console.log('=====================================');
        console.log('Testing query performance...');
        const startTime = Date.now();
        
        try {
            const perfTest = await connection.execute(`
                SELECT * FROM (
                    SELECT 
                        CSTYPE,
                        BRANCHE,
                        COSTCENTER,
                        TO_CHAR(BILNG_DATE, 'DD-MON-RR') as BILNG_DATE,
                        CONTRACT,
                        WATERDEBIT,
                        SEWERDEBIT
                    FROM hcs_edams.data_fin
                    ORDER BY BILNG_DATE DESC NULLS LAST
                ) WHERE ROWNUM <= 100
            `, [], {
                prefetchRows: 100,
                fetchArraySize: 100
            });
            
            const endTime = Date.now();
            console.log(`✅ Performance test completed in ${endTime - startTime}ms`);
            console.log(`Retrieved ${perfTest.rows.length} rows`);
        } catch (err) {
            console.log('❌ Performance test failed:', err.message);
        }

    } catch (err) {
        console.error('\n❌ ERROR:', err.message);
        if (err.errorNum) {
            console.error('Oracle Error Number:', err.errorNum);
        }
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('\n✅ Connection closed successfully');
            } catch (err) {
                console.error('\n❌ Error closing connection:', err.message);
            }
        }
    }
}

// Run the tests
console.log('🚀 Starting Enhanced Oracle Diagnostics...');
console.log('='.repeat(50));

testOracleConnection()
    .then(() => {
        console.log('\n✅ Diagnostics completed');
    })
    .catch(err => {
        console.error('\n❌ Diagnostic process failed:', err);
    }); 