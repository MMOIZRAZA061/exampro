import { useCallback, useEffect, useRef, useState } from "react";
import api from "./api";

export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fnRef = useRef(fn);
    fnRef.current = fn;

    const run = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fnRef.current();
            setData(result);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }, deps);

    useEffect(() => {
        run();
    }, [run]);

    return { data, loading, error, refresh: run, setData };
}

export function useDebounce(value: string, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

export function useForm<T extends Record<string, any>>(initial: T) {
    const [values, setValues] = useState<T>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const set = (field: keyof T, value: any) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: "" }));
    };

    const setAll = (next: T) => setValues(next);

    return { values, set, setAll, errors, setErrors, reset: () => setValues(initial) };
}

export function formatDateStr(date: string | null | undefined) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString();
}

export function formatDateTimeStr(date: string | null | undefined) {
    if (!date) return "—";
    return new Date(date).toLocaleString();
}
