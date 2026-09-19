import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
    BookMarked,
    Plus,
    Trash2,
    Pencil,
    ListChecks,
    Upload,
    FileText,
    X,
    Check,
    AlertCircle,
} from "lucide-react";
import {
    LoadingSpinner,
    EmptyState,
    Modal,
    StatusBadge,
    ConfirmDialog,
    formatDate,
    useToast,
} from "../../components/ui";
import { teacher } from "../../services/api";

const QUESTION_TYPES = [
    { value: "short_answer", label: "Short Answer" },
    { value: "long_answer", label: "Long Answer" },
    { value: "mcq", label: "MCQ (Multiple Choice)" },
    { value: "multi_choice", label: "Multi Choice" },
    { value: "true_false", label: "True / False" },
    { value: "fill_blank", label: "Fill in the Blank" },
];

const DIFFICULTIES = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
];

export default function TeacherQuestionBanks() {
    const [banks, setBanks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ name: "", subject: "", description: "" });

    const navigate = useNavigate();
    const { showToast } = useToast();

    // Import state
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importFileContent, setImportFileContent] = useState<string>("");
    const [importBankId, setImportBankId] = useState("");
    const [importNewBank, setImportNewBank] = useState(false);
    const [importNewBankName, setImportNewBankName] = useState("");
    const [importNewBankSubject, setImportNewBankSubject] = useState("");
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        bank: any;
        imported: number;
        skipped: number;
        errors: { question: string; reason: string }[];
    } | null>(null);

    // GUI question metadata
    const [qType, setQType] = useState("short_answer");
    const [qDifficulty, setQDifficulty] = useState("medium");
    const [qMarks, setQMarks] = useState("1");
    const [qOptions, setQOptions] = useState("");
    const [qCorrectAnswer, setQCorrectAnswer] = useState("");
    const [qExplanation, setQExplanation] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadBanks();
    }, []);

    const loadBanks = async () => {
        setLoading(true);
        try {
            const res = await teacher.questionBanks();
            setBanks(res.data);
        } catch {
            showToast("Failed to load question banks", "error");
        } finally {
            setLoading(false);
        }
    };

    const openEdit = (bank: any) => {
        setForm({
            name: bank.name,
            subject: bank.subject || "",
            description: bank.description || "",
        });
        setEditTarget(bank);
    };

    const handleSave = async () => {
        if (!form.name) {
            showToast("Bank name is required", "error");
            return;
        }
        setSubmitting(true);
        try {
            if (editTarget) {
                await teacher.updateQuestionBank(editTarget.id, form);
                showToast("Question bank updated");
                setEditTarget(null);
            } else {
                await teacher.createQuestionBank(form);
                showToast("Question bank created");
            }
            setShowCreate(false);
            setForm({ name: "", subject: "", description: "" });
            loadBanks();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to save bank", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSubmitting(true);
        try {
            await teacher.deleteQuestionBank(deleteTarget.id);
            showToast("Question bank deleted");
            setDeleteTarget(null);
            loadBanks();
        } catch (err: any) {
            showToast(err.response?.data?.error || "Failed to delete bank", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // Import handlers
    const handleOpenImport = () => {
        setImportFile(null);
        setImportFileContent("");
        setImportBankId("");
        setImportNewBank(false);
        setImportNewBankName("");
        setImportNewBankSubject("");
        setImportResult(null);
        setQType("short_answer");
        setQDifficulty("medium");
        setQMarks("1");
        setQOptions("");
        setQCorrectAnswer("");
        setQExplanation("");
        setShowImport(true);
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!/\.txt$/i.test(file.name)) {
            showToast("Please select a .txt file", "error");
            return;
        }
        setImportFile(file);
        const reader = new FileReader();
        reader.onload = () => {
            setImportFileContent((reader.result as string) || "");
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!importFile || !importFileContent) {
            showToast("Please select a .txt file", "error");
            return;
        }
        const targetBankId = importNewBank ? undefined : importBankId;
        if (!importNewBank && !targetBankId) {
            showToast("Please select a target question bank", "error");
            return;
        }
        setImporting(true);
        try {
            const options =
                qOptions.trim()
                    ? qOptions
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean)
                        .map((l) => {
                            const m = /^([A-Ha-h])[\.\)]\s*(.*)$/.exec(l);
                            return m
                                ? { label: m[1].toUpperCase(), text: m[2] }
                                : { label: "", text: l };
                        })
                    : undefined;
            const res = await teacher.importQuestionBank({
                fileContent: importFileContent,
                fileName: importFile.name,
                bankId: targetBankId,
                name: importNewBank ? importNewBankName || undefined : undefined,
                subject: importNewBank ? importNewBankSubject || undefined : undefined,
                questionType: qType,
                difficulty: qDifficulty,
                marks: Number(qMarks),
                options,
                correctAnswer: qCorrectAnswer.trim() || undefined,
                explanation: qExplanation.trim() || undefined,
            });
            const data: any = res.data;
            setImportResult(data);
            showToast(
                `Imported ${data.imported} question(s)${data.skipped ? `, skipped ${data.skipped}` : ""}`,
                "success"
            );
            loadBanks();
        } catch (err: any) {
            showToast(err.response?.data?.message || "Import failed", "error");
        } finally {
            setImporting(false);
        }
    };

    const handleCloseImport = () => {
        setShowImport(false);
        setImportFile(null);
        setImportFileContent("");
        setImportResult(null);
    };

    const sampleFormat = `What is the capital of Pakistan?
What is 12 × 8?
The process by which plants make food is called photosynthesis.
What is the boiling point of water?`;

    const previewLines =
        importFileContent
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !/^([A-Ha-h])[\.\)]\s/.test(l))
            .slice(0, 200) || [];

    return (
        <DashboardLayout activeSection="Question Banks">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Question Banks</h2>
                    <p className="text-sm text-gray-500">Organize questions into banks</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleOpenImport} className="btn-primary">
                        <Upload size={18} /> Import from .txt
                    </button>
                    <button
                        onClick={() => {
                            setShowCreate(true);
                            setEditTarget(null);
                            setForm({ name: "", subject: "", description: "" });
                        }}
                        className="btn-secondary"
                    >
                        <Plus size={18} /> New Bank
                    </button>
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="Loading banks..." />
            ) : banks.length === 0 ? (
                <EmptyState
                    icon={<BookMarked size={40} />}
                    title="No question banks"
                    description="Create a question bank to start adding questions."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {banks.map((b) => (
                        <div key={b.id} className="card">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{b.name}</h3>
                                    <p className="text-sm text-gray-500">{b.subject || "No subject"}</p>
                                </div>
                                <span className="badge badge-info">{b.question_count} questions</span>
                            </div>
                            {b.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{b.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mb-4">Created {formatDate(b.created_at)}</p>
                            <div className="flex gap-2">
                                <button
                                    className="btn-secondary text-xs flex-1"
                                    onClick={() => navigate(`/teacher/questions?bankId=${b.id}`)}
                                >
                                    <ListChecks size={14} /> Questions
                                </button>
                                <button
                                    className="btn-secondary text-xs !px-2 !py-1"
                                    onClick={() => openEdit(b)}
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    className="btn-danger text-xs !px-2 !py-1"
                                    onClick={() => setDeleteTarget(b)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                title={editTarget ? "Edit Question Bank" : "Create Question Bank"}
            >
                <div className="space-y-3">
                    <div>
                        <label className="label">Name *</label>
                        <input
                            className="input"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">Subject</label>
                        <input
                            className="input"
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">Description</label>
                        <textarea
                            className="input"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                setShowCreate(false);
                                setEditTarget(null);
                            }}
                        >
                            Cancel
                        </button>
                        <button className="btn-primary" onClick={handleSave} disabled={submitting}>
                            {submitting ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete question bank"
                message={`Delete "${deleteTarget?.name}"? This also removes its questions.`}
                confirmText="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                loading={submitting}
            />

            {/* Import modal */}
            <Modal
                open={showImport}
                onClose={handleCloseImport}
                title="Import Question Bank from .txt"
            >
                <div className="space-y-4">
                    {/* File picker */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            .txt File <span className="text-red-500">*</span>{" "}
                            <span className="text-gray-400">(one question per line)</span>
                        </label>
                        <div
                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${importFile
                                ? "border-indigo-400 bg-indigo-50"
                                : "border-gray-300 hover:border-indigo-400"
                                }`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt"
                                onChange={handleFileSelected}
                                className="hidden"
                            />
                            {importFile ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText size={16} className="text-indigo-600" />
                                    <span className="text-sm text-indigo-700">{importFile.name}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCloseImport();
                                        }}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500">
                                    Click to select a .txt file with questions
                                </div>
                            )}
                        </div>
                        {importFileContent && (
                            <div className="mt-2">
                                <p className="text-xs text-gray-500 mb-1">
                                    {previewLines.length} question line(s) detected
                                </p>
                                <pre className="text-xs bg-gray-50 border rounded-lg p-3 max-h-28 overflow-y-auto whitespace-pre-wrap">
                                    {previewLines.slice(0, 10).join("\n")}
                                    {previewLines.length > 10 ? "\n…" : ""}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* GUI metadata */}
                    <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
                        <p className="text-xs font-semibold text-gray-700">
                            Question Settings <span className="text-gray-400 font-normal">(applies to all imported questions)</span>
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Question Type *</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={qType}
                                    onChange={(e) => setQType(e.target.value)}
                                >
                                    {QUESTION_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={qDifficulty}
                                    onChange={(e) => setQDifficulty(e.target.value)}
                                >
                                    {DIFFICULTIES.map((d) => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Marks Per Question</label>
                                <input
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    type="number"
                                    min="1"
                                    value={qMarks}
                                    onChange={(e) => setQMarks(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    {qType === "mcq" ? "Correct Answer (letter)" :
                                        qType === "true_false" ? "Correct Answer" :
                                            qType === "multi_choice" ? "Correct Answer (letter)" :
                                                "Correct Answer (text)"}
                                </label>
                                {qType === "true_false" ? (
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        value={qCorrectAnswer}
                                        onChange={(e) => setQCorrectAnswer(e.target.value)}
                                    >
                                        <option value="">Select...</option>
                                        <option value="TRUE">True</option>
                                        <option value="FALSE">False</option>
                                    </select>
                                ) : qType === "mcq" || qType === "multi_choice" ? (
                                    <input
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. A, B, C (comma separated)"
                                        value={qCorrectAnswer}
                                        onChange={(e) => setQCorrectAnswer(e.target.value)}
                                    />
                                ) : (
                                    <input
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Correct answer (optional)"
                                        value={qCorrectAnswer}
                                        onChange={(e) => setQCorrectAnswer(e.target.value)}
                                    />
                                )}
                            </div>
                        </div>

                        {(qType === "mcq" || qType === "multi_choice") && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Options (one per line: A) ... B) ... C) ... D) ...
                                </label>
                                <textarea
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                                    placeholder={"A) Option 1\nB) Option 2\nC) Option 3\nD) Option 4"}
                                    value={qOptions}
                                    onChange={(e) => setQOptions(e.target.value)}
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Or include options in the .txt file under each question:
                                    <pre className="text-[11px] bg-white border rounded p-1.5 mt-1">
                                        {`What is the capital of Pakistan?
A) Islamabad
B) Lahore
C) Karachi
D) Peshawar`}
                                    </pre>
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Explanation (optional)</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Explanation for all imported questions"
                                value={qExplanation}
                                onChange={(e) => setQExplanation(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Target selection */}
                    {importFile && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">
                                Import Into
                            </label>
                            <div className="flex gap-2 mb-2">
                                <label className="flex items-center gap-1.5 text-sm">
                                    <input
                                        type="radio"
                                        checked={!importNewBank}
                                        onChange={() => setImportNewBank(false)}
                                        className="text-indigo-600"
                                    />
                                    Existing Bank
                                </label>
                                <label className="flex items-center gap-1.5 text-sm">
                                    <input
                                        type="radio"
                                        checked={importNewBank}
                                        onChange={() => setImportNewBank(true)}
                                        className="text-indigo-600"
                                    />
                                    New Bank
                                </label>
                            </div>
                            {!importNewBank ? (
                                <select
                                    value={importBankId}
                                    onChange={(e) => setImportBankId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select a bank...</option>
                                    {banks.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                            {b.subject ? ` (${b.subject})` : ""}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="New bank name"
                                        value={importNewBankName}
                                        onChange={(e) => setImportNewBankName(e.target.value)}
                                    />
                                    <input
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Subject (optional)"
                                        value={importNewBankSubject}
                                        onChange={(e) => setImportNewBankSubject(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Import result */}
                    {importResult && (
                        <div className="space-y-2">
                            <div
                                className={`p-3 rounded-lg text-sm ${importResult.errors.length === 0
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Check size={14} />
                                    <span>
                                        Imported <strong>{importResult.imported}</strong> question(s) into{" "}
                                        <strong>{importResult.bank?.name}</strong>
                                    </span>
                                </div>
                                {importResult.skipped > 0 && (
                                    <p className="text-xs">
                                        Skipped {importResult.skipped} question(s)
                                    </p>
                                )}
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="max-h-40 overflow-y-auto border border-red-200 rounded-lg p-3">
                                    <p className="text-xs font-medium text-red-600 mb-2">
                                        {importResult.errors.length} error(s):
                                    </p>
                                    <ul className="space-y-1">
                                        {importResult.errors.map((e: any, i: number) => (
                                            <li key={i} className="text-xs text-red-600 flex gap-1">
                                                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                                <span>
                                                    {e.question}: {e.reason}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button className="btn-secondary" onClick={handleCloseImport}>
                            Cancel
                        </button>
                        {importFile && (
                            <button
                                className="btn-primary"
                                onClick={handleImport}
                                disabled={
                                    importing ||
                                    (!importNewBank && !importBankId)
                                }
                            >
                                {importing ? "Importing..." : "Import Now"}
                            </button>
                        )}
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
