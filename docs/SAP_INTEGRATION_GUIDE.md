# SAP B1 Integration Guide

## Overview

This guide provides comprehensive information about integrating Oracle billing data with SAP Business One through the Service Layer API. The integration creates journal entries in SAP B1 for each billing record from the Oracle database.

## Architecture

The integration follows a simple, reliable architecture:

```
Oracle Database → Dashboard API → SAP B1 Service Layer → Journal Entries
```

### Key Components

1. **Oracle Data Source**: Billing records from Oracle database
2. **Dashboard API**: `/api/sap/sync` endpoint that processes and transforms data
3. **SAP B1 Service Layer**: REST API for creating journal entries
4. **Journal Entries**: Financial records in SAP B1

## Environment Configuration

### Production Environment

```json
{
  "SAP_SERVICE_LAYER_URL": "https://192.168.11.22:50000/b1s/v1",
  "SAP_COMPANY_DB": "BS_NEW",
  "SAP_USERNAME": "BS2",
  "SAP_PASSWORD": "admin2007"
}
```

### Demo Environment

```json
{
  "SAP_SERVICE_LAYER_URL": "https://localhost:50000/b1s/v1",
  "SAP_COMPANY_DB": "SBODemoUS",
  "SAP_USERNAME": "manager",
  "SAP_PASSWORD": "manager"
}
```

## Authentication Flow

1. **Login Request**: POST to `/Login` with company database, username, and password
2. **Session Management**: SAP returns a `B1SESSION` cookie for subsequent requests
3. **API Calls**: Include the `B1SESSION` cookie in all API requests
4. **Logout**: POST to `/Logout` to properly close the session

### Example Login Request

```bash
curl -X POST "https://192.168.11.22:50000/b1s/v1/Login" \
  -H "Content-Type: application/json" \
  -d '{
    "CompanyDB": "BS_NEW",
    "UserName": "BS2",
    "Password": "admin2007"
  }'
```

## Journal Entry Structure

Each billing record creates a journal entry with the following structure:

### Header Information
- **ReferenceDate**: Date of the billing record
- **Memo**: Descriptive text including contract number
- **Reference**: Unique identifier (BILL-Contract-{ContractNumber}-{Date})

### Response Information
When a journal entry is successfully created, SAP returns:
- **JdtNum**: Transaction Number (internal document entry number used for system operations)
- **Number**: Journal Number (the user-facing journal entry number)

### Line Items
Each journal entry contains multiple line items representing different financial aspects:

1. **Customer Account (Debit)**: The customer being billed
2. **Sales Revenue (Credit)**: Revenue from goods and services
3. **Taxes (Credit)**: Various taxes and fees
4. **Other Revenue (Credit)**: Additional revenue items

### Sample Journal Entry

```json
{
  "ReferenceDate": "2025-07-24",
  "Memo": "Oracle Billing Integration - Contract 658330 - 2025-07-24",
  "Reference": "BILL-658330-20250724",
  "JournalEntryLines": [
    {
      "ShortName": "C1002",
      "Debit": 11138467.16,
      "Credit": 0,
      "LineMemo": "عملاء سكنى - عقد 658330"
    },
    {
      "AccountCode": "511111",
      "Debit": 0,
      "Credit": 5621612.45,
      "LineMemo": "إجمالي مبيعات الإنتاج التام من السلع"
    },
    {
      "AccountCode": "511121",
      "Debit": 0,
      "Credit": 3184930.64,
      "LineMemo": "إجمالي المبيعات من الخدمات المؤداة"
    },
    {
      "AccountCode": "324371",
      "Debit": 0,
      "Credit": 1351220.65,
      "LineMemo": "جهاز التنظيم وحماية المستهلك"
    },
    {
      "AccountCode": "51211",
      "Debit": 0,
      "Credit": 658330,
      "LineMemo": "إيرادات مبيعات أخرى"
    },
    {
      "AccountCode": "324324",
      "Debit": 0,
      "Credit": 23500.44,
      "LineMemo": "الضريبة على الدمغة"
    },
    {
      "AccountCode": "324322",
      "Debit": 0,
      "Credit": 233197.7788,
      "LineMemo": "الضريبة على القيمة المضافة"
    },
    {
      "AccountCode": "51211",
      "Debit": 0,
      "Credit": 65675.203,
      "LineMemo": "إيرادات مبيعات أخرى"
    }
  ]
}
```

## Account Code Mapping

The integration uses Egyptian financial account codes that comply with local accounting standards:

| Account Code | Arabic Description | English Description | Type |
|--------------|-------------------|-------------------|------|
| C1002 | عملاء سكنى | Residential Customers | Customer Account |
| 511111 | إجمالي مبيعات الإنتاج التام من السلع | Total Sales of Finished Goods | Revenue |
| 511121 | إجمالي المبيعات من الخدمات المؤداة | Total Sales of Services Rendered | Revenue |
| 324371 | جهاز التنظيم وحماية المستهلك | Consumer Protection Authority | Tax/Fee |
| 51211 | إيرادات مبيعات أخرى | Other Sales Revenue | Revenue |
| 324324 | الضريبة على الدمغة | Stamp Tax | Tax |
| 324322 | الضريبة على القيمة المضافة | Value Added Tax | Tax |

## Testing with Postman

### Setup Instructions

1. **Import Collection**: Import `docs/SAP_B1_POSTMAN_COLLECTION.json`
2. **Import Environment**: Import `docs/SAP_B1_ENVIRONMENT.json`
3. **Select Environment**: Choose Production or Demo environment
4. **Verify Variables**: Ensure all environment variables are set correctly

### Testing Sequence

1. **Login**: Execute the "Login" request
   - Verify 200 OK response
   - Check that B1SESSION cookie is set

2. **Test Connection**: Execute "Test Connection" request
   - Should return company information
   - Verifies session is active

3. **Create Journal Entries**: Execute individual journal entry requests
   - Each contract has its own request
   - Verify successful creation (201 Created)

4. **Logout**: Execute "Logout" request
   - Properly closes the session
   - Prevents session timeout issues

### Sample Test Data

The Postman collection includes test data for the following contracts:
- Contract 658330: EGP 11,138,467.16
- Contract 434265: EGP 10,864,995.69
- Contract 384160: EGP 5,720,734.97
- Contract 228365: EGP 3,214,584.90
- Contract 353235: EGP 5,152,551.24
- Contract 411400: EGP 4,635,885.35
- Contract 409440: EGP 5,024,553.23

## API Endpoints

### Dashboard API

- **POST** `/api/sap/sync`: Triggers the SAP synchronization process
- **GET** `/api/sap/sync`: Returns sync status and history

### SAP B1 Service Layer

- **POST** `/Login`: Authenticate with SAP B1
- **POST** `/JournalEntries`: Create new journal entries
- **GET** `/CompanyInfo`: Get company information
- **POST** `/Logout`: Close session

## Error Handling

### Common Error Codes

| HTTP Code | Description | Solution |
|-----------|-------------|----------|
| 401 | Unauthorized | Check credentials and session |
| 403 | Forbidden | Verify user permissions |
| 404 | Not Found | Check service layer URL |
| 500 | Internal Server Error | Check SAP B1 server status |

### Error Response Format

```json
{
  "error": {
    "code": -1,
    "message": {
      "lang": "en-us",
      "value": "Error description"
    }
  }
}
```

## Best Practices

### Security
- Use HTTPS for all connections
- Store credentials securely in environment variables
- Implement proper session management
- Log out after each session

### Performance
- Process records in batches
- Implement retry logic for failed requests
- Monitor API response times
- Use connection pooling when possible

### Data Integrity
- Validate data before sending to SAP
- Implement rollback mechanisms
- Log all transactions
- Verify journal entry creation

### Monitoring
- Monitor sync status regularly
- Set up alerts for failures
- Track performance metrics
- Maintain audit logs

## Troubleshooting

### Connection Issues
1. Verify network connectivity
2. Check firewall settings
3. Ensure service layer is running
4. Validate SSL certificates

### Authentication Issues
1. Verify credentials
2. Check user permissions
3. Ensure company database exists
4. Validate session cookies

### Data Issues
1. Check data format
2. Verify account codes exist
3. Ensure amounts are valid
4. Validate date formats

### Performance Issues
1. Monitor response times
2. Check server resources
3. Optimize batch sizes
4. Implement caching

## Support

For additional support and troubleshooting, refer to:
- `docs/SAP_TROUBLESHOOTING.md`: Detailed troubleshooting guide
- SAP B1 Service Layer documentation
- SAP B1 community forums
- Technical support team

## Version History

- **v1.0**: Initial implementation with basic journal entry creation
- **v1.1**: Added individual journal entries per contract
- **v1.2**: Improved error handling and logging
- **v1.3**: Added Postman collection for testing
- **v1.4**: Enhanced documentation and troubleshooting guides 