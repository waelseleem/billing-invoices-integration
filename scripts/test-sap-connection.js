const axios = require('axios');
const https = require('https');

// SAP Configuration
const SAP_CONFIG = {
  serviceLayerUrl: 'https://192.168.11.22:50000/b1s/v1',
  companyDB: 'BS_NEW',
  username: 'BS2',
  password: 'admin2007'
};

// Create HTTPS agent with SSL verification disabled
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function testSAPConnection() {
  try {
    console.log('Testing SAP B1 Service Layer connection...');
    
    // Step 1: Login
    console.log('\n1. Attempting to login...');
    const loginResponse = await axios.post(`${SAP_CONFIG.serviceLayerUrl}/Login`, {
      CompanyDB: SAP_CONFIG.companyDB,
      UserName: SAP_CONFIG.username,
      Password: SAP_CONFIG.password,
    }, {
      httpsAgent
    });
    
    const session = loginResponse.data;
    console.log('✅ Login successful');
    console.log('Session ID:', session.SessionId);
    
    // Step 2: Test Business Partner query
    console.log('\n2. Testing Business Partner query...');
    const bpResponse = await axios.get(`${SAP_CONFIG.serviceLayerUrl}/BusinessPartners?$filter=CardCode eq 'C1002'`, {
      headers: {
        'Cookie': `B1SESSION=${session.SessionId}`
      },
      httpsAgent
    });
    
    console.log('✅ Business Partner query successful');
    console.log('Business Partner data:', JSON.stringify(bpResponse.data, null, 2));
    
    // Step 3: Test G/L Account query
    console.log('\n3. Testing G/L Account query...');
    const glResponse = await axios.get(`${SAP_CONFIG.serviceLayerUrl}/ChartOfAccounts?$filter=Code eq '511111'`, {
      headers: {
        'Cookie': `B1SESSION=${session.SessionId}`
      },
      httpsAgent
    });
    
    console.log('✅ G/L Account query successful');
    console.log('G/L Account data:', JSON.stringify(glResponse.data, null, 2));
    
    // Step 4: Test CostingCode2 (Branches)
    console.log('\n4. Testing CostingCode2 (Branches)...');
    const branchesResponse = await axios.get(`${SAP_CONFIG.serviceLayerUrl}/DistributionRules`, {
      headers: {
        'Cookie': `B1SESSION=${session.SessionId}`
      },
      httpsAgent
    });
    
    console.log('✅ Branches query successful');
    console.log('Branches data:', JSON.stringify(branchesResponse.data, null, 2));
    
    // Step 5: Test CostingCode3 (Activities)
    console.log('\n5. Testing CostingCode3 (Activities)...');
    const activitiesResponse = await axios.get(`${SAP_CONFIG.serviceLayerUrl}/DistributionRules`, {
      headers: {
        'Cookie': `B1SESSION=${session.SessionId}`
      },
      httpsAgent
    });
    
    console.log('✅ Activities query successful');
    console.log('Activities data:', JSON.stringify(activitiesResponse.data, null, 2));
    
    // Step 6: Test Journal Entry structure
    console.log('\n6. Testing Journal Entry structure...');
    const testJournalEntry = {
      ReferenceDate: new Date().toISOString().split('T')[0],
      Memo: 'Test Journal Entry',
      Reference: 'TEST-001',
      JournalEntryLines: [
        {
          ShortName: 'C1002',
          Debit: 100.00,
          Credit: 0,
          CostingCode2: '1',
          LineMemo: 'Test BP line'
        },
        {
          AccountCode: '511111',
          Debit: 0,
          Credit: 100.00,
          CostingCode2: '1',
          CostingCode3: '21',
          LineMemo: 'Test GL line'
        }
      ]
    };
    
    console.log('Test Journal Entry structure:', JSON.stringify(testJournalEntry, null, 2));
    
    // Step 7: Logout
    console.log('\n7. Logging out...');
    await axios.post(`${SAP_CONFIG.serviceLayerUrl}/Logout`, {}, {
      headers: {
        'Cookie': `B1SESSION=${session.SessionId}`
      },
      httpsAgent
    });
    
    console.log('✅ Logout successful');
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testSAPConnection(); 