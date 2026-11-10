const axios = require('axios');

// Test data that matches the Oracle format (uppercase fields)
const testBillingData = [
  {
    CSTYPE: 'C1002',
    BRANCHE: '1',
    COSTCENTER: '1',
    CONTRACT: '658330',
    ENTAGTAM: '5621612.45',
    ESTDAMA: '1351220.65',
    ROUNDING: '65675.203',
    SEWER: '3184930.64',
    TANZEEM: '23500.44',
    TAXES: '233197.7788',
    WATERCREDIT: '-338526.6',
    SEWERCREDIT: '-207717.16',
    WATERDEBIT: '58637',
    SEWERDEBIT: '0',
    CONSUMP: '2350078',
    BILNG_DATE: '2025-07-17',
    DATE_DUMP: null
  },
  {
    CSTYPE: 'C1002',
    BRANCHE: '1',
    COSTCENTER: '1',
    CONTRACT: '658331',
    ENTAGTAM: '1000000.00',
    ESTDAMA: '500000.00',
    ROUNDING: '10000.00',
    SEWER: '750000.00',
    TANZEEM: '15000.00',
    TAXES: '100000.00',
    WATERCREDIT: '-50000.00',
    SEWERCREDIT: '-25000.00',
    WATERDEBIT: '25000',
    SEWERDEBIT: '0',
    CONSUMP: '500000',
    BILNG_DATE: '2025-07-17',
    DATE_DUMP: null
  }
];

async function testSAPIntegration() {
  try {
    console.log('Testing SAP Integration with Individual Journal Entries...');
    console.log(`Will create ${testBillingData.length} separate journal entries`);
    
    // Test the API endpoint
    const response = await axios.post('http://localhost:3000/api/sap/sync', {
      billingData: testBillingData
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for multiple entries
    });

    console.log('✅ SAP Integration Test Successful!');
    console.log('Response:', response.data);
    
    if (response.data.processedCount) {
      console.log(`📊 Created ${response.data.processedCount} journal entries`);
      if (response.data.docEntries) {
        console.log('📋 Document Entries:', response.data.docEntries);
      }
    }
    
  } catch (error) {
    console.error('❌ SAP Integration Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testSAPIntegration(); 