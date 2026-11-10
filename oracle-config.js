// Oracle Production Configuration
// Update these values with information from your DBA

const oracleConfig = {
  // Oracle Server Details
  host: '192.168.11.118',
  port: 1521,
  
  // Database Credentials - UPDATE THESE
  user: 'hcs_fin',
  password: 'hcs_fin',
  
  // Database Service/SID - ACTUAL VALUES FROM DBA
  serviceName: 'newcrm',  // Provided by DBA
  sid: 'newcrm',          // Using service name as SID fallback
  
  // Connection Options  
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
  poolTimeout: 60,
  connectTimeout: 30000,
  queryTimeout: 600000, // 10 minutes for view calculations
  
  // Query Options
  maxRows: 1000,
  outFormat: 'OBJECT'
};

// Generate connection strings based on configuration
const connectionStrings = {
  // Method 1: Service Name format
  serviceName: `${oracleConfig.host}:${oracleConfig.port}/${oracleConfig.serviceName}`,
  
  // Method 2: SID format  
  sid: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${oracleConfig.host})(PORT=${oracleConfig.port}))(CONNECT_DATA=(SID=${oracleConfig.sid})))`,
  
  // Method 3: TNS with Service Name
  tnsServiceName: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${oracleConfig.host})(PORT=${oracleConfig.port}))(CONNECT_DATA=(SERVICE_NAME=${oracleConfig.serviceName})))`,
  
  // Method 4: Alternative port (if needed)
  alternativePort: `${oracleConfig.host}:${oracleConfig.port + 1}/ORCL`
};

module.exports = {
  oracleConfig,
  connectionStrings
};

/* 
=== INSTRUCTIONS FOR DBA ===

Please provide the following information:

1. SERVICE NAME or SID: 
   - What is the correct service name for the Oracle database?
   - Example: ORCL, PROD, HCS_DB, etc.

2. PORT (if not 1521):
   - Is Oracle running on port 1521 or a different port?

3. CREDENTIALS:
   - Username: hcs_fin (is this correct?)
   - Password: hcs_fin (is this correct?)
   - Does this user have SELECT privileges on HCS_EDAMS.DATA_FIN?

4. TABLE/VIEW ACCESS:
   - Does the table HCS_EDAMS.DATA_FIN exist?
   - Does the user hcs_fin have access to this table?

5. NETWORK:
   - Is the server 192.168.11.118 accessible from this application server?
   - Are there any firewall rules blocking port 1521?

=== HOW TO TEST CONNECTION ===

After updating the configuration:
1. Update YOUR_SERVICE_NAME and YOUR_SID with correct values
2. Run: node test-oracle-production.js
3. Test the API: GET /api/oracle-data

*/ 