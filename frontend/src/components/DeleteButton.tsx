'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { Trash2 } from 'lucide-react';

interface DeleteButtonProps {
    onDelete: () => Promise<void> | void;
    itemName?: string;
    title?: string;
    description?: string;
    confirmText?: string;
    /** 
     * 'icon' - Icon only button (for list items)
     * 'full' - Full button with text (for detail pages)
     */
    variant?: 'icon' | 'full';
    /** Size of the button - defaults to 'icon' for icon variant, undefined for full */
    size?: 'sm' | 'default' | 'lg' | 'icon';
    /** Additional classes to apply */
    className?: string;
    /** Disable the button */
    disabled?: boolean;
}

export function DeleteButton({
    onDelete,
    itemName,
    title,
    description,
    confirmText,
    variant = 'icon',
    size,
    className = '',
    disabled = false,
}: DeleteButtonProps) {
    const [showModal, setShowModal] = useState(false);

    const handleDelete = async () => {
        await onDelete();
    };

    if (variant === 'full') {
        return (
            <>
                <Button
                    variant="destructive"
                    size={size}
                    onClick={() => setShowModal(true)}
                    disabled={disabled}
                    className={className}
                >
                    Delete
                </Button>
                <DeleteConfirmModal
                    open={showModal}
                    onClose={() => setShowModal(false)}
                    onConfirm={handleDelete}
                    title={title}
                    description={description}
                    itemName={itemName}
                    confirmText={confirmText}
                />
            </>
        );
    }

    // Icon variant (default)
    return (
        <>
            <Button
                variant="ghost"
                size={size || 'icon'}
                onClick={() => setShowModal(true)}
                disabled={disabled}
                className={`text-destructive hover:text-destructive hover:bg-destructive/10 ${className}`}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
            <DeleteConfirmModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onConfirm={handleDelete}
                title={title}
                description={description}
                itemName={itemName}
                confirmText={confirmText}
            />
        </>
    );
}
