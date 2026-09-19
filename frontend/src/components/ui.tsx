import { ReactNode, useState } from "react";

export function StatCard({
    label,
    value,
    icon,
    color = "blue",
}: {
    label: string;
    value: string | number;
    icon?: ReactNode;
    color?: string;
}) {
    const colorClasses: Record<string, string> = {
        blue: "bg-blue-100 text-blue-700",
        green: "bg-green-100 text-green-700",
        red: "bg-red-100 text-red-700",
        yellow: "bg-yellow-100 text-yellow-700",
        purple: "bg-purple-100 text-purple-700",
        gray: "bg-gray-100 text-gray-700",
    };

    return (
        <div className="card flex items-center space-x-4">
            {icon && (
                <div
                    className={`rounded-lg p-3 ${colorClasses[color] || colorClasses.blue}`}
                >
                    {icon}
                </div>
            )}
            <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
            </div>
        </div>
    );
}

export function SearchInput({
    placeholder,
    onSearch,
}: {
    placeholder?: string;
    onSearch: (value: string) => void;
}) {
    const [value, setValue] = useState("");

    return (
        <input
            type="text"
            className="input max-w-md"
            placeholder={placeholder || "Search..."}
            value={value}
            onChange={(e) => {
                setValue(e.target.value);
                onSearch(e.target.value);
            }}
        />
    );
}

export function LoadingSpinner({ text }: { text?: string }) {
    return (
        <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            {text && <p className="text-gray-500">{text}</p>}
        </div>
    );
}

export function EmptyState({
    title,
    description,
    icon,
}: {
    title: string;
    description?: string;
    icon?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            {icon && <div className="text-gray-400 mb-4">{icon}</div>}
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            {description && (
                <p className="mt-1 text-sm text-gray-500 max-w-md">{description}</p>
            )}
        </div>
    );
}

export function Modal({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}

export function Toast({
    message,
    type = "success",
}: {
    message: string;
    type?: "success" | "error" | "info";
}) {
    const colors: Record<string, string> = {
        success: "bg-green-500",
        error: "bg-red-500",
        info: "bg-blue-500",
    };
    return (
        <div
            className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg text-white shadow-lg ${colors[type]}`}
        >
            {message}
        </div>
    );
}

export function useToast() {
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    const showToast = (message: string, type?: "success" | "error" | "info") => {
        setToast({ message, type: type || "success" });
        setTimeout(() => setToast(null), 3000);
    };

    const toastComponent = toast ? (
        <Toast message={toast.message} type={toast.type} />
    ) : null;

    return { showToast, toastComponent };
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmText,
    onConfirm,
    onCancel,
    loading,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}) {
    if (!open) return null;
    return (
        <Modal open={open} onClose={onCancel} title={title}>
            <p className="text-gray-700 mb-4">{message}</p>
            <div className="flex justify-end space-x-2">
                <button className="btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
                <button
                    className="btn-danger"
                    onClick={onConfirm}
                    disabled={loading}
                >
                    {loading ? "Processing..." : confirmText || "Confirm"}
                </button>
            </div>
        </Modal>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        active: "badge-success",
        inactive: "badge-neutral",
        suspended: "badge-danger",
        draft: "badge-neutral",
        scheduled: "badge-info",
        completed: "badge-success",
        published: "badge-success",
        archived: "badge-neutral",
        submitted: "badge-info",
        auto_submitted: "badge-warning",
        marking: "badge-warning",
        in_progress: "badge-info",
        not_started: "badge-neutral",
    };
    const cls = map[status] || "badge-neutral";
    return (
        <span className={`${cls} capitalize`}>{status.replace("_", " ")}</span>
    );
}

export function formatDate(date: string | undefined | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function formatDateTime(date: string | undefined | null) {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
