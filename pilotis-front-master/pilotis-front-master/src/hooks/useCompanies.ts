import { useState, useEffect } from 'react';
import { getConversionRate, type Company, type Period, type FilterParams } from '../services/companiesService';

/**
 * Fetches company conversion stats for the given filters.
 * Re-fetches automatically whenever `filters` reference changes
 * (compare by JSON serialisation to avoid re-renders on identical values).
 */
export function useCompanies(filters?: FilterParams) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [period, setPeriod] = useState<Period | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Stable dep: re-fetch only when filter values actually change
    const filtersKey = JSON.stringify(filters ?? {});

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError(null);

        getConversionRate(filters)
            .then(({ companies, period }) => {
                if (!cancelled) {
                    setCompanies(companies);
                    setPeriod(period);
                }
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        // Cancel stale requests when filters change quickly
        return () => { cancelled = true; };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersKey]);

    return { companies, period, loading, error };
}
