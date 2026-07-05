import Modal from "./Modal";

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Delete", variant = "danger" }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 text-sm mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className={variant === "danger" ? "btn-danger" : "btn-primary"}
          onClick={() => { onConfirm(); onClose(); }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
