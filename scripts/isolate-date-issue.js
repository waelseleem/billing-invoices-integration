const oracledb = require('oracledb');

console.log('🔧 Isolating Date Issue in Oracle View');
console.log('='.repeat(50));

async function findInvalidDates() {
    let connection;
    try {
        console.log('\n🔍 STEP 1: Oracle Client Setup');
        console.log('=====================================');
        try {
            await oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_26' });
            console.log('✅ Oracle Client initialized in Thick mode');
        } catch (err) {
            if (err.message.includes('NJS-076') || err.message.includes('already initialized')) {
                console.log('✅ Oracle Client was already initialized');
            } else {
                throw new Error('Thick mode is required for Oracle 11g');
            }
        }

        // Configure Oracle settings
        oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
        oracledb.fetchAsString = [oracledb.DATE];
        console.log('✅ Oracle settings configured');

        console.log('\n🔍 STEP 2: Database Connection');
        console.log('=====================================');
        connection = await oracledb.getConnection({
            user: 'hcs_fin',
            password: 'hcs_fin',
            connectString: '192.168.11.118:1521/newcrm'
        });
        console.log('✅ Connected successfully');

        // Set session parameters
        console.log('\n🔍 STEP 3: Setting Session Parameters');
        console.log('=====================================');
        await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'DD-MON-RR'`);
        await connection.execute(`ALTER SESSION SET NLS_DATE_LANGUAGE = 'AMERICAN'`);
        console.log('✅ Session parameters set');

        console.log('\n🔍 STEP 4: Analyzing Date Formats');
        console.log('=====================================');
        
        const diagnosticQueries = [
            {
                name: 'Raw Date Sample',
                query: `
                    SELECT *
                    FROM (
                        SELECT 
                            BILNG_DATE,
                            DUMP(BILNG_DATE) as INTERNAL_FORMAT
                        FROM hcs_edams.data_fin
                        WHERE BILNG_DATE IS NOT NULL
                    )
                    WHERE ROWNUM <= 5
                `
            },
            {
                name: 'Date Distribution',
                query: `
                    SELECT *
                    FROM (
                        SELECT 
                            SUBSTR(DUMP(BILNG_DATE), 1, 120) as DATE_DUMP,
                            COUNT(*) as COUNT
                        FROM hcs_edams.data_fin
                        WHERE BILNG_DATE IS NOT NULL
                        GROUP BY SUBSTR(DUMP(BILNG_DATE), 1, 120)
                        ORDER BY COUNT DESC
                    )
                    WHERE ROWNUM <= 5
                `
            },
            {
                name: 'NULL Date Analysis',
                query: `
                    SELECT 
                        COUNT(*) as TOTAL_ROWS,
                        COUNT(CASE WHEN BILNG_DATE IS NULL THEN 1 END) as NULL_DATES,
                        ROUND(COUNT(CASE WHEN BILNG_DATE IS NULL THEN 1 END) * 100 / COUNT(*), 2) as NULL_PERCENTAGE
                    FROM hcs_edams.data_fin
                `
            }
        ];

        for (const { name, query } of diagnosticQueries) {
            console.log(`\n📊 Running: ${name}`);
            try {
                const result = await connection.execute(query);
                if (result.rows.length > 0) {
                    console.log('Results:');
                    result.rows.forEach((row, index) => {
                        console.log(`\nRow ${index + 1}:`);
                        Object.entries(row).forEach(([key, value]) => {
                            console.log(`  ${key}: ${value}`);
                        });
                    });
                } else {
                    console.log('No results found');
                }
            } catch (err) {
                console.log(`❌ Query failed: ${err.message}`);
                
                if (name === 'Raw Date Sample') {
                    console.log('Attempting to get raw bytes...');
                    try {
                        const rawResult = await connection.execute(`
                            SELECT SUBSTR(DUMP(BILNG_DATE), 1, 120) as RAW_BYTES
                            FROM hcs_edams.data_fin
                            WHERE ROWNUM = 1
                        `);
                        console.log('Raw bytes:', rawResult.rows[0]?.RAW_BYTES);
                    } catch (rawErr) {
                        console.log('Raw bytes query failed:', rawErr.message);
                    }
                }
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('\n✅ Connection closed');
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

console.log('🔍 Starting Date Issue Investigation...');
console.log('='.repeat(50));

findInvalidDates()
    .then(() => {
        console.log('\n✅ Investigation completed');
    })
    .catch(err => {
        console.error('\n❌ Investigation failed:', err);
    }); 