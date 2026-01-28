import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Running in offline mode.');
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 5 // Reduced from 10 for better performance
      }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');
};

// Payload type for real-time changes
export interface RealtimePayload<T> {
  new: T;
  old: T;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

// Throttled subscription helper - batches updates and throttles callbacks
export const subscribeToTableThrottled = <T>(
  table: string,
  callback: (payloads: RealtimePayload<T>[]) => void,
  throttleMs: number = 2000 // Default 2 second throttle
): RealtimeChannel => {
  let pendingPayloads: RealtimePayload<T>[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;

  const flush = () => {
    if (pendingPayloads.length > 0) {
      const payloadsToSend = [...pendingPayloads];
      pendingPayloads = [];
      lastCallTime = Date.now();
      callback(payloadsToSend);
    }
    timeoutId = null;
  };

  return supabase
    .channel(`${table}_changes_throttled`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        pendingPayloads.push({
          new: payload.new as T,
          old: payload.old as T,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        });

        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;

        // If enough time has passed, flush immediately
        if (timeSinceLastCall >= throttleMs) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          flush();
        } else if (!timeoutId) {
          // Schedule a flush for later
          timeoutId = setTimeout(flush, throttleMs - timeSinceLastCall);
        }
      }
    )
    .subscribe();
};

// Legacy non-throttled subscription (kept for backward compatibility)
export const subscribeToTable = <T>(
  table: string,
  callback: (payload: RealtimePayload<T>) => void
): RealtimeChannel => {
  return supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        callback({
          new: payload.new as T,
          old: payload.old as T,
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'
        });
      }
    )
    .subscribe();
};

// Utility for generating UUIDs
export const generateId = (): string => {
  return crypto.randomUUID();
};

// ============ CONNECTION QUALITY MONITORING ============

export type ConnectionQuality = 'excellent' | 'good' | 'slow' | 'poor' | 'offline';

interface ConnectionState {
  quality: ConnectionQuality;
  latencyMs: number;
  lastCheck: number;
  isOnline: boolean;
}

let connectionState: ConnectionState = {
  quality: 'good',
  latencyMs: 0,
  lastCheck: 0,
  isOnline: navigator?.onLine ?? true
};

// Listeners for connection state changes
type ConnectionListener = (state: ConnectionState) => void;
const connectionListeners: Set<ConnectionListener> = new Set();

export const subscribeToConnectionState = (listener: ConnectionListener): (() => void) => {
  connectionListeners.add(listener);
  // Immediately notify with current state
  listener(connectionState);
  return () => connectionListeners.delete(listener);
};

const notifyConnectionChange = () => {
  connectionListeners.forEach(listener => listener(connectionState));
};

// Determine quality based on latency
const getQualityFromLatency = (latencyMs: number): ConnectionQuality => {
  if (!navigator.onLine) return 'offline';
  if (latencyMs < 300) return 'excellent';
  if (latencyMs < 800) return 'good';
  if (latencyMs < 2000) return 'slow';
  return 'poor';
};

// Check connection quality by measuring a lightweight request
export const checkConnectionQuality = async (): Promise<ConnectionState> => {
  if (!navigator.onLine) {
    connectionState = {
      quality: 'offline',
      latencyMs: 0,
      lastCheck: Date.now(),
      isOnline: false
    };
    notifyConnectionChange();
    return connectionState;
  }

  if (!isSupabaseConfigured()) {
    connectionState = {
      quality: 'good',
      latencyMs: 0,
      lastCheck: Date.now(),
      isOnline: true
    };
    return connectionState;
  }

  const startTime = performance.now();
  
  try {
    // Use a minimal query to test connection (just count, no data)
    await supabase.from('categories').select('id', { count: 'exact', head: true });
    
    const latencyMs = performance.now() - startTime;
    
    connectionState = {
      quality: getQualityFromLatency(latencyMs),
      latencyMs: Math.round(latencyMs),
      lastCheck: Date.now(),
      isOnline: true
    };
  } catch {
    connectionState = {
      quality: 'poor',
      latencyMs: 10000, // Assume very high latency on error
      lastCheck: Date.now(),
      isOnline: navigator.onLine
    };
  }
  
  notifyConnectionChange();
  return connectionState;
};

// Get current connection state without making a new request
export const getConnectionState = (): ConnectionState => connectionState;

// Set up automatic connection monitoring with adaptive frequency
let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
let consecutiveGoodChecks = 0;
const INITIAL_CHECK_INTERVAL = 30000; // 30 seconds
const SLOW_CHECK_INTERVAL = 60000; // 60 seconds after stable connection

// Store event listener references for proper cleanup (prevents memory leaks)
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;
let isMonitoringStarted = false;

const scheduleNextCheck = () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  
  // Use slower interval after 5 consecutive good checks
  const interval = consecutiveGoodChecks >= 5 ? SLOW_CHECK_INTERVAL : INITIAL_CHECK_INTERVAL;
  connectionCheckInterval = setInterval(async () => {
    await checkConnectionQuality();
    // Track consecutive good checks
    if (connectionState.quality === 'excellent' || connectionState.quality === 'good') {
      consecutiveGoodChecks++;
      // Switch to slower interval if we've been stable
      if (consecutiveGoodChecks === 5) {
        scheduleNextCheck();
      }
    } else {
      // Reset counter on poor connection and switch back to frequent checks
      if (consecutiveGoodChecks >= 5) {
        consecutiveGoodChecks = 0;
        scheduleNextCheck();
      } else {
        consecutiveGoodChecks = 0;
      }
    }
  }, interval);
};

export const startConnectionMonitoring = (_intervalMs: number = 30000) => {
  // Prevent duplicate initialization (memory leak prevention)
  if (isMonitoringStarted) return;
  isMonitoringStarted = true;
  
  // Initial check
  checkConnectionQuality();
  
  // Set up adaptive checking
  scheduleNextCheck();
  
  // Create named handlers for proper cleanup
  onlineHandler = () => {
    connectionState.isOnline = true;
    consecutiveGoodChecks = 0; // Reset on connection change
    checkConnectionQuality();
    scheduleNextCheck();
  };
  
  offlineHandler = () => {
    consecutiveGoodChecks = 0;
    connectionState = {
      quality: 'offline',
      latencyMs: 0,
      lastCheck: Date.now(),
      isOnline: false
    };
    notifyConnectionChange();
  };
  
  // Listen for online/offline events
  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);
};

export const stopConnectionMonitoring = () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
  
  // Remove event listeners to prevent memory leaks
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
  if (offlineHandler) {
    window.removeEventListener('offline', offlineHandler);
    offlineHandler = null;
  }
  
  isMonitoringStarted = false;
  consecutiveGoodChecks = 0;
};
