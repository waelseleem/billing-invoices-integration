import { logger } from '@/lib/services/logger';
import { sapService } from '@/lib/services/sap-service';
import { SapJournalIntegration } from '@/lib/services/sap-journal-integration';

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

// Government business partner mapping (عملاء قطاع عام وحكومى)
const GOV_BP_CODE = 'C1001';
const GOV_BP_LABEL = 'عملاء قطاع عام وحكومى - تعاقد (C1001)';

interface GovBranchJournal {
  branch: string;
  journalEntry: any;
  totals: any;
  recordCount: number;
}

interface GovJournalPreviewResult {
  success: boolean;
  message: string;
  journalEntries?: GovBranchJournal[];
  summary?: {
    totalBranches: number;
    totalRecords: number;
    successfulBranches: number;
  };
}

/**
 * Gov-specific wrapper around the existing SapJournalIntegration.
 *
 * It reuses the proven journal builder (same accounts, same totals) and only
 * rewrites the business partner to C1001 and the reference/memo to a GOV
 * specific value so that Gov entries never collide with People entries.
 */
export class GovJournalIntegration {
  private readonly base = new SapJournalIntegration();

  /**
   * Rewrites a People journal entry into its Gov equivalent.
   */
  private transformJournalEntry(journalEntry: any, branch: string): any {
    const referenceDate = journalEntry?.ReferenceDate || new Date().toISOString().split('T')[0];
    const compactDate = String(referenceDate).replace(/-/g, '');
    const reference = `BILL-GOV-${GOV_BP_CODE}-BR-${branch}-${compactDate}`;
    const memo = `Oracle Billing Integration - Gov Contract ${GOV_BP_CODE} - Branch ${branch} - ${referenceDate}`;

    const journalEntryLines = (journalEntry?.JournalEntryLines || []).map((line: any) => {
      // The main debit line is the one that carries the business partner (ShortName).
      if (line && line.ShortName) {
        return {
          ...line,
          ShortName: GOV_BP_CODE,
          LineMemo: GOV_BP_LABEL,
        };
      }
      return line;
    });

    return {
      ...journalEntry,
      ReferenceDate: referenceDate,
      Memo: memo,
      Reference: reference,
      JournalEntryLines: journalEntryLines,
    };
  }

  /**
   * Generates Gov journal entries (per branch) for preview.
   */
  async getGovJournalEntryData(
    billingData: any[],
    locale: string = 'en'
  ): Promise<GovJournalPreviewResult> {
    const result = await this.base.getJournalEntryData(billingData, locale);

    if (!result.success || !result.journalEntries) {
      return {
        success: result.success,
        message: result.message,
        summary: result.summary,
      };
    }

    const journalEntries = result.journalEntries.map((item) => ({
      branch: item.branch,
      journalEntry: this.transformJournalEntry(item.journalEntry, item.branch),
      totals: item.totals,
      recordCount: item.recordCount,
    }));

    return {
      success: true,
      message: result.message,
      journalEntries,
      summary: result.summary,
    };
  }

  /**
   * Creates Gov SAP B1 journal entries grouped by branch.
   * Duplicate detection uses the Gov reference so it never collides with People.
   */
  async createGovJournalEntryFromBillingData(
    billingData: any[],
    locale: string = 'en'
  ): Promise<{
    success: boolean;
    message: string;
    docEntries?: number[];
    journalNumbers?: number[];
    processedCount?: number;
    isDuplicate?: boolean;
    existingJournalEntry?: any;
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
      logger.info('Starting branch-based GOV SAP B1 journal entry creation from provided data');

      if (!billingData || billingData.length === 0) {
        return {
          success: false,
          message: getTranslation(locale, 'sap.journalEntry.noBillingData'),
        };
      }

      const preview = await this.getGovJournalEntryData(billingData, locale);

      if (!preview.success || !preview.journalEntries || preview.journalEntries.length === 0) {
        return {
          success: false,
          message: preview.message,
        };
      }

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

      for (const item of preview.journalEntries) {
        const { branch, journalEntry, recordCount, totals } = item;

        // Duplicate check per Gov branch reference
        const existingCheck = await this.base.checkExistingJournalEntry(journalEntry.Reference, locale);

        if (existingCheck.exists && existingCheck.journalEntry) {
          logger.warn(getTranslation(locale, 'sap.journalEntry.journalEntryExists'), {
            branch,
            reference: journalEntry.Reference,
            existingJdtNum: existingCheck.journalEntry.JdtNum,
            existingNumber: existingCheck.journalEntry.Number,
          });

          branchResults.push({
            branch,
            success: false,
            message: getTranslation(locale, 'sap.journalEntry.journalEntryExistsMessage')
              .replace('{transactionNumber}', String(existingCheck.journalEntry.JdtNum))
              .replace('{journalNumber}', String(existingCheck.journalEntry.Number))
              .replace('{reference}', String(existingCheck.journalEntry.Reference)),
            docEntry: existingCheck.journalEntry.JdtNum,
            journalNumber: existingCheck.journalEntry.Number,
            isDuplicate: true,
            existingJournalEntry: existingCheck.journalEntry,
            recordCount,
            totals,
          });
          continue;
        }

        // Create in SAP
        try {
          logger.info(getTranslation(locale, 'sap.journalEntry.noExistingJournalEntryFoundCreating'), {
            branch,
            reference: journalEntry.Reference,
          });

          const result = await sapService.post('JournalEntries', journalEntry);

          logger.info(getTranslation(locale, 'sap.journalEntry.successfullyCreated'), {
            branch,
            transactionNumber: result.JdtNum,
            journalNumber: result.Number,
          });

          docEntries.push(result.JdtNum);
          journalNumbers.push(result.Number);

          branchResults.push({
            branch,
            success: true,
            message: getTranslation(locale, 'sap.journalEntry.consolidated').replace(
              '{count}',
              String(recordCount)
            ),
            docEntry: result.JdtNum,
            journalNumber: result.Number,
            recordCount,
            totals,
          });
        } catch (branchError) {
          const errorMessage =
            branchError instanceof Error
              ? branchError.message
              : getTranslation(locale, 'common.unknownError');

          logger.error(getTranslation(locale, 'sap.journalEntry.failedToCreate'), {
            branch,
            error: branchError,
          });

          branchResults.push({
            branch,
            success: false,
            message: getTranslation(locale, 'sap.journalEntry.failed').replace(
              '{error}',
              errorMessage
            ),
            recordCount,
            totals,
          });
        }
      }

      const successfulBranches = branchResults.filter((b) => b.success).length;
      const duplicateBranches = branchResults.filter((b) => b.isDuplicate).length;
      const failedBranches = branchResults.length - successfulBranches - duplicateBranches;

      return {
        success: successfulBranches > 0 && failedBranches === 0,
        message: `Processed ${branchResults.length} GOV branches: ${successfulBranches} created, ${duplicateBranches} duplicates, ${failedBranches} failed`,
        docEntries,
        journalNumbers,
        processedCount: successfulBranches,
        isDuplicate: successfulBranches === 0 && duplicateBranches > 0 && failedBranches === 0,
        existingJournalEntry: branchResults.find((b) => b.isDuplicate)?.existingJournalEntry,
        branchResults,
        summary: {
          totalBranches: branchResults.length,
          totalRecords: preview.summary?.totalRecords ?? billingData.length,
          successfulBranches,
          duplicateBranches,
          failedBranches,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : getTranslation(locale, 'common.unknownError');

      logger.error(getTranslation(locale, 'sap.journalEntry.failedToCreate'), {
        error,
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        message: getTranslation(locale, 'sap.journalEntry.failed').replace('{error}', errorMessage),
      };
    }
  }
}

export const govJournalIntegration = new GovJournalIntegration();
