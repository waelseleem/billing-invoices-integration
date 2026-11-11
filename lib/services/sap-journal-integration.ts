import { logger } from '@/lib/services/logger';
import { oracleService } from '@/lib/services/oracle-service';
import { sapService } from '@/lib/services/sap-service';
import { MonthBillingDto } from '@/lib/types/billing';

// Import translation dictionaries
import arDictionary from '@/lib/i18n/dictionaries/ar.json';
import enDictionary from '@/lib/i18n/dictionaries/en.json';

const dictionaries = { ar: arDictionary, en: enDictionary };

// Helper function to get translation
function getTranslation(locale: string, key: string): string {
  const dictionary = dictionaries[locale as keyof typeof dictionaries] || dictionaries.en;
  const keys = key.split('.');
  let value: any = dictionary;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return the key if translation not found
    }
  }
  return typeof value === 'string' ? value : key;
}

interface JournalLine {
  AccountCode?: string;
  ShortName?: string;
  Credit: number;
  Debit: number;
  CostingCode3?: string; // النشاط
  CostingCode2?: string; // الفرع
  LineMemo?: string;
  U_B1JE004?: string; // UDF for water consumption data
}

interface JournalEntry {
  ReferenceDate: string;
  Memo: string;
  Reference: string;
  JournalEntryLines: JournalLine[];
}

// Interface for raw Oracle data with uppercase field names
interface OracleBillingRecord {
  CSTYPE: string;
  BRANCHE: string;
  COSTCENTER: string;
  CONTRACT: string;
  ENTAGTAM: string;
  ESTDAMA: string;
  ROUNDING: string;
  SEWER: string;
  TANZEEM: string;
  TAXES: string;
  WATERCREDIT: string;
  SEWERCREDIT: string;
  WATERDEBIT: string;
  SEWERDEBIT: string;
  CONSUMP: string;
  BILNG_DATE: string | null;
  DATE_DUMP: string | null;
}

export class SapJournalIntegration {
  /**
   * Creates SAP B1 journal entries grouped by branch from all billing records.
   */
  async createJournalEntryFromBillingData(billingData: any[], locale: string = 'en'): Promise<{
    success: boolean;
    message: string;
    docEntries?: number[];
    journalNumbers?: number[];
    processedCount?: number;
    isDuplicate?: boolean; // Retained for backward compatibility (true when ALL branches are duplicates)
    existingJournalEntry?: any; // Retained for backward compatibility (first duplicate entry found)
    branchResults?: Array<{
      branch: string;
      success: boolean;
      message: string;
      docEntry?: number;
      journalNumber?: number;
      isDuplicate?: boolean;
      existingJournalEntry?: any;
      recordCount: number;
      totals: any;
    }>;
    summary?: {
      totalBranches: number;
      totalRecords: number;
      successfulBranches: number;
      duplicateBranches: number;
      failedBranches: number;
    };
  }> {
    try {
      logger.info(
        'Starting branch-based SAP B1 journal entry creation from provided data'
      );

      if (!billingData || billingData.length === 0) {
        return {
          success: false,
          message: getTranslation(locale, 'sap.journalEntry.noBillingData'),
        };
      }

      // Log some details about the data for debugging
      logger.info(`Found ${billingData.length} billing records to process`);
      logger.info(`First record keys: ${Object.keys(billingData[0]).join(', ')}`);
      
      // Convert Oracle data format to our internal format
      const convertedData = this.convertOracleDataToInternalFormat(billingData);
      
      // Validate required fields in the first record
      const firstRecord = convertedData[0];
      const requiredFields = ['entagtam', 'sewer', 'tanzeem', 'estdama', 'contract', 'taxes', 'rounding', 'consump'];
      const missingFields = requiredFields.filter(field => firstRecord[field as keyof MonthBillingDto] === undefined);
      
      if (missingFields.length > 0) {
        logger.warn(`Missing required fields in billing data: ${missingFields.join(', ')}`);
        // Continue anyway, as we have fallbacks in place
      }

      // Log the first record snapshot
      logger.info(getTranslation(locale, 'sap.journalEntry.sampleBillingData'), {
        firstRecord: {
          entagtam: firstRecord.entagtam,
          sewer: firstRecord.sewer,
          tanzeem: firstRecord.tanzeem,
          estdama: firstRecord.estdama,
          contract: firstRecord.contract,
          taxes: firstRecord.taxes,
          rounding: firstRecord.rounding,
          consump: firstRecord.consump
        }
      });

      // Group by branch
      const groupedByBranch: Record<string, MonthBillingDto[]> = convertedData.reduce((acc: Record<string, MonthBillingDto[]>, r) => {
        const branch = r.branche || r.branchCode || 'DEFAULT';
        if (!acc[branch]) acc[branch] = [];
        acc[branch].push(r);
        return acc;
      }, {});

      const branchResults: Array<{
        branch: string;
        success: boolean;
        message: string;
        docEntry?: number;
        journalNumber?: number;
        isDuplicate?: boolean;
        existingJournalEntry?: any;
        recordCount: number;
        totals: any;
      }> = [];

      const docEntries: number[] = [];
      const journalNumbers: number[] = [];

      for (const [branch, records] of Object.entries(groupedByBranch)) {
        // Build journal for this branch
        const journalEntry = this.createBranchConsolidatedJournalEntry(records, branch, locale);

        // Duplicate check per branch reference
        logger.info(getTranslation(locale, 'sap.journalEntry.checkingExistingJournalEntryBeforeCreating'));
        const existingCheck = await this.checkExistingJournalEntry(journalEntry.Reference, locale);

        if (existingCheck.exists && existingCheck.journalEntry) {
          logger.warn(getTranslation(locale, 'sap.journalEntry.journalEntryExists'), {
            branch,
            reference: journalEntry.Reference,
            existingJdtNum: existingCheck.journalEntry.JdtNum,
            existingNumber: existingCheck.journalEntry.Number
          });

          branchResults.push({
            branch,
            success: false,
            message: getTranslation(locale, 'sap.journalEntry.journalEntryExistsMessage')
              .replace('{transactionNumber}', existingCheck.journalEntry.JdtNum.toString())
              .replace('{journalNumber}', existingCheck.journalEntry.Number.toString())
              .replace('{reference}', existingCheck.journalEntry.Reference),
            docEntry: existingCheck.journalEntry.JdtNum,
            journalNumber: existingCheck.journalEntry.Number,
            isDuplicate: true,
            existingJournalEntry: existingCheck.journalEntry,
            recordCount: records.length,
            totals: this.calculateTotals(records)
          });
          continue;
        }

        // Create in SAP
        try {
          logger.info(getTranslation(locale, 'sap.journalEntry.noExistingJournalEntryFoundCreating'));
          const result = await sapService.post('JournalEntries', journalEntry);
          logger.info(getTranslation(locale, 'sap.journalEntry.successfullyCreated'), {
            branch,
            transactionNumber: result.JdtNum,
            journalNumber: result.Number
          });

          docEntries.push(result.JdtNum);
          journalNumbers.push(result.Number);

          branchResults.push({
            branch,
            success: true,
            message: getTranslation(locale, 'sap.journalEntry.consolidated').replace('{count}', records.length.toString()),
            docEntry: result.JdtNum,
            journalNumber: result.Number,
            recordCount: records.length,
            totals: this.calculateTotals(records)
          });
        } catch (branchError) {
          const errorMessage = branchError instanceof Error ? branchError.message : getTranslation(locale, 'common.unknownError');
          logger.error(getTranslation(locale, 'sap.journalEntry.failedToCreate'), { branch, error: branchError });
          branchResults.push({
            branch,
            success: false,
            message: getTranslation(locale, 'sap.journalEntry.failed').replace('{error}', errorMessage),
            recordCount: records.length,
            totals: this.calculateTotals(records)
          });
        }
      }

      const successfulBranches = branchResults.filter(b => b.success).length;
      const duplicateBranches = branchResults.filter(b => b.isDuplicate).length;
      const failedBranches = branchResults.length - successfulBranches - duplicateBranches;

      return {
        success: successfulBranches > 0 && failedBranches === 0, // overall success if none failed; duplicates allowed
        message: `Processed ${branchResults.length} branches: ${successfulBranches} created, ${duplicateBranches} duplicates, ${failedBranches} failed`,
        docEntries,
        journalNumbers,
        processedCount: successfulBranches,
        isDuplicate: successfulBranches === 0 && duplicateBranches > 0 && failedBranches === 0,
        existingJournalEntry: branchResults.find(b => b.isDuplicate)?.existingJournalEntry,
        branchResults,
        summary: {
          totalBranches: branchResults.length,
          totalRecords: convertedData.length,
          successfulBranches,
          duplicateBranches,
          failedBranches
        }
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : getTranslation(locale, 'common.unknownError');
      logger.error(getTranslation(locale, 'sap.journalEntry.failedToCreate'), { 
        error,
        errorStack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        message: getTranslation(locale, 'sap.journalEntry.failed').replace('{error}', errorMessage),
      };
    }
  }

  /**
   * Converts Oracle data format (uppercase fields) to internal format (lowercase fields)
   */
  private convertOracleDataToInternalFormat(oracleData: any[]): MonthBillingDto[] {
    return oracleData.map((record, index) => {
      // Safely parse numeric values with fallbacks to 0
      const parseNumeric = (value: any): number => {
        if (value === null || value === undefined || value === '') return 0;
        const parsed = Number(value);
        return isNaN(parsed) ? 0 : parsed;
      };
      // Parse date safely
      const parseDate = (dateValue: any): Date => {
        if (!dateValue) return new Date();
        try {
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? new Date() : date;
        } catch {
          return new Date();
        }
      };
      // Add ShortName for C1002 (BP) lines, use CONTRACT as placeholder
      const isBP = record.CSTYPE === 'C1002';
      return {
        lineId: `line_${index + 1}`,
        csType: record.CSTYPE || '',
        branche: record.BRANCHE || '',
        costCenter: record.COSTCENTER || '',
        billingDate: parseDate(record.BILNG_DATE),
        entagtam: parseNumeric(record.ENTAGTAM),
        sewer: parseNumeric(record.SEWER),
        tanzeem: parseNumeric(record.TANZEEM),
        estdama: parseNumeric(record.ESTDAMA),
        contract: parseNumeric(record.CONTRACT),
        taxes: parseNumeric(record.TAXES),
        rounding: parseNumeric(record.ROUNDING),
        waterCredit: parseNumeric(record.WATERCREDIT),
        sewerCredit: parseNumeric(record.SEWERCREDIT),
        waterDebit: parseNumeric(record.WATERDEBIT),
        sewerDebit: parseNumeric(record.SEWERDEBIT),
        consump: parseNumeric(record.CONSUMP),
        glAccountCode: record.CSTYPE || '',
        glAccountName: '',
        activityCode: record.COSTCENTER || '',
        branchCode: record.BRANCHE || '',
        ShortName: isBP ? record.CONTRACT : undefined // placeholder for BP code
      };
    });
  }

  /**
   * Creates a single consolidated SAP B1 journal entry from all Oracle billing data.
   */
  async createSingleJournalEntryFromOracleData(locale: string = 'en'): Promise<{
    success: boolean;
    message: string;
    docEntry?: any;
  }> {
    try {
      logger.info(
        'Starting single consolidated SAP B1 journal entry creation'
      );

      // 1. Get all billing data from Oracle
      const billingData = await oracleService.extractBillingData();

      if (!billingData || billingData.length === 0) {
        return {
          success: false,
          message: getTranslation(locale, 'sap.journalEntry.failed').replace('{error}', getTranslation(locale, 'sap.journalEntry.noBillingDataOracle')),
        };
      }

      // 2. Delegate to the new function
      return this.createJournalEntryFromBillingData(billingData, locale);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : getTranslation(locale, 'common.unknownError');
      logger.error(getTranslation(locale, 'sap.journalEntry.failedToCreateConsolidated'), { error });

      return {
        success: false,
        message: getTranslation(locale, 'sap.journalEntry.failed').replace('{error}', errorMessage),
      };
    }
  }

  /**
   * Get journal entry data without posting to SAP (for preview/viewer)
   */
  async getJournalEntryData(billingData: any[], locale: string = 'en', options?: {
    /**
     * Account used for the WATERDEBIT credit line. Defaults to 511111, which
     * is what the People journal entry uses. The Gov journal entry posts the
     * same amount to 51211 instead.
     */
    waterDebitAccount?: string;
  }): Promise<{
    success: boolean;
    message: string;
    journalEntries?: Array<{
      branch: string;
      journalEntry: JournalEntry;
      totals: any;
      recordCount: number;
    }>;
    summary?: {
      totalBranches: number;
      totalRecords: number;
      successfulBranches: number;
    };
  }> {
    try {
      logger.info(getTranslation(locale, 'sap.journalEntry.gettingJournalEntryData'));

      if (!billingData || billingData.length === 0) {
        return {
          success: false,
          message: getTranslation(locale, 'sap.journalEntry.noBillingDataForPreview'),
        };
      }

      // Convert Oracle data format to our internal format
      const convertedData = this.convertOracleDataToInternalFormat(billingData);

      // Group by branch and create entries per branch
      const groupedByBranch: Record<string, MonthBillingDto[]> = convertedData.reduce((acc: Record<string, MonthBillingDto[]>, r) => {
        const branch = r.branche || r.branchCode || 'DEFAULT';
        if (!acc[branch]) acc[branch] = [];
        acc[branch].push(r);
        return acc;
      }, {});

      const journalEntries = Object.entries(groupedByBranch).map(([branch, records]) => {
        const totals = this.calculateTotals(records);
        const journalEntry = this.createBranchConsolidatedJournalEntry(records, branch, locale, options);
        return {
          branch,
          journalEntry,
          totals,
          recordCount: records.length
        };
      });

      return {
        success: true,
        message: getTranslation(locale, 'sap.journalEntry.journalEntryDataRetrieved'),
        journalEntries,
        summary: {
          totalBranches: journalEntries.length,
          totalRecords: convertedData.length,
          successfulBranches: journalEntries.length
        }
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : getTranslation(locale, 'common.unknownError');
      logger.error(getTranslation(locale, 'sap.journalEntry.failedToGetJournalEntryData'), { error });

      return {
        success: false,
        message: getTranslation(locale, 'sap.journalEntry.failed').replace('{error}', errorMessage),
      };
    }
  }

  /**
   * Create individual journal entry for a single billing record
   */
  private createIndividualJournalEntry(
    record: MonthBillingDto,
    recordNumber: number,
    locale: string = 'en'
  ): JournalEntry {
    // Safely handle the date - it might be a string, Date object, or undefined
    let formattedDate: string;
    try {
      // If billingDate is a string (from localStorage), convert it to a Date first
      const dateValue = typeof record.billingDate === 'string' 
        ? new Date(record.billingDate)
        : record.billingDate;
        
      // If we have a valid date, format it
      if (dateValue && !isNaN(dateValue.getTime())) {
        formattedDate = dateValue.toISOString().split('T')[0]; // YYYY-MM-DD
      } else {
        // Fallback to current date if billingDate is invalid
        formattedDate = new Date().toISOString().split('T')[0];
        logger.warn(`Invalid billing date in record ${recordNumber}, using current date instead`);
      }
    } catch (err) {
      // If any error occurs, use current date as fallback
      formattedDate = new Date().toISOString().split('T')[0];
              logger.warn(getTranslation(locale, 'sap.journalEntry.errorProcessingBillingDateUsingCurrent'), { error: err });
    }

    // Safely handle numeric values with fallbacks to 0
    const entagtam = Number(record.entagtam) || 0;
    const sewer = Number(record.sewer) || 0;
    const tanzeem = Number(record.tanzeem) || 0;
    const estdama = Number(record.estdama) || 0;
    const contract = Number(record.contract) || 0;
    const taxes = Number(record.taxes) || 0;
    const rounding = Number(record.rounding) || 0;
    const consump = Number(record.consump) || 0;

    // Log the record totals for debugging
    logger.info(`Record ${recordNumber} totals:`, {
      contract: record.contract,
      entagtam: parseFloat(entagtam.toFixed(2)),
      sewer: parseFloat(sewer.toFixed(2)),
      tanzeem: parseFloat(tanzeem.toFixed(2)),
      estdama: parseFloat(estdama.toFixed(2)),
      contractAmount: parseFloat(contract.toFixed(2)),
      taxes: parseFloat(taxes.toFixed(2)),
      rounding: parseFloat(rounding.toFixed(2)),
      consump: parseFloat(consump.toFixed(2))
    });

    const journalLines: JournalLine[] = [];
    let totalCredit = 0;

    // Helper to add a credit line and update total
    const addCreditLine = (
      account: string,
      value: number,
      memo: string,
      activity?: string
    ) => {
      if (value > 0) {
        const creditValue = parseFloat(value.toFixed(2));
        journalLines.push({
          AccountCode: account,
          Debit: 0,
          Credit: creditValue,
          CostingCode2: record.branche || '1', // Use branch from record
          LineMemo: memo,
        });
        totalCredit += creditValue;
      }
    };

    // G/L Account mapping matching the working Postman request format
    // Line 2: 511111 - إجمالي مبيعات الإنتاج التام من السلع (Credit)
    addCreditLine('511111', entagtam, 'إجمالي مبيعات الإنتاج التام من السلع', '21');
    
    // Line 3: 511121 - إجمالي المبيعات من الخدمات المؤداة (Credit)
    addCreditLine('511121', sewer, 'إجمالي المبيعات من الخدمات المؤداة', '22');
    
    // Line 4: 324371 - جهاز التنظيم وحماية المستهلك (Credit)
    addCreditLine('324371', estdama, 'جهاز التنظيم وحماية المستهلك', '22');
    
    // Line 5: 51211 - إيرادات مبيعات أخرى (Credit)
    addCreditLine('51211', contract, 'إيرادات مبيعات أخرى', '21');
    
    // Line 6: 324324 - الضريبة على الدمغة (Credit)
    addCreditLine('324324', tanzeem, 'الضريبة على الدمغة', '23');
    
    // Line 7: 324322 - الضريبة على القيمة المضافة (Credit)
    addCreditLine('324322', taxes, 'الضريبة على القيمة المضافة', '22');
    
    // Line 8: 51211 - إيرادات مبيعات أخرى (Credit) - second occurrence
    addCreditLine('51211', rounding, 'إيرادات مبيعات أخرى', '21');


    // Line 1: C1002 - عملاء سكنى (Main debit line) - Add after calculating total credit
    journalLines.unshift({
      ShortName: record.csType || 'C1002', // Use CSTYPE as ShortName for Business Partner
      Debit: parseFloat(totalCredit.toFixed(2)),
      Credit: 0,
      CostingCode2: record.branche || '1', // Use branch from record
      LineMemo: `عملاء سكنى - تعاقد (C1002)`,
      U_B1JE004: record.consump ? record.consump.toString() : '0', // Add water consumption to UDF
    });

    // Validate that the journal entry is balanced
    const totalDebit = journalLines.reduce((sum, line) => sum + line.Debit, 0);
    const totalCreditSum = journalLines.reduce((sum, line) => sum + line.Credit, 0);
    
    if (Math.abs(totalDebit - totalCreditSum) > 0.01) {
      logger.warn(`Journal entry for record ${recordNumber} is not balanced:`, {
        contract: record.contract,
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCreditSum.toFixed(2)),
        difference: parseFloat((totalDebit - totalCreditSum).toFixed(2))
      });
    } else {
      logger.info(`Journal entry for record ${recordNumber} is balanced:`, {
        contract: record.contract,
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCreditSum.toFixed(2))
      });
    }

    // Log the final journal entry structure
    logger.info(`Journal entry structure for record ${recordNumber}:`, {
      contract: record.contract,
      referenceDate: formattedDate,
      memo: `Oracle Billing Integration - Contract (C1002) - ${formattedDate}`,
      reference: `BILL-${record.contract}-${formattedDate.replace(/-/g, '')}`,
      totalLines: journalLines.length,
      totalAmount: parseFloat(totalCredit.toFixed(2)),
      consumption: parseFloat(consump.toFixed(2))
    });

    // Create the final journal entry
    return {
      ReferenceDate: formattedDate,
      Memo: `Oracle Billing Integration - Contract (C1002) - ${formattedDate}`,
      Reference: `BILL-${record.contract}-${formattedDate.replace(/-/g, '')}`,
      JournalEntryLines: journalLines,
    };
  }

  /**
   * Create a single journal entry from all billing records matching the working Postman format
   */
  private createConsolidatedJournalEntry(
    records: MonthBillingDto[],
    locale: string = 'en'
  ): JournalEntry {
    // Use the first record for date and other common fields
    const firstRecord = records[0];
    
    // Safely handle the date - it might be a string, Date object, or undefined
    let formattedDate: string;
    try {
      // If billingDate is a string (from localStorage), convert it to a Date first
      const dateValue = typeof firstRecord.billingDate === 'string' 
        ? new Date(firstRecord.billingDate)
        : firstRecord.billingDate;
        
      // If we have a valid date, format it
      if (dateValue && !isNaN(dateValue.getTime())) {
        formattedDate = dateValue.toISOString().split('T')[0]; // YYYY-MM-DD
      } else {
        // Fallback to current date if billingDate is invalid
        formattedDate = new Date().toISOString().split('T')[0];
        logger.warn(getTranslation(locale, 'sap.journalEntry.invalidBillingDateUsingCurrent'));
      }
    } catch (err) {
      // If any error occurs, use current date as fallback
      formattedDate = new Date().toISOString().split('T')[0];
              logger.warn(getTranslation(locale, 'sap.journalEntry.errorProcessingBillingDateUsingCurrent'), { error: err });
    }

    // Calculate totals across all records - with additional safety checks
    const totals = records.reduce(
      (acc, r) => {
        // Safely handle numeric values with fallbacks to 0
        acc.entagtam += Number(r.entagtam) || 0;
        acc.sewer += Number(r.sewer) || 0;
        acc.tanzeem += Number(r.tanzeem) || 0;
        acc.estdama += Number(r.estdama) || 0;
        acc.contract += Number(r.contract) || 0;
        acc.taxes += Number(r.taxes) || 0;
        acc.rounding += Number(r.rounding) || 0;
        acc.consump += Number(r.consump) || 0;
        acc.waterCredit += Number(r.waterCredit) || 0;
        acc.sewerCredit += Number(r.sewerCredit) || 0;
        acc.waterDebit += Number(r.waterDebit) || 0;
        acc.sewerDebit += Number(r.sewerDebit) || 0;
        return acc;
      },
      {
        entagtam: 0,
        sewer: 0,
        tanzeem: 0,
        estdama: 0,
        contract: 0,
        taxes: 0,
        rounding: 0,
        consump: 0,
        waterCredit: 0,
        sewerCredit: 0,
        waterDebit: 0,
        sewerDebit: 0,
      }
    );

    // Log the calculated totals for debugging
          logger.info(getTranslation(locale, 'sap.journalEntry.calculatedTotalsForJournalEntry'), {
      totals: {
        entagtam: parseFloat(totals.entagtam.toFixed(2)),
        sewer: parseFloat(totals.sewer.toFixed(2)),
        tanzeem: parseFloat(totals.tanzeem.toFixed(2)),
        estdama: parseFloat(totals.estdama.toFixed(2)),
        contract: parseFloat(totals.contract.toFixed(2)),
        taxes: parseFloat(totals.taxes.toFixed(2)),
        rounding: parseFloat(totals.rounding.toFixed(2)),
        consump: parseFloat(totals.consump.toFixed(2)),
        waterCredit: parseFloat(totals.waterCredit.toFixed(2)),
        sewerCredit: parseFloat(totals.sewerCredit.toFixed(2)),
        waterDebit: parseFloat(totals.waterDebit.toFixed(2)),
        sewerDebit: parseFloat(totals.sewerDebit.toFixed(2))
      }
    });

    const journalLines: JournalLine[] = [];
    let totalCredit = 0;

    // Helper to add a credit line and update total
    const addCreditLine = (
      account: string,
      value: number,
      memo: string,
      activity?: string,
      includeConsumption?: boolean
    ) => {
      if (value > 0) {
        const creditValue = parseFloat(value.toFixed(2));
        journalLines.push({
          AccountCode: account,
          Debit: 0,
          Credit: creditValue,
          CostingCode2: '1', // Use default branch
          CostingCode3: activity, // النشاط (activity)
          LineMemo: memo,
          ...(includeConsumption
            ? { U_B1JE004: totals.consump ? totals.consump.toString() : '0' }
            : {}),
        });
        totalCredit += creditValue;
      }
    };

    // G/L Account mapping matching the working Postman request format
    // Line 2: 511111 - إجمالي مبيعات الإنتاج التام من السلع (Credit)
    // Attach consumed water only on the first 511111 line
    addCreditLine('511111', totals.entagtam, 'إجمالي مبيعات الإنتاج التام من السلع', '21', true);
    
    // Line 3: 511121 - إجمالي المبيعات من الخدمات المؤداة (Credit)
    addCreditLine('511121', totals.sewer, 'إجمالي المبيعات من الخدمات المؤداة', '22');
    
    // Line 4: 324371 - جهاز التنظيم وحماية المستهلك (Credit)
    addCreditLine('324371', totals.estdama, 'جهاز التنظيم وحماية المستهلك', '');
    
    // Line 5: 51211 - إيرادات مبيعات أخرى (Credit)
    addCreditLine('51211', totals.contract, 'إيرادات مبيعات أخرى', '21');
    
    // Line 6: 324324 - الضريبة على الدمغة (Credit)
    addCreditLine('324324', totals.tanzeem, 'الضريبة على الدمغة', '');
    
    // Line 7: 324322 - الضريبة على القيمة المضافة (Credit)
    addCreditLine('324322', totals.taxes, 'الضريبة على القيمة المضافة', '');
    
    // Line 8: 51211 - إيرادات مبيعات أخرى (Credit) - second occurrence
    addCreditLine('51211', totals.rounding, 'إيرادات مبيعات أخرى', '23');

    // Calculate additional credit amounts for balancing
    let additionalCredit = 0;

    // Line 11: 511111 - إجمالي مبيعات الإنتاج التام من السلع (Credit) - Water Debit
    if (totals.waterDebit > 0) {
      journalLines.push({
        AccountCode: '511111',
        Debit: 0,
        Credit: parseFloat(totals.waterDebit.toFixed(2)),
        CostingCode2: '1', // Use default branch
        CostingCode3: '21', // النشاط (activity)
        LineMemo: 'إجمالي مبيعات الإنتاج التام من السلع',
      });
      additionalCredit += totals.waterDebit;
    }

    // Line 12: 511121 - إجمالي المبيعات من الخدمات المؤداة (Credit) - Sewer Debit
    if (totals.sewerDebit > 0) {
      journalLines.push({
        AccountCode: '511121',
        Debit: 0,
        Credit: parseFloat(totals.sewerDebit.toFixed(2)),
        CostingCode2: '1', // Use default branch
        CostingCode3: '22', // النشاط (activity)
        LineMemo: 'إجمالي المبيعات من الخدمات المؤداة',
      });
      additionalCredit += totals.sewerDebit;
    }

    // Line 9: 511111 - إجمالي مبيعات الإنتاج التام من السلع (Debit) - Water Credit
    if (Math.abs(totals.waterCredit) > 0) {
      journalLines.push({
        AccountCode: '511111',
        Debit: parseFloat(Math.abs(totals.waterCredit).toFixed(2)),
        Credit: 0,
        CostingCode2: '1', // Use default branch
        CostingCode3: '21', // النشاط (activity)
        LineMemo: 'إجمالي مبيعات الإنتاج التام من السلع',
      });
    }

    // Line 10: 511121 - إجمالي المبيعات من الخدمات المؤداة (Debit) - Sewer Credit
    if (Math.abs(totals.sewerCredit) > 0) {
      journalLines.push({
        AccountCode: '511121',
        Debit: parseFloat(Math.abs(totals.sewerCredit).toFixed(2)),
        Credit: 0,
        CostingCode2: '1', // Use default branch
        CostingCode3: '22', // النشاط (activity)
        LineMemo: 'إجمالي المبيعات من الخدمات المؤداة',
      });
    }

    // Calculate total debits from additional lines
    const totalAdditionalDebits = (Math.abs(totals.waterCredit) > 0 ? Math.abs(totals.waterCredit) : 0) + 
                                 (Math.abs(totals.sewerCredit) > 0 ? Math.abs(totals.sewerCredit) : 0);

    // Line 1: C1002 - عملاء سكنى (Main debit line) - Add after calculating total credit
    const finalTotalCredit = totalCredit + additionalCredit;
    const mainDebitAmount = finalTotalCredit - totalAdditionalDebits;
    
    journalLines.unshift({
      ShortName: 'C1002', // Use CSTYPE as ShortName for Business Partner
      Debit: parseFloat(mainDebitAmount.toFixed(2)),
      Credit: 0,
      CostingCode2: '1', // Use default branch
      LineMemo: `عملاء سكنى - تعاقد (C1002)`,
    });

    // Validate that the journal entry is balanced
    const totalDebit = journalLines.reduce((sum, line) => sum + line.Debit, 0);
    const totalCreditSum = journalLines.reduce((sum, line) => sum + line.Credit, 0);
    
    if (Math.abs(totalDebit - totalCreditSum) > 0.01) {
      logger.warn(getTranslation(locale, 'sap.journalEntry.journalEntryNotBalanced'), {
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCreditSum.toFixed(2)),
        difference: parseFloat((totalDebit - totalCreditSum).toFixed(2))
      });
    } else {
      logger.info(getTranslation(locale, 'sap.journalEntry.journalEntryBalanced'), {
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCreditSum.toFixed(2))
      });
    }

    // Log the final journal entry structure
          logger.info(getTranslation(locale, 'sap.journalEntry.finalJournalEntryStructure'), {
      referenceDate: formattedDate,
      memo: `Oracle Billing Integration - Contract C1002 - ${formattedDate}`,
      reference: `BILL-Contract-C1002-${formattedDate.replace(/-/g, '')}`,
      totalLines: journalLines.length,
      totalAmount: parseFloat(finalTotalCredit.toFixed(2)),
      consumption: parseFloat(totals.consump.toFixed(2))
    });

    // Create the final journal entry matching the working Postman format
    return {
      ReferenceDate: formattedDate,
      Memo: `Oracle Billing Integration - Contract C1002 - ${formattedDate}`,
      Reference: `BILL-Contract-C1002-${formattedDate.replace(/-/g, '')}`,
      JournalEntryLines: journalLines,
    };
  }

  /**
   * Create a branch-specific consolidated journal entry from records
   */
  private createBranchConsolidatedJournalEntry(
    records: MonthBillingDto[],
    branch: string,
    locale: string = 'en',
    options?: { waterDebitAccount?: string }
  ): JournalEntry {
    const firstRecord = records[0];
    let formattedDate: string;
    try {
      const dateValue = typeof firstRecord.billingDate === 'string' 
        ? new Date(firstRecord.billingDate)
        : firstRecord.billingDate;
      if (dateValue && !isNaN(dateValue.getTime())) {
        formattedDate = dateValue.toISOString().split('T')[0];
      } else {
        formattedDate = new Date().toISOString().split('T')[0];
        logger.warn(getTranslation(locale, 'sap.journalEntry.invalidBillingDateUsingCurrent'));
      }
    } catch (err) {
      formattedDate = new Date().toISOString().split('T')[0];
      logger.warn(getTranslation(locale, 'sap.journalEntry.errorProcessingBillingDateUsingCurrent'), { error: err });
    }

    const totals = this.calculateTotals(records);

    const journalLines: JournalLine[] = [];
    let totalCredit = 0;

    const addCreditLine = (
      account: string,
      value: number,
      memo: string,
      activity?: string,
      includeConsumption?: boolean
    ) => {
      if (value > 0) {
        const creditValue = parseFloat(value.toFixed(2));
        journalLines.push({
          AccountCode: account,
          Debit: 0,
          Credit: creditValue,
          CostingCode2: branch,
          CostingCode3: activity,
          LineMemo: memo,
          ...(includeConsumption
            ? { U_B1JE004: totals.consump ? totals.consump.toString() : '0' }
            : {}),
        });
        totalCredit += creditValue;
      }
    };

    // Attach consumed water only on the first 511111 line per branch
    addCreditLine('511111', totals.entagtam, 'إجمالي مبيعات الإنتاج التام من السلع', '21', true);
    addCreditLine('511121', totals.sewer, 'إجمالي المبيعات من الخدمات المؤداة', '22');
    addCreditLine('324371', totals.estdama, 'جهاز التنظيم وحماية المستهلك', '');
    addCreditLine('51211', totals.contract, 'إيرادات مبيعات أخرى', '21');
    addCreditLine('324324', totals.tanzeem, 'الضريبة على الدمغة', '');
    addCreditLine('324322', totals.taxes, 'الضريبة على القيمة المضافة', '');
    addCreditLine('51211', totals.rounding, 'إيرادات مبيعات أخرى', '23');

    let additionalCredit = 0;
    // Account for the WATERDEBIT credit line: 511111 for People, 51211 for Gov.
    const waterDebitAccount = options?.waterDebitAccount || '511111';
    if (totals.waterDebit > 0) {
      journalLines.push({
        AccountCode: waterDebitAccount,
        Debit: 0,
        Credit: parseFloat(totals.waterDebit.toFixed(2)),
        CostingCode2: branch,
        CostingCode3: '21',
        LineMemo: waterDebitAccount === '511111'
          ? 'إجمالي مبيعات الإنتاج التام من السلع'
          : 'إيرادات مبيعات أخرى',
      });
      additionalCredit += totals.waterDebit;
    }
    if (totals.sewerDebit > 0) {
      journalLines.push({
        AccountCode: '511121',
        Debit: 0,
        Credit: parseFloat(totals.sewerDebit.toFixed(2)),
        CostingCode2: branch,
        CostingCode3: '22',
        LineMemo: 'إجمالي المبيعات من الخدمات المؤداة',
      });
      additionalCredit += totals.sewerDebit;
    }
    if (Math.abs(totals.waterCredit) > 0) {
      journalLines.push({
        AccountCode: '511111',
        Debit: parseFloat(Math.abs(totals.waterCredit).toFixed(2)),
        Credit: 0,
        CostingCode2: branch,
        CostingCode3: '21',
        LineMemo: 'إجمالي مبيعات الإنتاج التام من السلع',
      });
    }
    if (Math.abs(totals.sewerCredit) > 0) {
      journalLines.push({
        AccountCode: '511121',
        Debit: parseFloat(Math.abs(totals.sewerCredit).toFixed(2)),
        Credit: 0,
        CostingCode2: branch,
        CostingCode3: '22',
        LineMemo: 'إجمالي المبيعات من الخدمات المؤداة',
      });
    }

    const totalAdditionalDebits = (Math.abs(totals.waterCredit) > 0 ? Math.abs(totals.waterCredit) : 0) + 
                                 (Math.abs(totals.sewerCredit) > 0 ? Math.abs(totals.sewerCredit) : 0);
    const finalTotalCredit = totalCredit + additionalCredit;
    const mainDebitAmount = finalTotalCredit - totalAdditionalDebits;

    journalLines.unshift({
      ShortName: 'C1002',
      Debit: parseFloat(mainDebitAmount.toFixed(2)),
      Credit: 0,
      CostingCode2: branch,
      LineMemo: `عملاء سكنى - تعاقد (C1002)`
    });

    const totalDebit = journalLines.reduce((sum, line) => sum + line.Debit, 0);
    const totalCreditSum = journalLines.reduce((sum, line) => sum + line.Credit, 0);
    if (Math.abs(totalDebit - totalCreditSum) > 0.01) {
      logger.warn(getTranslation(locale, 'sap.journalEntry.journalEntryNotBalanced'), {
        branch,
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCreditSum.toFixed(2)),
        difference: parseFloat((totalDebit - totalCreditSum).toFixed(2))
      });
    }

    return {
      ReferenceDate: formattedDate,
      Memo: `Oracle Billing Integration - Contract C1002 - Branch ${branch} - ${formattedDate}`,
      Reference: `BILL-Contract-C1002-BR-${branch}-${formattedDate.replace(/-/g, '')}`,
      JournalEntryLines: journalLines,
    };
  }

  private calculateTotals(records: MonthBillingDto[]) {
    return records.reduce(
      (acc, r) => {
        acc.entagtam += Number(r.entagtam) || 0;
        acc.sewer += Number(r.sewer) || 0;
        acc.tanzeem += Number(r.tanzeem) || 0;
        acc.estdama += Number(r.estdama) || 0;
        acc.contract += Number(r.contract) || 0;
        acc.taxes += Number(r.taxes) || 0;
        acc.rounding += Number(r.rounding) || 0;
        acc.consump += Number(r.consump) || 0;
        acc.waterCredit += Number(r.waterCredit) || 0;
        acc.sewerCredit += Number(r.sewerCredit) || 0;
        acc.waterDebit += Number(r.waterDebit) || 0;
        acc.sewerDebit += Number(r.sewerDebit) || 0;
        return acc;
      },
      {
        entagtam: 0,
        sewer: 0,
        tanzeem: 0,
        estdama: 0,
        contract: 0,
        taxes: 0,
        rounding: 0,
        consump: 0,
        waterCredit: 0,
        sewerCredit: 0,
        waterDebit: 0,
        sewerDebit: 0,
      }
    );
  }

  /**
   * Check if a journal entry with the same reference already exists in SAP
   */
  async checkExistingJournalEntry(reference: string, locale: string = 'en'): Promise<{
    exists: boolean;
    journalEntry?: any;
    error?: string;
  }> {
    try {
      logger.info(getTranslation(locale, 'sap.journalEntry.checkingExistingJournalEntry'), { reference });

      // Query SAP for journal entries with the same reference
      const endpoint = `JournalEntries?$filter=Reference eq '${reference}'&$select=JdtNum,Number,ReferenceDate,Memo,Reference,JournalEntryLines&$top=1`;

      logger.info(getTranslation(locale, 'sap.journalEntry.queryingSAPEndpointForExistingEntries'), endpoint);

      const result = await sapService.get(endpoint);
      
      if (result && result.value && result.value.length > 0) {
        const existingEntry = result.value[0];
        logger.info(getTranslation(locale, 'sap.journalEntry.foundExistingJournalEntry'), {
          jdtNum: existingEntry.JdtNum,
          number: existingEntry.Number,
          reference: existingEntry.Reference
        });

        return {
          exists: true,
          journalEntry: existingEntry
        };
      } else {
        logger.info(getTranslation(locale, 'sap.journalEntry.noExistingJournalEntryFoundWithReference'), reference);
        return {
          exists: false
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : getTranslation(locale, 'common.unknownError');
      logger.error(getTranslation(locale, 'sap.journalEntry.failedToCheckExistingJournalEntry'), { 
        error,
        errorStack: error instanceof Error ? error.stack : undefined
      });

      return {
        exists: false,
        error: errorMessage
      };
    }
  }

  /**
   * Query the latest journal entry data from SAP
   */
  async getLatestJournalEntryData(journalNumber?: number, transactionNumber?: number, locale: string = 'en'): Promise<{
    success: boolean;
    message: string;
    journalEntry?: any;
    error?: string;
  }> {
    try {
      logger.info(getTranslation(locale, 'sap.journalEntry.queryingLatestJournalEntryData'), {
        journalNumber,
        transactionNumber
      });

      let endpoint = 'JournalEntries';
      let queryParams = [];

      // Build query based on available parameters
      if (journalNumber) {
        queryParams.push(`$filter=Number eq ${journalNumber}`);
      } else if (transactionNumber) {
        queryParams.push(`$filter=JdtNum eq ${transactionNumber}`);
      } else {
        // Get the most recent journal entry
        queryParams.push('$orderby=JdtNum desc');
        queryParams.push('$top=1');
      }

      // Add select to get only the fields we need
      queryParams.push('$select=JdtNum,Number,ReferenceDate,Memo,Reference,JournalEntryLines');

      if (queryParams.length > 0) {
        endpoint += `?${queryParams.join('&')}`;
      }

      logger.info(getTranslation(locale, 'sap.journalEntry.queryingSAPEndpoint'), endpoint);

      const result = await sapService.get(endpoint);
      
      if (result && result.value && result.value.length > 0) {
        const journalEntry = result.value[0];
        logger.info(getTranslation(locale, 'sap.journalEntry.successfullyRetrievedJournalEntryData'), {
          jdtNum: journalEntry.JdtNum,
          number: journalEntry.Number,
          memo: journalEntry.Memo
        });

        return {
          success: true,
          message: getTranslation(locale, 'sap.journalEntry.journalEntryDataRetrieved'),
          journalEntry
        };
      } else {
        return {
          success: false,
          message: getTranslation(locale, 'sap.journalEntry.noJournalEntryFound'),
          error: getTranslation(locale, 'sap.journalEntry.noDataReturnedFromSAP')
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : getTranslation(locale, 'common.unknownError');
      logger.error(getTranslation(locale, 'sap.journalEntry.failedToQueryJournalEntryData'), { 
        error,
        errorStack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        message: getTranslation(locale, 'sap.journalEntry.failedToQueryJournalEntryData'),
        error: errorMessage
      };
    }
  }
}

export const sapJournalIntegration = new SapJournalIntegration(); 