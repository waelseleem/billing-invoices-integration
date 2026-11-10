# SAP B1 Integration Troubleshooting Guide

## Overview
This guide addresses common issues with SAP Business One Service Layer integration for billing data synchronization.

## Current Implementation: Individual Journal Entries

The system now creates **individual journal entries for each billing record** instead of one consolidated entry. This provides better traceability and easier reconciliation.

### Key Features:
- ✅ One journal entry per billing record
- ✅ Contract number in reference and memo
- ✅ Individual tracking and error handling
- ✅ Continues processing even if one record fails
- ✅ Clean journal entries without percentage corrections
- ✅ Retrieves both Transaction Number (JdtNum) and Journal Number from SAP

### Journal Entry Structure:
Each billing record creates a clean journal entry with only the essential lines:

```typescript
{
  ReferenceDate: "2025-07-17",
  Memo: "Oracle Billing Integration - Contract 658330 - 2025-07-17",
  Reference: "BILL-658330-20250717",
  JournalEntryLines: [
    {
      AccountCode: "C1002",
      Debit: 12345678.90,
      Credit: 0,
      CostingCode2: "1",
      LineMemo: "عملاء سكنى - عقد 658330"
    },
    {
      AccountCode: "511111",
      Debit: 0,
      Credit: 5621612.45,
      CostingCode3: "21",
      CostingCode2: "1",
      LineMemo: "إجمالي مبيعات الإنتاج التام من السلع"
    },
    {
      AccountCode: "511121",
      Debit: 0,
      Credit: 3184930.64,
      CostingCode3: "22",
      CostingCode2: "1",
      LineMemo: "إجمالي المبيعات من الخدمات المؤداة"
    },
    {
      AccountCode: "324371",
      Debit: 0,
      Credit: 1351220.65,
      CostingCode3: "22",
      CostingCode2: "1",
      LineMemo: "جهاز التنظيم وحماية المستهلك"
    },
    {
      AccountCode: "51211",
      Debit: 0,
      Credit: 658330,
      CostingCode3: "21",
      CostingCode2: "1",
      LineMemo: "إيرادات مبيعات أخرى"
    },
    {
      AccountCode: "324324",
      Debit: 0,
      Credit: 23500.44,
      CostingCode3: "23",
      CostingCode2: "1",
      LineMemo: "الضريبة على الدمغة"
    },
    {
      AccountCode: "324322",
      Debit: 0,
      Credit: 233197.78,
      CostingCode3: "22",
      CostingCode2: "1",
      LineMemo: "الضريبة على القيمة المضافة"
    },
    {
      AccountCode: "51211",
      Debit: 0,
      Credit: 65675.20,
      CostingCode3: "21",
      CostingCode2: "1",
      LineMemo: "إيرادات مبيعات أخرى"
    }
  ]
}
```

**Note**: Percentage corrections (6%, 6.5%, etc.) have been removed for cleaner, more accurate journal entries. The U_B1JE004 custom field has been temporarily removed until SAP B1 configuration is properly set up.

## Issues Fixed

### 1. Data Mapping Issues
**Problem**: Oracle data has uppercase field names (ENTAGTAM, SEWER, etc.) but TypeScript interface expects lowercase.

**Solution**: Added `convertOracleDataToInternalFormat()` method to properly map Oracle data format to internal format.

```typescript
// Before: Direct field access (caused undefined values)
const entagtam = record.entagtam; // undefined

// After: Proper mapping from Oracle format
const entagtam = parseNumeric(record.ENTAGTAM); // 5621612.45
```

### 2. U_B1JE004 Field Error
**Problem**: SAP B1 rejected journal entries due to invalid custom field `U_B1JE004`.

**Solution**: Temporarily removed the custom field until SAP B1 configuration is properly set up.

```typescript
// Before: Field caused 400 error
return {
  ReferenceDate: formattedDate,
  Memo: `Oracle Billing Integration - ${formattedDate}`,
  Reference: `BILL-${formattedDate.replace(/-/g, '')}`,
  JournalEntryLines: journalLines,
  U_B1JE004: parseFloat(totals.consump.toFixed(2)), // ❌ Caused 400 error
};

// After: Clean structure without custom field
return {
  ReferenceDate: formattedDate,
  Memo: `Oracle Billing Integration - Contract ${record.contract} - ${formattedDate}`,
  Reference: `BILL-Contract-${record.contract}-${formattedDate.replace(/-/g, '')}`,
  JournalEntryLines: journalLines, // ✅ No custom fields for now
};
```

### 3. Session Management Issues
**Problem**: Multiple login attempts and session timeouts causing infinite loops.

**Solution**: Improved session management with single retry logic and proper error handling.

```typescript
// Before: Recursive retry causing infinite loops
if (error.response?.status === 401) {
  await this.login(this.config);
  return this.request(endpoint, options); // ❌ Infinite recursion
}

// After: Single retry with proper error handling
if (error.response?.status === 401 && error.response?.data?.error?.code === 301) {
  this.session = null; // Clear expired session
  await this.login(this.config);
  // Single retry with new session
  const retryResponse = await axios({...});
  return retryResponse.data; // ✅ Single retry only
}
```

### 4. Individual Journal Entry Processing
**Problem**: All records were consolidated into one journal entry, making it difficult to track individual contracts.

**Solution**: Process each billing record individually with its own journal entry.

```typescript
// Before: One consolidated entry for all records
const journalEntry = this.createConsolidatedJournalEntry(allRecords);
await sapService.post('JournalEntries', journalEntry);

// After: Individual entries for each record
for (let i = 0; i < convertedData.length; i++) {
  const record = convertedData[i];
  const journalEntry = this.createIndividualJournalEntry(record, i + 1);
  await sapService.post('JournalEntries', journalEntry);
  // Continue with next record even if one fails
}
```

## Testing the Fixes

### 1. Run the Test Script
```bash
node test-sap-fixes.js
```

### 2. Check Logs
Monitor the application logs for:
- ✅ "Starting individual SAP B1 journal entry creation from provided data"
- ✅ "Processing record 1/7 - Contract: 658330"
- ✅ "Successfully created journal entry 1 in SAP"
- ✅ "Journal entry creation completed. Processed: 7/7"

### 3. Verify Data Processing
Look for these log entries:
```
Found 7 billing records to process
First record keys: CSTYPE, BRANCHE, COSTCENTER, CONTRACT, ENTAGTAM, SEWER, TANZEEM, ESTDAMA, TAXES, ROUNDING, WATERCREDIT, SEWERCREDIT, WATERDEBIT, SEWERDEBIT, CONSUMP, BILNG_DATE, DATE_DUMP
Processing record 1/7 - Contract: 658330
Record 1 totals: { contract: 658330, entagtam: 5621612.45, sewer: 3184930.64, ... }
```

## Journal Entry Structure

### Individual Journal Entry Format
Each billing record creates a separate journal entry with:

```typescript
{
  ReferenceDate: "2025-07-17",
  Memo: "Oracle Billing Integration - Contract 658330 - 2025-07-17",
  Reference: "BILL-658330-20250717",
  JournalEntryLines: [
    {
      AccountCode: "C1002",
      Debit: 12345678.90,
      Credit: 0,
      CostingCode2: "1",
      LineMemo: "عملاء سكنى - عقد 658330"
    },
    {
      AccountCode: "511111",
      Debit: 0,
      Credit: 5621612.45,
      CostingCode3: "21",
      CostingCode2: "1",
      LineMemo: "إجمالي مبيعات الإنتاج التام من السلع"
    }
    // ... more lines
  ]
}
```

### Key Benefits:
- **Traceability**: Each contract has its own journal entry
- **Error Isolation**: If one record fails, others continue processing
- **Easy Reconciliation**: Reference numbers include contract numbers
- **Detailed Logging**: Individual processing status for each record

## Common Error Codes and Solutions

### Error 400: Bad Request
- **Cause**: Invalid data structure or missing required fields
- **Solution**: Ensure all required fields are present and properly formatted

### Error 401: Unauthorized
- **Cause**: Session expired or invalid credentials
- **Solution**: Automatic retry with new login (implemented)

### Error 301: Invalid Session
- **Cause**: Session timeout
- **Solution**: Automatic session refresh (implemented)

## Configuration Checklist

### SAP B1 Service Layer
- [ ] Service Layer URL: `https://192.168.11.22:50000/b1s/v1`
- [ ] Company Database: `BS_NEW`
- [ ] Username: `BS2`
- [ ] Password: `admin2007`
- [ ] SSL Certificate: Disabled (for development)

### Environment Variables
```env
SAP_SERVICE_LAYER_URL=https://192.168.11.22:50000/b1s/v1
SAP_COMPANY_DB=BS_NEW
SAP_USERNAME=BS2
SAP_PASSWORD=admin2007
```

## Monitoring and Debugging

### 1. Enable Detailed Logging
The application logs detailed information about:
- Individual record processing
- SAP API requests and responses
- Error details with stack traces
- Processing statistics

### 2. Check Network Connectivity
```bash
# Test SAP B1 connectivity
curl -k https://192.168.11.22:50000/b1s/v1/Login
```

### 3. Verify SAP B1 Configuration
- Ensure Service Layer is running
- Check user permissions for journal entry creation
- Verify G/L account codes exist in SAP B1

## Performance Optimization

### 1. Individual Processing
- Each record processed independently
- Continues processing even if individual records fail
- Detailed error reporting per record

### 2. Session Caching
- Sessions are cached in localStorage
- Automatic session refresh on expiration
- Reduced login frequency

### 3. Request Timeouts
- 30-second timeout for SAP requests
- Prevents hanging connections

### 4. Error Recovery
- Single retry on session expiration
- Graceful error handling
- Detailed error logging

## Expected Results

### Successful Processing
```
✅ Successfully created 7 journal entries out of 7 records.
📋 Document Entries: [12345, 12346, 12347, 12348, 12349, 12350, 12351]
```

### Partial Success
```
⚠️ Successfully created 5 journal entries out of 7 records.
📋 Document Entries: [12345, 12346, 12347, 12348, 12349]
```

### Failed Processing
```
❌ Failed to create journal entries: SAP API Error: Invalid account code
```

## Next Steps

1. **Test the Integration**: Run the test script to verify fixes
2. **Monitor Logs**: Watch for successful individual journal entry creation
3. **Verify SAP B1**: Check that individual journal entries appear in SAP B1
4. **Production Deployment**: Deploy fixes to production environment

## Support

For additional support:
1. Check application logs for detailed error information
2. Verify SAP B1 Service Layer configuration
3. Test network connectivity to SAP B1 server
4. Review SAP B1 user permissions and G/L account setup 