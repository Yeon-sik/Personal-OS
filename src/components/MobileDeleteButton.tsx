import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

export function MobileDeleteButton({ label, itemName, onDelete }: { label: string; itemName: string; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  function cancel() {
    setConfirming(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }
  return confirming ? <div className="mobile-delete-confirm" role="group" aria-label={`${label} 확인`} onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); cancel(); }
  }}>
    <p><strong>{itemName}</strong> 삭제할까요?</p>
    <div><button ref={cancelRef} autoFocus type="button" onClick={cancel}>취소</button><button type="button" className="mobile-danger" onClick={() => { onDelete(); setConfirming(false); }}>삭제 확인</button></div>
  </div> : <button type="button" ref={triggerRef} className="mobile-delete-trigger" onClick={() => setConfirming(true)} aria-label={label}><Trash2 size={18} aria-hidden="true" /><span>삭제</span></button>;
}
