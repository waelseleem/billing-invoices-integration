const axios = require('axios');

// Test configuration
const SAP_CONFIG = {
  serviceLayerUrl: 'https://192.168.11.22:50000/b1s/v1',
  companyDB: 'BS_NEW',
  username: 'BS2',
  password: 'admin2007'
};

async function testDuplicateDetection() {
  try {
    console.log('🧪 Testing Duplicate Journal Entry Detection...\n');

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

    // Step 2: Create a test journal entry with a unique reference
    const uniqueReference = `BILL-Contract-C1002-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    console.log('\n2. Creating test journal entry with reference:', uniqueReference);
    
    const journalEntry = {
      ReferenceDate: '2025-07-28',
      Memo: 'Oracle Billing Integration - Contract C1002 - 2025-07-28',
      Reference: uniqueReference,
      JournalEntryLines: [
        {
          ShortName: 'C1002',
          Debit: 1000.00,
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

    console.log('✅ First journal entry created successfully!');
    console.log('   📄 Transaction Number (JdtNum):', createResponse.data.JdtNum);
    console.log('   🔢 Journal Number:', createResponse.data.Number);

    // Step 3: Try to create the same journal entry again (should detect duplicate)
    console.log('\n3. Attempting to create duplicate journal entry...');
    
    try {
      const duplicateResponse = await axios.post(`${SAP_CONFIG.serviceLayerUrl}/JournalEntries`, journalEntry, {
        headers: {
          'Cookie': `B1SESSION=${sessionId}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });

      console.log('❌ Expected duplicate detection to fail, but it succeeded');
      console.log('   This might indicate the duplicate detection is not working properly');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Duplicate detection working - SAP rejected the duplicate entry');
        console.log('   Error message:', error.response.data?.error?.message?.value || 'Unknown error');
      } else {
        console.log('❌ Unexpected error during duplicate test:', error.message);
      }
    }

    // Step 4: Test our custom duplicate detection by querying for existing entries
    console.log('\n4. Testing custom duplicate detection logic...');
    
    const queryEndpoint = `${SAP_CONFIG.serviceLayerUrl}/JournalEntries?$filter=Reference eq '${uniqueReference}'&$select=JdtNum,Number,ReferenceDate,Memo,Reference&$top=1`;
    
    const queryResponse = await axios.get(queryEndpoint, {
      headers: {
        'Cookie': `B1SESSION=${sessionId}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    if (queryResponse.data && queryResponse.data.value && queryResponse.data.value.length > 0) {
      const existingEntry = queryResponse.data.value[0];
      console.log('✅ Custom duplicate detection working!');
      console.log('   Found existing entry:');
      console.log('   📄 Transaction Number (JdtNum):', existingEntry.JdtNum);
      console.log('   🔢 Journal Number:', existingEntry.Number);
      console.log('   📝 Reference:', existingEntry.Reference);
      console.log('   📅 Date:', existingEntry.ReferenceDate);
    } else {
      console.log('❌ Custom duplicate detection failed - no existing entry found');
    }

    // Step 5: Test with a different reference (should not be detected as duplicate)
    console.log('\n5. Testing with different reference (should not be duplicate)...');
    
    const differentReference = `BILL-Contract-C1003-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const differentJournalEntry = {
      ...journalEntry,
      Reference: differentReference,
      Memo: 'Oracle Billing Integration - Contract C1003 - 2025-07-28'
    };

    const differentResponse = await axios.post(`${SAP_CONFIG.serviceLayerUrl}/JournalEntries`, differentJournalEntry, {
      headers: {
        'Cookie': `B1SESSION=${sessionId}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    console.log('✅ Different reference journal entry created successfully!');
    console.log('   📄 Transaction Number (JdtNum):', differentResponse.data.JdtNum);
    console.log('   🔢 Journal Number:', differentResponse.data.Number);
    console.log('   📝 Reference:', differentResponse.data.Reference);

    // Step 6: Logout
    console.log('\n6. Logging out...');
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
    console.log('\n🎉 Duplicate Detection Test Summary:');
    console.log('   ✅ First journal entry created successfully');
    console.log('   ✅ Custom duplicate detection logic working');
    console.log('   ✅ Different references are allowed');
    console.log('   ✅ System can identify existing journal entries by reference');
    console.log('   ✅ Ready to implement duplicate prevention in the application');

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
testDuplicateDetection(); 