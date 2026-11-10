'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from "sonner";
import { useTranslations } from '@/lib/i18n/hooks';
import type { Locale } from '@/lib/i18n/config';

export interface OracleRecord {
  CSTYPE: string;
  BRANCHE: string;
  COSTCENTER: string;
  BILNG_DATE: string;
  ENTAGTAM: string | number;
  SEWER: string | number;
  TANZEEM: string | number;
  ESTDAMA: string | number;
  CONTRACT: string;
  TAXES: string | number;
  ROUNDING: string | number;
  WATERCREDIT: string | number;
  SEWERCREDIT: string | number;
  WATERDEBIT: string | number;
  SEWERDEBIT: string | number;
  CONSUMP: string | number;
  LINE_ID?: number; // Optional because not all records might have it at all times
}

interface OracleDataContextType {
  data: OracleRecord[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  fetchData: (isManual?: boolean) => Promise<void>;
  clearLocalData: () => void;
  debugLocalStorage: () => { hasData: boolean; hasTimestamp: boolean };
}

interface OracleDataProviderProps {
  children: ReactNode;
  locale?: Locale;
}

const OracleDataContext = createContext<OracleDataContextType | undefined>(undefined);

export const OracleDataProvider = ({ children, locale = 'ar' }: OracleDataProviderProps) => {
  const [data, setData] = useState<OracleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Initialize translations
  const t = useTranslations(locale);

  // Load data from localStorage on initial mount
  useEffect(() => {
    try {
      const storedDataString = localStorage.getItem('oracle_billing_data');
      const storedLastUpdatedString = localStorage.getItem('oracle_billing_last_updated');
      
      if (storedDataString) {
        const storedData = JSON.parse(storedDataString) as OracleRecord[];
        setData(storedData);
        
        if (storedLastUpdatedString) {
          setLastUpdated(new Date(storedLastUpdatedString));
        }
        
        toast.info(t('oracleData.messages.loadedFromStorage'));
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading data from localStorage:', err);
      // Continue with normal data fetching if localStorage fails
    }
  }, []);

  // Save data to localStorage whenever it changes
  const saveToLocalStorage = (newData: OracleRecord[], timestamp: Date) => {
    try {
      localStorage.setItem('oracle_billing_data', JSON.stringify(newData));
      localStorage.setItem('oracle_billing_last_updated', timestamp.toISOString());
    } catch (err) {
      console.error('Error saving to localStorage:', err);
      // Show a warning but don't interrupt the app flow
      toast.warning(t('oracleData.messages.failedToSaveLocally'));
    }
  };

  const fetchData = async (isManual = false) => {
    // If data exists in state and localStorage, and it's not a manual refresh, do nothing
    if (data.length > 0 && !isManual) {
      return;
    }
    
    if (isManual) {
      toast.info(t('oracleData.messages.refreshingData'));
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/oracle-data');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to fetch data');
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      const newData = result.data || [];
      const timestamp = new Date();
      
      setData(newData);
      setLastUpdated(timestamp);
      setError(null);
      
      // Save to localStorage
      saveToLocalStorage(newData, timestamp);
      
      if (isManual) {
        toast.success(t('oracleData.messages.dataRefreshedSuccessfully'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error fetching Oracle data:', errorMessage);
      setError(errorMessage);
      if (isManual) {
        toast.error(t('oracleData.messages.failedToRefreshData').replace('{errorMessage}', errorMessage));
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear local storage data
  const clearLocalData = () => {
    try {
      localStorage.removeItem('oracle_billing_data');
      localStorage.removeItem('oracle_billing_last_updated');
      setData([]);
      setLastUpdated(null);
      toast.success(t('oracleData.messages.dataCleared'));
    } catch (err) {
      toast.error(t('oracleData.messages.failedToClearData'));
      console.error('Error clearing localStorage:', err);
    }
  };

  // Debug function to check localStorage contents
  const debugLocalStorage = () => {
    try {
      const storedDataString = localStorage.getItem('oracle_billing_data');
      const storedLastUpdatedString = localStorage.getItem('oracle_billing_last_updated');
      
      console.log('localStorage debug:');
      console.log('- oracle_billing_data exists:', !!storedDataString);
      if (storedDataString) {
        try {
          const parsedData = JSON.parse(storedDataString);
          console.log('- Data is valid JSON:', true);
          console.log('- Data is array:', Array.isArray(parsedData));
          console.log('- Data length:', Array.isArray(parsedData) ? parsedData.length : 'N/A');
          console.log('- First record sample:', parsedData[0]);
        } catch (e) {
          console.log('- Data is valid JSON:', false);
          console.log('- Parse error:', e);
        }
      }
      
      console.log('- oracle_billing_last_updated exists:', !!storedLastUpdatedString);
      if (storedLastUpdatedString) {
        console.log('- Last updated:', new Date(storedLastUpdatedString).toLocaleString());
      }
      
      return {
        hasData: !!storedDataString,
        hasTimestamp: !!storedLastUpdatedString
      };
    } catch (err) {
      console.error('Error debugging localStorage:', err);
      return { hasData: false, hasTimestamp: false };
    }
  };

  useEffect(() => {
    // If we don't have data from localStorage, fetch it
    if (data.length === 0) {
      fetchData(true);
    }

    // Debug localStorage on initial load
    debugLocalStorage();

    const intervalId = setInterval(() => {
      console.log("Performing hourly data refresh...");
      toast.info(t('oracleData.messages.autoRefreshingData'));
      fetchData(true);
    }, 3600000); // every 1 hour

    return () => clearInterval(intervalId);
  }, []);

  const value = { 
    data, 
    loading, 
    error, 
    lastUpdated, 
    fetchData,
    clearLocalData,
    debugLocalStorage
  };

  return (
    <OracleDataContext.Provider value={value}>
      {children}
    </OracleDataContext.Provider>
  );
};

export const useOracleData = () => {
  const context = useContext(OracleDataContext);
  if (context === undefined) {
    throw new Error('useOracleData must be used within an OracleDataProvider');
  }
  return context;
}; 