const axios = require('axios');

// Test data matching the format from the user's request
const testData = {
  billingData: [
    {
      "CSTYPE": "C1002",
      "BRANCHE": "1",
      "COSTCENTER": "1",
      "CONTRACT": "658330",
      "ENTAGTAM": "5621612.45",
      "SEWER": "3184930.64",
      "TANZEEM": "23500.44",
      "ESTDAMA": "1351220.65",
      "TAXES": "233197.7788",
      "ROUNDING": "65675.203",
      "WATERCREDIT": "-338526.6",
      "SEWERCREDIT": "-207717.16",
      "WATERDEBIT": "58637",
      "SEWERDEBIT": "0",
      "CONSUMP": "2350078",
      "BILNG_DATE": null,
      "DATE_DUMP": null
    }
  ]
};

async function testSapSync() {
  try {
    console.log('Testing SAP sync with Journal Entry endpoint...');
    console.log('Request data:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post('http://localhost:3000/api/sap/sync', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error testing SAP sync:', error.response?.data || error.message);
  }
}

// Run the test
testSapSync(); 