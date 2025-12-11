'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    title?: string;
    description?: string;
    itemName?: string;
    confirmText?: string;
    cancelText?: string;
}

export function DeleteConfirmModal({
    open,
    onClose,
    onConfirm,
    title = 'Confirm Delete',
    description,
    itemName,
    confirmText = 'Delete',
    cancelText = 'Cancel',
}: DeleteConfirmModalProps) {
    const [deleting, setDeleting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset deleting state when modal closes
    useEffect(() => {
        if (!open) {
            setDeleting(false);
        }
    }, [open]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open && !deleting) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onClose, deleting]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    const handleConfirm = async () => {
        setDeleting(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            // Error is handled by the parent component
            setDeleting(false);
        }
    };

    if (!open || !mounted) return null;

    const defaultDescription = itemName
        ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
        : 'Are you sure you want to delete this? This action cannot be undone.';

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={deleting ? undefined : onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-600">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-sm text-muted-foreground">
                        {description || defaultDescription}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-4 pt-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                        disabled={deleting}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirm}
                        className="flex-1"
                        disabled={deleting}
                    >
                        {deleting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            confirmText
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
