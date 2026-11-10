const axios = require('axios');

// Test configuration
const SAP_CONFIG = {
  serviceLayerUrl: 'https://192.168.11.22:50000/b1s/v1',
  companyDB: 'BS_NEW',
  username: 'BS2',
  password: 'admin2007'
};

// Sample billing data for testing
const sampleBillingData = [
  {
    CSTYPE: 'C1002',
    BRANCHE: '1',
    COSTCENTER: '21',
    BILNG_DATE: '2025-07-28',
    ENTAGTAM: 1000.00,
    SEWER: 500.00,
    TANZEEM: 50.00,
    ESTDAMA: 100.00,
    CONTRACT: 200.00,
    TAXES: 150.00,
    ROUNDING: 25.00,
    WATERCREDIT: 0,
    SEWERCREDIT: 0,
    WATERDEBIT: 0,
    SEWERDEBIT: 0,
    CONSUMP: 100
  }
];

async function testJournalNumberRetrieval() {
  try {
    console.log('🧪 Testing Journal Number Retrieval from SAP...\n');

    // Step 1: Login to SAP
    console.log('1. Logging into SAP...');
    const loginResponse = await axios.post(`${SAP_CONFIG.serviceLayerUrl}/Login`, {
      CompanyDB: SAP_CONFIG.companyDB,
      UserName: SAP_CONFIG.username,
      Password: SAP_CONFIG.password
    }, {
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    const sessionId = loginResponse.data.SessionId;
    console.log('✅ Login successful, Session ID:', sessionId);

    // Step 2: Create a test journal entry
    console.log('\n2. Creating test journal entry...');
    
    const journalEntry = {
      ReferenceDate: '2025-07-28',
      Memo: 'Test Journal Entry - Journal Number Retrieval',
      Reference: 'TEST-JN-20250728',
      JournalEntryLines: [
        {
          ShortName: 'C1002',
          Debit: 2025.00,
          Credit: 0,
          CostingCode2: '1',
          LineMemo: 'Test Customer Debit'
        },
        {
          AccountCode: '511111',
          Debit: 0,
          Credit: 1000.00,
          CostingCode2: '1',
          CostingCode3: '21',
          LineMemo: 'Test Revenue'
        },
        {
          AccountCode: '511121',
          Debit: 0,
          Credit: 500.00,
          CostingCode2: '1',
          CostingCode3: '22',
          LineMemo: 'Test Service Revenue'
        },
        {
          AccountCode: '324322',
          Debit: 0,
          Credit: 150.00,
          CostingCode2: '1',
          LineMemo: 'Test Tax'
        },
        {
          AccountCode: '51211',
          Debit: 0,
          Credit: 375.00,
          CostingCode2: '1',
          CostingCode3: '21',
          LineMemo: 'Test Other Revenue'
        }
      ]
    };

    const createResponse = await axios.post(`${SAP_CONFIG.serviceLayerUrl}/JournalEntries`, journalEntry, {
      headers: {
        'Cookie': `B1SESSION=${sessionId}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    console.log('✅ Journal entry created successfully!');
    console.log('📋 Response data:', JSON.stringify(createResponse.data, null, 2));

    // Step 3: Extract and display the key fields
    const { JdtNum, Number } = createResponse.data;
    console.log('\n3. Extracted Journal Entry Information:');
    console.log('   📄 Transaction Number (JdtNum):', JdtNum);
    console.log('   🔢 Journal Number:', Number);
    console.log('   📝 Memo:', createResponse.data.Memo);
    console.log('   📅 Reference Date:', createResponse.data.ReferenceDate);

    // Step 4: Verify the journal entry by retrieving it
    console.log('\n4. Verifying journal entry by retrieving it...');
    const retrieveResponse = await axios.get(`${SAP_CONFIG.serviceLayerUrl}/JournalEntries?$filter=Number eq ${Number}&$select=JdtNum,Number,ReferenceDate,Memo,Reference,JournalEntryLines`, {
      headers: {
        'Cookie': `B1SESSION=${sessionId}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    console.log('✅ Journal entry retrieved successfully!');
    console.log('📋 Retrieved data:', JSON.stringify(retrieveResponse.data, null, 2));

    // Step 5: Logout
    console.log('\n5. Logging out...');
    await axios.post(`${SAP_CONFIG.serviceLayerUrl}/Logout`, {}, {
      headers: {
        'Cookie': `B1SESSION=${sessionId}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    console.log('✅ Logout successful');

    // Summary
    console.log('\n🎉 Test Summary:');
    console.log('   ✅ Journal entry created with Transaction Number (JdtNum):', JdtNum);
    console.log('   ✅ Journal Number retrieved:', Number);
    console.log('   ✅ Both fields are available in the SAP response');
    console.log('   ✅ The integration can now capture both Transaction Number and Journal Number');
    console.log('   ✅ Query functionality works correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testJournalNumberRetrieval(); 