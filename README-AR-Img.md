# Oracle to SAP B1 Billing Integration Dashboard

This project provides a web-based dashboard for monitoring and managing the billing integration between an Oracle database and SAP Business One.

## Project Status

The dashboard is currently in a stable state with the following key features implemented:

- **Centralized Data Management**: A shared React Context (`OracleDataProvider`) has been implemented to fetch and manage data from the Oracle database. This ensures data is loaded only once and is available to all components, improving performance and reducing redundant API calls.
- **Reusable Components**: The `DashboardStats` component has been refactored to be a purely presentational component, receiving all its data via props. This makes it highly reusable and decoupled from data-fetching logic.
- **Comprehensive Data Views**:
  - An **Overview Tab** that displays key performance indicators and system health statistics.
  - An **Oracle Data Tab** that provides a detailed, paginated, and filterable view of the raw financial data.
- **Dynamic Currency Formatting**: The application is configured to display all financial values in EGP.
- **Robust Error Handling**: The frontend is designed to handle API connection errors gracefully and provides users with a manual retry option.

## Recent Updates

- **Bug Fix (Zeros in Overview)**: Fixed a critical bug where the `DashboardStats` component would display zero values on the Overview tab. This was resolved by ensuring the component receives the correct data from the shared context.
- **Architectural Refactor**: Moved all data-fetching logic from individual components into the centralized `OracleDataProvider`, simplifying component logic and improving maintainability.
- **Data Persistence Across Tabs**: Implemented a shared state model that prevents data from being re-fetched every time the user navigates between the "Overview" and "Oracle Data" tabs.

## Getting Started

To run this project locally, you will need to have Node.js and npm/pnpm/yarn installed.

1.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

2.  **Run the Development Server**:
    ```bash
    pnpm run dev
    ```

This will start the application on `http://localhost:3000`.

## Dashboard Interface

The Billing Invoices to SAP B1 Integration Dashboard provides a comprehensive interface for monitoring and managing the integration process. Here are the key screens:

### 1. System Overview
![System Overview](Setup/Images/Arabic/1.Billing%20Invoices%20to%20SAP%20B1%20Integration%20Dashboard%20-System%20Overview.png)

The System Overview tab displays key performance indicators, system health statistics, and real-time metrics about the billing integration process.

### 2. Oracle Financial Data
![Oracle Financial Data](Setup/Images/Arabic/2.Billing%20Invoices%20to%20SAP%20B1%20Integration%20Dashboard%20-%20Oracle%20Financial%20Data.png)

The Oracle Data tab provides a detailed, paginated, and filterable view of the raw financial data extracted from the Oracle database, allowing users to inspect and validate the data before integration.

### 3. Journal Entry Viewer
![Journal Entry Viewer](Setup/Images/Arabic/3.Billing%20Invoices%20to%20SAP%20B1%20Integration%20Dashboard%20-%20Journal%20Entry%20Viewer.png)

The Journal Entry Viewer tab shows the generated journal entries that will be posted to SAP Business One, providing a preview of the integration output.

### 4. Sync Schedule
![Sync Schedule](Setup/Images/Arabic/4.Billing%20Invoices%20to%20SAP%20B1%20Integration%20Dashboard%20-%20Sync%20Schedule.png)

The Sync Schedule tab allows users to configure and manage automated synchronization schedules between Oracle and SAP B1 systems.

### 5. System Logs
![System Logs](Setup/Images/Arabic/5.Billing%20Invoices%20to%20SAP%20B1%20Integration%20Dashboard%20-%20System%20Logs.png)

The System Logs tab provides comprehensive logging and monitoring capabilities, displaying detailed information about integration processes, errors, and system events.

## SAP B1 Integration

This project includes a feature to integrate billing data from the Oracle database into SAP Business One as Journal Entries.

### SAP Sync

The SAP synchronization process can be triggered by sending a POST request to the `/api/sap/sync` endpoint. This will:
1.  Extract the latest billing data from the Oracle database.
2.  Group the data by branch.
3.  Create a separate Journal Entry for each branch.
4.  Post the Journal Entries to the SAP Business One Service Layer.

**To trigger the sync:**
```bash
curl -X POST http://localhost:3000/api/sap/sync
```

### Configuration

To connect to SAP Business One, you need to provide the following environment variables in a `.env.local` file:

```
SAP_SERVICE_LAYER_URL=https://<your-sap-server>:50000/b1s/v1
SAP_COMPANY_DB=<your-company-db>
SAP_USERNAME=<your-sap-username>
SAP_PASSWORD=<your-sap-password>
```

### SAP B1 Environment Configuration

The project includes a complete SAP B1 environment configuration for testing and development:

**Production Environment:**
- **Service Layer URL**: `https://192.168.11.22:50000/b1s/v1`
- **Company Database**: `BS_NEW`
- **Username**: `BS2`
- **Password**: `admin2007`

**Demo Environment:**
- **Service Layer URL**: `https://localhost:50000/b1s/v1`
- **Company Database**: `SBODemoUS`
- **Username**: `manager`
- **Password**: `manager`

### Postman Collection

A comprehensive Postman collection is included in `docs/SAP_B1_POSTMAN_COLLECTION.json` for testing the SAP B1 integration. The collection includes:

1. **Login Request**: Authenticates with SAP B1 Service Layer
2. **Journal Entry Creation**: Multiple examples for different contracts
3. **Connection Test**: Verifies the connection to SAP B1
4. **Logout Request**: Properly closes the session

**Key Features of the Postman Collection:**
- Automatic session management with B1SESSION cookie
- Pre-configured environment variables
- Sample journal entries for contracts: 658330, 434265, 384160, 228365, 353235, 411400, 409440
- Arabic memo descriptions for proper localization
- Complete account code mapping for Egyptian financial standards

### Journal Entry Structure

Each billing record creates a clean journal entry with the following structure:

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

### Account Code Mapping

The integration uses the following Egyptian financial account codes:

| Account Code | Description (Arabic) | Description (English) |
|--------------|---------------------|----------------------|
| C1002 | عملاء سكنى | Residential Customers |
| 511111 | إجمالي مبيعات الإنتاج التام من السلع | Total Sales of Finished Goods |
| 511121 | إجمالي المبيعات من الخدمات المؤداة | Total Sales of Services Rendered |
| 324371 | جهاز التنظيم وحماية المستهلك | Consumer Protection Authority |
| 51211 | إيرادات مبيعات أخرى | Other Sales Revenue |
| 324324 | الضريبة على الدمغة | Stamp Tax |
| 324322 | الضريبة على القيمة المضافة | Value Added Tax |

### Testing with Postman

1. **Import the Collection**: Import `docs/SAP_B1_POSTMAN_COLLECTION.json` into Postman
2. **Import the Environment**: Import `docs/SAP_B1_ENVIRONMENT.json` into Postman
3. **Select Environment**: Choose the appropriate environment (Production or Demo)
4. **Run Login**: Execute the "Login" request to authenticate
5. **Test Journal Entries**: Run individual journal entry creation requests
6. **Verify Connection**: Use the "Test Connection" request to verify connectivity
7. **Logout**: Always run the "Logout" request when finished

### Troubleshooting

For detailed troubleshooting information, see `docs/SAP_TROUBLESHOOTING.md`. Common issues include:

- **Authentication Failures**: Verify credentials and service layer URL
- **Connection Timeouts**: Check network connectivity and firewall settings
- **Data Mapping Issues**: Ensure Oracle data format matches expected structure
- **Journal Entry Errors**: Verify account codes and company database configuration

## Dark Mode

The application supports a dark mode with SAP's professional color scheme.

### Color Scheme

#### Light Mode
- Primary Blue: #354A5F
- Success Green: #107E3E
- Error Red: #BB0000
- Background: #F7F7F7
- Surface: White
- Border: #E5E5E5
- Text Primary: #1D2D3E
- Text Secondary: #687B8C

#### Dark Mode
- Primary Blue: #4A6583
- Success Green: #71B958
- Error Red: #FF8D8D
- Background: #1C2834
- Surface: #243447
- Border: #2D3B4B
- Text Primary: #E2E8ED
- Text Secondary: #A3B8CC

## Theme Configuration

The application supports three theme modes:
- Light: Professional light theme optimized for day use
- Dark: Eye-friendly dark theme for low-light environments
- System: Automatically matches your system preferences

To change the theme:
1. Click the theme toggle button in the top-right corner
2. Select your preferred theme from the dropdown menu

## Documentation

- **Product Requirements**: `docs/PRODUCT_REQUIREMENTS.md`
- **SAP Troubleshooting**: `docs/SAP_TROUBLESHOOTING.md`
- **Oracle Setup**: `docs/SETUP_ORACLE_INSTANT_CLIENT.md`
- **SAP Postman Collection**: `docs/SAP_B1_POSTMAN_COLLECTION.json`
- **SAP Environment**: `docs/SAP_B1_ENVIRONMENT.json`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 