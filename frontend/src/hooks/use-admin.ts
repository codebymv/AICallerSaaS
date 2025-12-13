'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface UseAdminResult {
    isAdmin: boolean;
    isLoading: boolean;
}

/**
 * Hook to check if the current user has admin role.
 * Returns isAdmin status and loading state.
 */
export function useAdmin(): UseAdminResult {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const response = await api.getMe();
                // Check role from API response
                setIsAdmin(response.data?.role === 'ADMIN');
            } catch (error) {
                setIsAdmin(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAdmin();
    }, []);

    return { isAdmin, isLoading };
}

export default useAdmin;
