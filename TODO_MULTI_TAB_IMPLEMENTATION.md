# TODO: Multi-Tab Implementation for Bani Swaif Water Integration

## Overview
This document outlines the comprehensive implementation plan for adding multiple customer type tabs (سكنى, حكومى, اهالى, مقاسات) to each main dashboard tab, plus a new تحصيل يومى (Daily Collection) tab for handling customer payments.

## Current Implementation Analysis
- **Current State**: System handles only اهالى (Residential) customers
- **Data Source**: Oracle database with billing data
- **Integration**: SAP B1 for journal entries
- **Architecture**: Next.js with TypeScript, Oracle service, SAP integration

## 1. Database Schema Updates

### 1.1 Oracle View Modifications
```sql
-- New Oracle views needed for each customer type
-- Current: Single view for اهالى customers
-- New: Separate views for each customer type

-- سكنى (Residential) View
CREATE OR REPLACE VIEW VW_BILLING_RESIDENTIAL AS
SELECT 
    CSTYPE,
    BRANCHE,
    BILNG_DATE,
    ENTAGTAM,
    SEWER,
    TANZEEM,
    ESTDAMA,
    CONTRACT,
    TAXES,
    WATERCREDIT,
    SEWERCREDIT,
    CONSUMP,
    -- Additional fields specific to residential
    CUSTOMER_CATEGORY,
    METER_TYPE
FROM BILLING_DATA 
WHERE CSTYPE = 'RESIDENTIAL';

-- حكومى (Government) View
CREATE OR REPLACE VIEW VW_BILLING_GOVERNMENT AS
SELECT 
    CSTYPE,
    BRANCHE,
    BILNG_DATE,
    ENTAGTAM,
    SEWER,
    TANZEEM,
    ESTDAMA,
    CONTRACT,
    TAXES,
    WATERCREDIT,
    SEWERCREDIT,
    CONSUMP,
    -- Additional fields specific to government
    DEPARTMENT_CODE,
    GOVERNMENT_ENTITY,
    CONTRACT_NUMBER
FROM BILLING_DATA 
WHERE CSTYPE = 'GOVERNMENT';

-- مقاسات (Commercial) View
CREATE OR REPLACE VIEW VW_BILLING_COMMERCIAL AS
SELECT 
    CSTYPE,
    BRANCHE,
    BILNG_DATE,
    ENTAGTAM,
    SEWER,
    TANZEEM,
    ESTDAMA,
    CONTRACT,
    TAXES,
    WATERCREDIT,
    SEWERCREDIT,
    CONSUMP,
    -- Additional fields specific to commercial
    BUSINESS_TYPE,
    LICENSE_NUMBER,
    COMMERCIAL_CATEGORY
FROM BILLING_DATA 
WHERE CSTYPE = 'COMMERCIAL';

-- تحصيل يومى (Daily Collection) View
CREATE OR REPLACE VIEW VW_DAILY_COLLECTION AS
SELECT 
    COLLECTION_DATE,
    BRANCHE,
    CUSTOMER_TYPE,
    PAYMENT_METHOD,
    AMOUNT_COLLECTED,
    RECEIPT_NUMBER,
    COLLECTOR_ID,
    -- Additional collection fields
    CASH_AMOUNT,
    CARD_AMOUNT,
    BANK_TRANSFER_AMOUNT,
    TOTAL_RECEIPTS,
    COLLECTION_STATUS
FROM DAILY_COLLECTIONS;
```

### 1.2 SAP Account Code Mapping
```typescript
// New account code configurations for each customer type
interface AccountCodeMapping {
  residential: {
    revenue: string;      // e.g., "4001001" - Residential Water Revenue
    sewer: string;        // e.g., "4001002" - Residential Sewer Revenue
    taxes: string;        // e.g., "2201001" - Residential VAT
    receivables: string;  // e.g., "1101001" - Residential Receivables
  };
  government: {
    revenue: string;      // e.g., "4002001" - Government Water Revenue
    sewer: string;        // e.g., "4002002" - Government Sewer Revenue
    taxes: string;        // e.g., "2202001" - Government VAT
    receivables: string;  // e.g., "1102001" - Government Receivables
  };
  commercial: {
    revenue: string;      // e.g., "4003001" - Commercial Water Revenue
    sewer: string;        // e.g., "4003002" - Commercial Sewer Revenue
    taxes: string;        // e.g., "2203001" - Commercial VAT
    receivables: string;  // e.g., "1103001" - Commercial Receivables
  };
}
```

## 2. Backend API Updates

### 2.1 Oracle Service Enhancements
```typescript
// lib/services/oracle-service.ts
interface OracleServiceConfig {
  customerTypes: {
    residential: {
      viewName: string;
      accountCodes: AccountCodeMapping['residential'];
    };
    government: {
      viewName: string;
      accountCodes: AccountCodeMapping['government'];
    };
    commercial: {
      viewName: string;
      accountCodes: AccountCodeMapping['commercial'];
    };
  };
}

class OracleService {
  // New methods for each customer type
  async fetchResidentialData(): Promise<BillingData[]>
  async fetchGovernmentData(): Promise<BillingData[]>
  async fetchCommercialData(): Promise<BillingData[]>
  async fetchDailyCollectionData(): Promise<CollectionData[]>
  
  // Enhanced data fetching with customer type parameter
  async fetchDataByCustomerType(customerType: CustomerType): Promise<BillingData[]>
}
```

### 2.2 New API Endpoints
```typescript
// app/api/oracle-data/[customerType]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { customerType: string } }
) {
  const { customerType } = params;
  // Fetch data based on customer type
}

// app/api/daily-collection/route.ts
export async function GET() {
  // Fetch daily collection data
}

export async function POST(request: Request) {
  // Create new collection entry
}

// app/api/journal-entries/[customerType]/generate/route.ts
export async function POST(
  request: Request,
  { params }: { params: { customerType: string } }
) {
  // Generate journal entries for specific customer type
}
```

## 3. Frontend Component Updates

### 3.1 Tab Structure Implementation
```typescript
// components/customer-type-tabs.tsx
interface CustomerTypeTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  locale: string;
}

const customerTypes = [
  { id: 'residential', label: { en: 'Residential', ar: 'سكنى' } },
  { id: 'government', label: { en: 'Government', ar: 'حكومى' } },
  { id: 'commercial', label: { en: 'Commercial', ar: 'مقاسات' } },
  { id: 'collection', label: { en: 'Daily Collection', ar: 'تحصيل يومى' } }
];
```

### 3.2 Updated Main Tabs
```typescript
// components/overview-tab.tsx - Updated
export function OverviewTab() {
  const [activeCustomerType, setActiveCustomerType] = useState('residential');
  
  return (
    <div>
      <CustomerTypeTabs 
        activeTab={activeCustomerType}
        onTabChange={setActiveCustomerType}
        locale={locale}
      />
      
      {activeCustomerType === 'residential' && <ResidentialOverview />}
      {activeCustomerType === 'government' && <GovernmentOverview />}
      {activeCustomerType === 'commercial' && <CommercialOverview />}
      {activeCustomerType === 'collection' && <DailyCollectionOverview />}
    </div>
  );
}

// components/oracle-data-tab.tsx - Updated
export function OracleDataTab() {
  const [activeCustomerType, setActiveCustomerType] = useState('residential');
  
  return (
    <div>
      <CustomerTypeTabs 
        activeTab={activeCustomerType}
        onTabChange={setActiveCustomerType}
        locale={locale}
      />
      
      {activeCustomerType === 'residential' && <ResidentialDataTable />}
      {activeCustomerType === 'government' && <GovernmentDataTable />}
      {activeCustomerType === 'commercial' && <CommercialDataTable />}
      {activeCustomerType === 'collection' && <DailyCollectionTable />}
    </div>
  );
}

// components/journal-entry-viewer-tab.tsx - Updated
export function JournalEntryViewerTab() {
  const [activeCustomerType, setActiveCustomerType] = useState('residential');
  
  return (
    <div>
      <CustomerTypeTabs 
        activeTab={activeCustomerType}
        onTabChange={setActiveCustomerType}
        locale={locale}
      />
      
      {activeCustomerType === 'residential' && <ResidentialJournalEntries />}
      {activeCustomerType === 'government' && <GovernmentJournalEntries />}
      {activeCustomerType === 'commercial' && <CommercialJournalEntries />}
      {activeCustomerType === 'collection' && <DailyCollectionJournalEntries />}
    </div>
  );
}
```

### 3.3 Customer Type Specific Components
```typescript
// components/customer-types/residential-overview.tsx
export function ResidentialOverview() {
  // Residential-specific overview with charts and stats
}

// components/customer-types/government-overview.tsx
export function GovernmentOverview() {
  // Government-specific overview with department breakdowns
}

// components/customer-types/commercial-overview.tsx
export function CommercialOverview() {
  // Commercial-specific overview with business type analysis
}

// components/customer-types/daily-collection-overview.tsx
export function DailyCollectionOverview() {
  // Daily collection overview with payment method breakdowns
}
```

## 4. Data Context Updates

### 4.1 Enhanced Oracle Data Context
```typescript
// lib/oracle-data-context.tsx
interface OracleDataContextType {
  // Existing properties
  data: BillingData[];
  loading: boolean;
  error: string | null;
  
  // New properties for multi-customer type support
  customerTypeData: {
    residential: BillingData[];
    government: BillingData[];
    commercial: BillingData[];
    collection: CollectionData[];
  };
  
  // New methods
  fetchDataByCustomerType: (customerType: CustomerType) => Promise<void>;
  getDataForCustomerType: (customerType: CustomerType) => BillingData[];
  clearCustomerTypeData: (customerType: CustomerType) => void;
}
```

### 4.2 New Collection Data Context
```typescript
// lib/collection-data-context.tsx
interface CollectionDataContextType {
  collectionData: CollectionData[];
  loading: boolean;
  error: string | null;
  
  fetchCollectionData: () => Promise<void>;
  addCollectionEntry: (entry: CollectionEntry) => Promise<void>;
  updateCollectionEntry: (id: string, updates: Partial<CollectionEntry>) => Promise<void>;
}
```

## 5. Translation Updates

### 5.1 Enhanced Translation Files
```json
// lib/i18n/dictionaries/en.json
{
  "customerTypes": {
    "residential": "Residential",
    "government": "Government", 
    "commercial": "Commercial",
    "collection": "Daily Collection"
  },
  "residential": {
    "title": "Residential Customers",
    "subtitle": "Manage residential customer billing data",
    "stats": {
      "totalHouseholds": "Total Households",
      "averageConsumption": "Average Consumption",
      "paymentRate": "Payment Rate"
    }
  },
  "government": {
    "title": "Government Customers",
    "subtitle": "Manage government entity billing data",
    "stats": {
      "totalDepartments": "Total Departments",
      "totalEntities": "Total Entities",
      "contractValue": "Contract Value"
    }
  },
  "commercial": {
    "title": "Commercial Customers", 
    "subtitle": "Manage commercial business billing data",
    "stats": {
      "totalBusinesses": "Total Businesses",
      "businessTypes": "Business Types",
      "averageRevenue": "Average Revenue"
    }
  },
  "dailyCollection": {
    "title": "Daily Collection",
    "subtitle": "Manage daily customer payments and collections",
    "stats": {
      "totalCollected": "Total Collected",
      "totalReceipts": "Total Receipts",
      "collectionRate": "Collection Rate"
    },
    "paymentMethods": {
      "cash": "Cash",
      "card": "Card",
      "bankTransfer": "Bank Transfer"
    }
  }
}
```

```json
// lib/i18n/dictionaries/ar.json
{
  "customerTypes": {
    "residential": "سكنى",
    "government": "حكومى",
    "commercial": "مقاسات", 
    "collection": "تحصيل يومى"
  },
  "residential": {
    "title": "العملاء السكنيين",
    "subtitle": "إدارة بيانات الفواتير للعملاء السكنيين",
    "stats": {
      "totalHouseholds": "إجمالي الأسر",
      "averageConsumption": "متوسط الاستهلاك",
      "paymentRate": "معدل الدفع"
    }
  },
  "government": {
    "title": "العملاء الحكوميين",
    "subtitle": "إدارة بيانات الفواتير للجهات الحكومية",
    "stats": {
      "totalDepartments": "إجمالي الأقسام",
      "totalEntities": "إجمالي الجهات",
      "contractValue": "قيمة العقود"
    }
  },
  "commercial": {
    "title": "العملاء التجاريين",
    "subtitle": "إدارة بيانات الفواتير للأنشطة التجارية",
    "stats": {
      "totalBusinesses": "إجمالي الأعمال",
      "businessTypes": "أنواع الأعمال",
      "averageRevenue": "متوسط الإيرادات"
    }
  },
  "dailyCollection": {
    "title": "التحصيل اليومي",
    "subtitle": "إدارة المدفوعات والتحصيل اليومي للعملاء",
    "stats": {
      "totalCollected": "إجمالي المحصل",
      "totalReceipts": "إجمالي الإيصالات",
      "collectionRate": "معدل التحصيل"
    },
    "paymentMethods": {
      "cash": "نقداً",
      "card": "بطاقة",
      "bankTransfer": "تحويل بنكي"
    }
  }
}
```

## 6. SAP Integration Updates

### 6.1 Enhanced Journal Entry Generation
```typescript
// lib/services/sap-journal-integration.ts
class SAPJournalIntegration {
  // Generate journal entries for specific customer type
  async generateJournalEntryForCustomerType(
    customerType: CustomerType,
    billingData: BillingData[]
  ): Promise<JournalEntry[]> {
    const accountCodes = this.getAccountCodesForCustomerType(customerType);
    return this.createJournalEntries(billingData, accountCodes);
  }
  
  // Generate collection journal entries
  async generateCollectionJournalEntry(
    collectionData: CollectionData[]
  ): Promise<JournalEntry[]> {
    // Handle collection to receivables journal entries
  }
  
  private getAccountCodesForCustomerType(customerType: CustomerType): AccountCodeMapping {
    const accountCodes = {
      residential: {
        revenue: "4001001",
        sewer: "4001002", 
        taxes: "2201001",
        receivables: "1101001"
      },
      government: {
        revenue: "4002001",
        sewer: "4002002",
        taxes: "2202001", 
        receivables: "1102001"
      },
      commercial: {
        revenue: "4003001",
        sewer: "4003002",
        taxes: "2203001",
        receivables: "1103001"
      }
    };
    
    return accountCodes[customerType];
  }
}
```

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Update Oracle database with new views
- [ ] Create account code mapping configuration
- [ ] Update Oracle service with customer type support
- [ ] Create new API endpoints for customer types
- [ ] Update translation files

### Phase 2: Frontend Components (Week 3-4)
- [ ] Create CustomerTypeTabs component
- [ ] Update main tab components (overview, oracle-data, journal-entry-viewer)
- [ ] Create customer type specific components
- [ ] Update data contexts for multi-customer type support
- [ ] Implement tab switching logic

### Phase 3: SAP Integration (Week 5-6)
- [ ] Update SAP journal integration for customer types
- [ ] Implement collection journal entry generation
- [ ] Test journal entry generation for each customer type
- [ ] Validate account code mappings

### Phase 4: Daily Collection Feature (Week 7-8)
- [ ] Create daily collection data model
- [ ] Implement collection data context
- [ ] Create collection UI components
- [ ] Implement collection to SAP integration
- [ ] Add collection reporting and analytics

### Phase 5: Testing & Polish (Week 9-10)
- [ ] Comprehensive testing for all customer types
- [ ] Performance optimization
- [ ] UI/UX improvements
- [ ] Documentation updates
- [ ] User training materials

## 8. Configuration Files

### 8.1 Customer Type Configuration
```typescript
// lib/config/customer-types.ts
export const CUSTOMER_TYPE_CONFIG = {
  residential: {
    id: 'residential',
    label: { en: 'Residential', ar: 'سكنى' },
    oracleView: 'VW_BILLING_RESIDENTIAL',
    accountCodes: {
      revenue: '4001001',
      sewer: '4001002',
      taxes: '2201001',
      receivables: '1101001'
    },
    features: ['billing', 'collection', 'reports']
  },
  government: {
    id: 'government',
    label: { en: 'Government', ar: 'حكومى' },
    oracleView: 'VW_BILLING_GOVERNMENT',
    accountCodes: {
      revenue: '4002001',
      sewer: '4002002',
      taxes: '2202001',
      receivables: '1102001'
    },
    features: ['billing', 'collection', 'reports', 'contracts']
  },
  commercial: {
    id: 'commercial',
    label: { en: 'Commercial', ar: 'مقاسات' },
    oracleView: 'VW_BILLING_COMMERCIAL',
    accountCodes: {
      revenue: '4003001',
      sewer: '4003002',
      taxes: '2203001',
      receivables: '1103001'
    },
    features: ['billing', 'collection', 'reports', 'businessTypes']
  },
  collection: {
    id: 'collection',
    label: { en: 'Daily Collection', ar: 'تحصيل يومى' },
    oracleView: 'VW_DAILY_COLLECTION',
    accountCodes: {
      cash: '1001001',
      receivables: '1101001',
      revenue: '4001001'
    },
    features: ['collection', 'payments', 'reports']
  }
};
```

## 9. Testing Strategy

### 9.1 Unit Tests
- [ ] Test Oracle service for each customer type
- [ ] Test SAP integration with different account codes
- [ ] Test journal entry generation for each type
- [ ] Test collection data handling

### 9.2 Integration Tests
- [ ] Test end-to-end flow for each customer type
- [ ] Test tab switching and data loading
- [ ] Test SAP synchronization for each type
- [ ] Test collection workflow

### 9.3 User Acceptance Testing
- [ ] Test with real Oracle data for each customer type
- [ ] Validate journal entries in SAP B1
- [ ] Test collection recording and reporting
- [ ] Validate Arabic/English translations

## 10. Deployment Considerations

### 10.1 Database Migration
- [ ] Create Oracle views in production
- [ ] Update account code mappings in SAP
- [ ] Migrate existing data if needed
- [ ] Backup existing configuration

### 10.2 Application Deployment
- [ ] Deploy updated application code
- [ ] Update environment variables for new features
- [ ] Test in staging environment
- [ ] Gradual rollout to production

### 10.3 User Training
- [ ] Create user guides for each customer type
- [ ] Train users on new tab structure
- [ ] Document collection procedures
- [ ] Provide troubleshooting guides

## 11. Future Enhancements

### 11.1 Advanced Features
- [ ] Customer type specific reporting
- [ ] Advanced analytics per customer type
- [ ] Custom workflows for each type
- [ ] Integration with external systems

### 11.2 Performance Optimizations
- [ ] Data caching per customer type
- [ ] Lazy loading for tab content
- [ ] Optimized database queries
- [ ] Background data processing

## Notes
- Account codes and Oracle view names will be provided by the client
- Journal entry details and specific business rules will be confirmed
- Testing should be done with real data from the client's Oracle system
- Arabic translations should be reviewed by native speakers
- All changes should maintain backward compatibility with existing اهالى implementation
