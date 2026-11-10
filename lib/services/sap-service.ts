// SAP B1 Service Layer API Configuration and Utilities

import { SAPConfig, SAPSession, SAPError } from '@/lib/types/sap';
import axios from 'axios';
import { logger } from '@/lib/services/logger';
import https from 'https';

export interface DocumentHeader {
  DocEntry?: number
  DocNum?: number
  CardCode: string
  CardName?: string
  DocDate: string
  DocDueDate?: string
  TaxDate?: string
  Comments?: string
  DocTotal?: number
  DocCurrency?: string
  DocRate?: number
  SalesPersonCode?: number
  PaymentGroupCode?: number
  Series?: number
  U_CustomField?: string
}

export interface DocumentLine {
  LineNum?: number
  ItemCode?: string
  ItemDescription?: string
  Quantity: number
  UnitPrice?: number
  LineTotal?: number
  WarehouseCode?: string
  TaxCode?: string
  DiscountPercent?: number
  BaseEntry?: number
  BaseType?: number
  BaseLine?: number
  U_CustomLineField?: string
}

export interface SAPDocument extends DocumentHeader {
  DocumentLines: DocumentLine[]
}

export interface QueryOptions {
  $select?: string
  $filter?: string
  $orderby?: string
  $top?: number
  $skip?: number
  $expand?: string
}

export class SAPServiceLayer {
  private static instance: SAPServiceLayer
  private session: SAPSession | null = null
  private config: SAPConfig
  private loginAttempts: number = 0
  private maxLoginAttempts: number = 3
  private httpsAgent: https.Agent

  private constructor() {
    this.config = {
      serviceLayerUrl: process.env.SAP_SERVICE_LAYER_URL || 'https://localhost:50000/b1s/v1',
      companyDB: process.env.SAP_COMPANY_DB || 'SBODemoUS',
      username: process.env.SAP_USERNAME || 'manager',
      password: process.env.SAP_PASSWORD || 'manager'
    }

    // Create HTTPS agent with SSL certificate validation disabled
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false // Disable SSL certificate validation
    });

    logger.info(`SAP Service initialized. SSL verification disabled`);

    this.loadSessionFromStorage();
  }

  public static getInstance(): SAPServiceLayer {
    if (!SAPServiceLayer.instance) {
      SAPServiceLayer.instance = new SAPServiceLayer()
    }
    return SAPServiceLayer.instance
  }

  // Session management
  private saveSessionToStorage(): void {
    if (this.session && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem("sap-session", JSON.stringify(this.session))
        logger.info('SAP session saved to localStorage');
      } catch (error) {
        console.warn("Could not save session to localStorage:", error)
      }
    }
  }

  private loadSessionFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      // Server-side or localStorage not available
      return
    }

    try {
      const stored = localStorage.getItem("sap-session")
      if (stored) {
        const session = JSON.parse(stored)
        // Don't check expiration here to allow using expired sessions
        this.session = session
        logger.info('SAP session loaded from localStorage');
      }
    } catch (error) {
      console.error("Failed to load session from storage:", error)
      try {
        localStorage.removeItem("sap-session")
      } catch (removeError) {
        console.warn("Could not remove invalid session from localStorage:", removeError)
      }
    }
  }

  public getSession(): SAPSession | null {
    return this.session
  }

  public isAuthenticated(): boolean {
    return this.session !== null;
    // Don't check expiration to allow using expired sessions
    // return this.session !== null && new Date(this.session.expiresAt) > new Date()
  }

  // Authentication
  public async login(config: SAPConfig): Promise<void> {
    try {
      this.loginAttempts++;
      logger.info(`Attempting to log in to SAP B1 (attempt ${this.loginAttempts})`);

      const response = await axios.post(`${config.serviceLayerUrl}/Login`, {
        CompanyDB: config.companyDB,
        UserName: config.username,
        Password: config.password,
      }, {
        httpsAgent: this.httpsAgent // Use the agent with disabled SSL verification
      });

      this.session = response.data;
      this.loginAttempts = 0; // Reset counter on successful login
      this.saveSessionToStorage();
      logger.info('Successfully logged in to SAP B1 Service Layer');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error('Login error:', { message: errorMessage, status: error.response?.status });
      
      if (this.loginAttempts >= this.maxLoginAttempts) {
        logger.error(`Maximum login attempts (${this.maxLoginAttempts}) reached. Giving up.`);
        this.loginAttempts = 0;
        throw new Error(`Failed to log in after ${this.maxLoginAttempts} attempts: ${errorMessage}`);
      }
      
      throw error;
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.session) {
        await axios.post(`${this.config.serviceLayerUrl}/Logout`, {}, {
          headers: {
            'Cookie': `B1SESSION=${this.session.SessionId}`
          },
          httpsAgent: this.httpsAgent
        });
      }
    } catch (error) {
      logger.error("Logout error:", error)
    } finally {
      this.session = null
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem("sap-session")
        } catch (error) {
          logger.warn("Could not remove session from localStorage:", error)
        }
      }
    }
  }

  // Generic request method
  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Try to use existing session even if expired
    if (!this.session) {
      logger.info('No SAP session found, attempting login');
      await this.login(this.config);
    }

    const url = `${this.config.serviceLayerUrl}/${endpoint}`;
    logger.info(`[SAP Service] Making request to: ${url}`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add session cookie if available
      if (this.session?.SessionId) {
        headers['Cookie'] = `B1SESSION=${this.session.SessionId}`;
      }

      // Add any custom headers from options
      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      const response = await axios({
        url,
        method: options.method || 'GET',
        data: options.body ? JSON.parse(options.body as string) : undefined,
        headers,
        httpsAgent: this.httpsAgent,
        timeout: 30000 // 30 second timeout
      });

      logger.info(`[SAP Service] Response status: ${response.status}`);
      return response.data;
    } catch (error: any) {
      logger.error('[SAP Service] Request error:', { 
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      // Handle session expiration - only retry once to prevent infinite loops
      if (error.response?.status === 401 && 
          error.response?.data?.error?.code === 301) {
        logger.info('[SAP Service] Session expired, attempting re-login...');
        
        // Clear the current session
        this.session = null;
        
        // Try to login again
        try {
          await this.login(this.config);
          
          // Retry the request with the new session
          const retryHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (this.session && (this.session as SAPSession).SessionId) {
            retryHeaders['Cookie'] = `B1SESSION=${(this.session as SAPSession).SessionId}`;
          }

          if (options.headers) {
            Object.assign(retryHeaders, options.headers);
          }

          const retryResponse = await axios({
            url,
            method: options.method || 'GET',
            data: options.body ? JSON.parse(options.body as string) : undefined,
            headers: retryHeaders,
            httpsAgent: this.httpsAgent,
            timeout: 30000
          });

          logger.info(`[SAP Service] Retry response status: ${retryResponse.status}`);
          return retryResponse.data;
        } catch (retryError: any) {
          logger.error('[SAP Service] Retry failed:', { 
            message: retryError.message,
            status: retryError.response?.status,
            data: retryError.response?.data
          });
          throw retryError;
        }
      }

      throw error;
    }
  }

  // Convenience methods
  public async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" })
  }

  public async post<T = any>(endpoint: string, data?: any): Promise<T> {
    try {
      logger.info(`Posting data to SAP endpoint: ${endpoint}`, {
        dataKeys: data ? Object.keys(data) : 'No data',
        endpoint
      });
      
      // For JournalEntries, log additional details
      if (endpoint === 'JournalEntries') {
        logger.info('Journal Entry details', {
          date: data?.ReferenceDate,
          memo: data?.Memo,
          linesCount: data?.JournalEntryLines?.length,
          totalDebit: data?.JournalEntryLines?.reduce((sum: number, line: any) => sum + (line.Debit || 0), 0),
          totalCredit: data?.JournalEntryLines?.reduce((sum: number, line: any) => sum + (line.Credit || 0), 0),
        });
      }
      
      return this.request<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
      });
    } catch (error: any) {
      if (error.response?.status === 400) {
        // Log detailed information about the 400 Bad Request error
        logger.error('SAP 400 Bad Request Error', {
          endpoint,
          requestData: data,
          responseData: error.response?.data,
          errorMessage: error.message,
          errorDetails: error.response?.data?.error?.message?.value
        });
        
        // Try to extract a more meaningful error message
        const sapErrorMessage = error.response?.data?.error?.message?.value || 
                               error.response?.data?.error?.message ||
                               'SAP rejected the request due to invalid data';
        
        throw new Error(`SAP API Error: ${sapErrorMessage}`);
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  public async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  public async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" })
  }

  // CRUD Operations for Documents
  public async createDocument<T extends SAPDocument>(
    entityName: string,
    document: Omit<T, "DocEntry" | "DocNum">,
  ): Promise<T> {
    try {
      const result = await this.request<T>(entityName, {
        method: "POST",
        body: JSON.stringify(document),
      })

      logger.info(`Created ${entityName} document:`, result)
      return result
    } catch (error) {
      logger.error(`Error creating ${entityName}:`, error)
      throw error
    }
  }

  public async getDocument<T extends SAPDocument>(
    entityName: string,
    docEntry: number,
    options?: QueryOptions,
  ): Promise<T> {
    try {
      let endpoint = `${entityName}(${docEntry})`

      if (options) {
        const params = new URLSearchParams()
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value.toString())
          }
        })

        if (params.toString()) {
          endpoint += `?${params.toString()}`
        }
      }

      const result = await this.request<T>(endpoint)
      return result
    } catch (error) {
      logger.error(`Error getting ${entityName} ${docEntry}:`, error)
      throw error
    }
  }

  public async getDocuments<T extends SAPDocument>(
    entityName: string,
    options?: QueryOptions,
  ): Promise<{ value: T[] }> {
    try {
      let endpoint = entityName

      if (options) {
        const params = new URLSearchParams()
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value.toString())
          }
        })

        if (params.toString()) {
          endpoint += `?${params.toString()}`
        }
      }

      const result = await this.request<{ value: T[] }>(endpoint)
      return result
    } catch (error) {
      logger.error(`Error getting ${entityName} list:`, error)
      throw error
    }
  }

  // Count methods for proper pagination
  public async getDocumentCount(
    entityName: string,
    filter?: string
  ): Promise<number> {
    try {
      const options: QueryOptions = {
        $select: "DocEntry",
        $top: 1000000, // Large number to get all records for counting
      }

      if (filter) {
        options.$filter = filter
      }

      const result = await this.getDocuments(entityName, options)
      return result.value?.length || 0
    } catch (error) {
      logger.error(`Error getting ${entityName} count:`, error)
      // Fallback: try with smaller batches
      return await this.getDocumentCountWithBatching(entityName, filter)
    }
  }

  private async getDocumentCountWithBatching(
    entityName: string,
    filter?: string,
    batchSize: number = 1000
  ): Promise<number> {
    try {
      let totalCount = 0
      let skip = 0
      let hasMore = true

      while (hasMore) {
        const options: QueryOptions = {
          $select: "DocEntry",
          $top: batchSize,
          $skip: skip,
        }

        if (filter) {
          options.$filter = filter
        }

        const result = await this.getDocuments(entityName, options)
        const batchCount = result.value?.length || 0
        totalCount += batchCount

        hasMore = batchCount === batchSize
        skip += batchSize
      }

      return totalCount
    } catch (error) {
      logger.error(`Error getting ${entityName} count with batching:`, error)
      return 0
    }
  }

  public async getMasterDataCount(entityName: string, filter?: string): Promise<number> {
    try {
      const options: QueryOptions = {
        $select: "Code",
        $top: 1000000, // Large number to get all records for counting
      }

      if (filter) {
        options.$filter = filter
      }

      let endpoint = entityName
      if (options) {
        const params = new URLSearchParams()
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value.toString())
          }
        })

        if (params.toString()) {
          endpoint += `?${params.toString()}`
        }
      }

      const result = await this.request<{ value: any[] }>(endpoint)
      return result.value?.length || 0
    } catch (error) {
      logger.error(`Error getting ${entityName} count:`, error)
      return 0
    }
  }

  public async updateDocument<T extends SAPDocument>(
    entityName: string,
    docEntry: number,
    updates: Partial<T>,
  ): Promise<void> {
    try {
      await this.request(`${entityName}(${docEntry})`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })

      logger.info(`Updated ${entityName} ${docEntry}`)
    } catch (error) {
      logger.error(`Error updating ${entityName} ${docEntry}:`, error)
      throw error
    }
  }

  public async updateBusinessPartner(
    cardCode: string,
    updates: any,
  ): Promise<void> {
    try {
      await this.request(`BusinessPartners('${cardCode}')`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })

      logger.info(`Updated BusinessPartner ${cardCode}`)
    } catch (error) {
      logger.error(`Error updating BusinessPartner ${cardCode}:`, error)
      throw error
    }
  }

  public async createBusinessPartner(businessPartner: any): Promise<any> {
    try {
      const result = await this.request<any>("BusinessPartners", {
        method: "POST",
        body: JSON.stringify(businessPartner),
      })

      logger.info(`Created BusinessPartner ${businessPartner.CardCode}`)
      return result
    } catch (error) {
      logger.error(`Error creating BusinessPartner:`, error)
      throw error
    }
  }

  public async deleteBusinessPartner(cardCode: string): Promise<void> {
    try {
      await this.request(`BusinessPartners('${cardCode}')`, {
        method: "DELETE",
      })

      logger.info(`Deleted BusinessPartner ${cardCode}`)
    } catch (error) {
      logger.error(`Error deleting BusinessPartner ${cardCode}:`, error)
      throw error
    }
  }

  // Item Management Methods
  public async createItem(item: any): Promise<any> {
    try {
      const result = await this.request<any>("Items", {
        method: "POST",
        body: JSON.stringify(item),
      })

      logger.info(`Created Item ${item.ItemCode}`)
      return result
    } catch (error) {
      logger.error(`Error creating Item:`, error)
      throw error
    }
  }

  public async updateItem(itemCode: string, updates: any): Promise<void> {
    try {
      await this.request(`Items('${itemCode}')`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })

      logger.info(`Updated Item ${itemCode}`)
    } catch (error) {
      logger.error(`Error updating Item ${itemCode}:`, error)
      throw error
    }
  }

  public async deleteItem(itemCode: string): Promise<void> {
    try {
      await this.request(`Items('${itemCode}')`, {
        method: "DELETE",
      })

      logger.info(`Deleted Item ${itemCode}`)
    } catch (error) {
      logger.error(`Error deleting Item ${itemCode}:`, error)
      throw error
    }
  }

  public async deleteDocument(entityName: string, docEntry: number): Promise<void> {
    try {
      await this.request(`${entityName}(${docEntry})`, {
        method: "DELETE",
      })

      logger.info(`Deleted ${entityName} ${docEntry}`)
    } catch (error) {
      logger.error(`Error deleting ${entityName} ${docEntry}:`, error)
      throw error
    }
  }

  // Master Data Operations
  public async getBusinessPartners(options?: QueryOptions) {
    return this.request<{ value: any[] }>(`BusinessPartners${this.buildQueryString(options)}`)
  }

  public async getItems(options?: QueryOptions) {
    return this.request<{ value: any[] }>(`Items${this.buildQueryString(options)}`)
  }

  public async getWarehouses(options?: QueryOptions) {
    return this.request<{ value: any[] }>(`Warehouses${this.buildQueryString(options)}`)
  }

  public async getSalesPersons(options?: QueryOptions) {
    return this.request<{ value: any[] }>(`SalesPersons${this.buildQueryString(options)}`)
  }

  public async getPaymentTermsTypes(options?: QueryOptions) {
    return this.request<{ value: any[] }>(`PaymentTermsTypes${this.buildQueryString(options)}`)
  }

  // Document Flow Operations
  public async copyDocumentTo<T extends SAPDocument>(
    sourceEntity: string,
    sourceDocEntry: number,
    targetEntity: string,
    additionalData?: Partial<T>,
  ): Promise<T> {
    try {
      // First, get the source document
      const sourceDoc = await this.getDocument(sourceEntity, sourceDocEntry)

      // Prepare the target document by copying relevant fields
      const targetDoc: any = {
        CardCode: sourceDoc.CardCode,
        DocDate: new Date().toISOString().split("T")[0],
        Comments: sourceDoc.Comments,
        SalesPersonCode: sourceDoc.SalesPersonCode,
        PaymentGroupCode: sourceDoc.PaymentGroupCode,
        DocumentLines: sourceDoc.DocumentLines.map((line: DocumentLine) => ({
          ItemCode: line.ItemCode,
          ItemDescription: line.ItemDescription,
          Quantity: line.Quantity,
          UnitPrice: line.UnitPrice,
          WarehouseCode: line.WarehouseCode,
          TaxCode: line.TaxCode,
          DiscountPercent: line.DiscountPercent,
          BaseEntry: sourceDocEntry,
          BaseType: this.getBaseType(sourceEntity),
          BaseLine: line.LineNum,
        })),
        ...additionalData,
      }

      // Create the new document
      return await this.createDocument(targetEntity, targetDoc)
    } catch (error) {
      logger.error(`Error copying from ${sourceEntity} to ${targetEntity}:`, error)
      throw error
    }
  }

  // Utility Methods
  private buildQueryString(options?: QueryOptions): string {
    if (!options) return ""

    const params = new URLSearchParams()
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString())
      }
    })

    return params.toString() ? `?${params.toString()}` : ""
  }

  private getBaseType(entityName: string): number {
    // SAP B1 BaseType mapping
    const baseTypeMap: Record<string, number> = {
      Quotations: 23,
      Orders: 17,
      DeliveryNotes: 15,
      Returns: 16,
      Invoices: 13,
      CreditNotes: 14,
      PurchaseQuotations: 540000006,
      PurchaseOrders: 22,
      PurchaseDeliveryNotes: 20,
      PurchaseReturns: 21,
      PurchaseInvoices: 18,
      PurchaseCreditNotes: 19,
    }

    return baseTypeMap[entityName] || 0
  }

  public async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Try to login first
      if (!this.session) {
        await this.login(this.config);
      }
      
      // Then try to get company info as a test
      const result = await this.get('CompanyInfo');
      
      return {
        success: true,
        message: `Successfully connected to SAP B1 company: ${result.CompanyName || 'Unknown'}`,
        details: {
          companyName: result.CompanyName,
          dbServerType: result.DbServerType,
          version: result.Version
        }
      };
    } catch (error: any) {
      logger.error('SAP connection test failed:', error);
      
      return {
        success: false,
        message: `Connection failed: ${error.message || 'Unknown error'}`,
        details: {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        }
      };
    }
  }
}

export const sapService = SAPServiceLayer.getInstance();
