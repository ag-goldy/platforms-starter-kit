'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
}

/**
 * Performance monitoring hook
 * Tracks key web vitals and loading metrics
 */
export function usePerformanceMonitor(enabled: boolean = true) {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});
  
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    
    // Page load time
    const measurePageLoad = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        setMetrics(prev => ({
          ...prev,
          pageLoadTime: navigation.loadEventEnd - navigation.startTime,
        }));
      }
    };
    
    // First Contentful Paint
    const measureFCP = () => {
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcpEntry) {
        setMetrics(prev => ({
          ...prev,
          firstContentfulPaint: fcpEntry.startTime,
        }));
      }
    };
    
    // Largest Contentful Paint
    let lcpObserver: PerformanceObserver;
    if ('PerformanceObserver' in window) {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        setMetrics(prev => ({
          ...prev,
          largestContentfulPaint: lastEntry.startTime,
        }));
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    }
    
    // Wait for load to complete
    if (document.readyState === 'complete') {
      measurePageLoad();
      measureFCP();
    } else {
      window.addEventListener('load', () => {
        setTimeout(measurePageLoad, 0);
        setTimeout(measureFCP, 0);
      });
    }
    
    return () => {
      lcpObserver?.disconnect();
    };
  }, [enabled]);
  
  return metrics;
}

/**
 * Development-only performance indicator
 */
export function PerformanceIndicator() {
  const [isVisible, setIsVisible] = useState(false);
  const metrics = usePerformanceMonitor(process.env.NODE_ENV === 'development');
  
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    // Show indicator on Shift+P
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  if (!isVisible || Object.keys(metrics).length === 0) return null;
  
  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-sm font-mono z-50 shadow-lg">
      <div className="font-bold mb-2">Performance Metrics</div>
      {metrics.pageLoadTime && (
        <div>Page Load: {metrics.pageLoadTime.toFixed(0)}ms</div>
      )}
      {metrics.firstContentfulPaint && (
        <div>FCP: {metrics.firstContentfulPaint.toFixed(0)}ms</div>
      )}
      {metrics.largestContentfulPaint && (
        <div>LCP: {metrics.largestContentfulPaint.toFixed(0)}ms</div>
      )}
      <div className="text-gray-400 text-xs mt-2">Press Shift+P to toggle</div>
    </div>
  );
}

/**
 * Log performance metrics to console
 */
export function logPerformanceMetrics() {
  if (typeof window === 'undefined') return;
  
  setTimeout(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      console.log('[Performance] Page Load Metrics:', {
        DNS: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
        TCP: Math.round(navigation.connectEnd - navigation.connectStart),
        TTFB: Math.round(navigation.responseStart - navigation.requestStart),
        DOM: Math.round(navigation.domContentLoadedEventEnd - navigation.responseEnd),
        Total: Math.round(navigation.loadEventEnd - navigation.startTime),
      });
    }
  }, 0);
}
