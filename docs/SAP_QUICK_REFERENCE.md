# SAP B1 Integration Quick Reference

## Environment Variables

```bash
# Production
SAP_SERVICE_LAYER_URL=https://192.168.11.22:50000/b1s/v1
SAP_COMPANY_DB=BS_NEW
SAP_USERNAME=BS2
SAP_PASSWORD=admin2007

# Demo
SAP_SERVICE_LAYER_URL=https://localhost:50000/b1s/v1
SAP_COMPANY_DB=SBODemoUS
SAP_USERNAME=manager
SAP_PASSWORD=manager
```

## API Endpoints

### Dashboard API
- `POST /api/sap/sync` - Trigger SAP synchronization
- `GET /api/sap/sync` - Get sync status

### SAP B1 Service Layer
- `POST /Login` - Authenticate
- `POST /JournalEntries` - Create journal entry
- `GET /CompanyInfo` - Test connection
- `POST /Logout` - Close session

## Account Codes

| Code | Arabic | English | Type |
|------|--------|---------|------|
| C1002 | عملاء سكنى | Residential Customers | Customer |
| 511111 | إجمالي مبيعات الإنتاج التام من السلع | Total Sales of Finished Goods | Revenue |
| 511121 | إجمالي المبيعات من الخدمات المؤداة | Total Sales of Services Rendered | Revenue |
| 324371 | جهاز التنظيم وحماية المستهلك | Consumer Protection Authority | Tax/Fee |
| 51211 | إيرادات مبيعات أخرى | Other Sales Revenue | Revenue |
| 324324 | الضريبة على الدمغة | Stamp Tax | Tax |
| 324322 | الضريبة على القيمة المضافة | Value Added Tax | Tax |

## Journal Entry Structure

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
    }
    // ... additional lines
  ]
}
```

## Testing Commands

### Login
```bash
curl -X POST "https://192.168.11.22:50000/b1s/v1/Login" \
  -H "Content-Type: application/json" \
  -d '{
    "CompanyDB": "BS_NEW",
    "UserName": "BS2",
    "Password": "admin2007"
  }'
```

### Create Journal Entry
```bash
curl -X POST "https://192.168.11.22:50000/b1s/v1/JournalEntries" \
  -H "Content-Type: application/json" \
  -H "Cookie: B1SESSION=<session-id>" \
  -d '{
    "ReferenceDate": "2025-07-24",
    "Memo": "Oracle Billing Integration - Contract 658330 - 2025-07-24",
    "Reference": "BILL-658330-20250724",
    "JournalEntryLines": [...]
  }'
```

### Test Connection
```bash
curl -X GET "https://192.168.11.22:50000/b1s/v1/CompanyInfo" \
  -H "Cookie: B1SESSION=<session-id>"
```

### Logout
```bash
curl -X POST "https://192.168.11.22:50000/b1s/v1/Logout" \
  -H "Cookie: B1SESSION=<session-id>"
```

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 401 | Unauthorized | Check credentials |
| 403 | Forbidden | Verify permissions |
| 404 | Not Found | Check URL |
| 500 | Server Error | Check SAP B1 status |

## Postman Collection

**File**: `docs/SAP_B1_POSTMAN_COLLECTION.json`
**Environment**: `docs/SAP_B1_ENVIRONMENT.json`

### Import Steps
1. Import collection into Postman
2. Import environment into Postman
3. Select appropriate environment
4. Run Login request
5. Test journal entries
6. Run Logout request

## Common Issues

### Authentication Failed
- Verify credentials in environment variables
- Check SAP B1 service layer is running
- Ensure user has journal entry permissions

### Connection Timeout
- Check network connectivity
- Verify firewall settings
- Test with Postman collection

### Journal Entry Errors
- Verify account codes exist in SAP B1
- Check date format (YYYY-MM-DD)
- Ensure amounts are valid numbers

### Session Issues
- Always logout after testing
- Check session timeout settings
- Re-authenticate if session expires

## Best Practices

1. **Security**
   - Use HTTPS for all connections
   - Store credentials securely
   - Logout after each session

2. **Testing**
   - Use Postman collection for testing
   - Test with small datasets first
   - Verify journal entries in SAP B1

3. **Monitoring**
   - Check sync status regularly
   - Monitor error logs
   - Track performance metrics

4. **Data Validation**
   - Validate data before sending
   - Check account codes exist
   - Verify amounts are correct

## Support Resources

- **Troubleshooting Guide**: `docs/SAP_TROUBLESHOOTING.md`
- **Integration Guide**: `docs/SAP_INTEGRATION_GUIDE.md`
- **Product Requirements**: `docs/PRODUCT_REQUIREMENTS.md`
- **SAP B1 Documentation**: Official SAP B1 Service Layer docs 