import { ReactNode, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

interface TooltipProps {
  label: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ label, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let x = 0, y = 0;
    const gap = 8;
    if (position === "top")    { x = rect.left + rect.width / 2; y = rect.top - gap; }
    if (position === "bottom") { x = rect.left + rect.width / 2; y = rect.bottom + gap; }
    if (position === "left")   { x = rect.left - gap; y = rect.top + rect.height / 2; }
    if (position === "right")  { x = rect.right + gap; y = rect.top + rect.height / 2; }
    setCoords({ x, y });
    setVisible(true);
  }, [position]);

  const hide = useCallback(() => setVisible(false), []);

  const transformClass = {
    top:    "-translate-x-1/2 -translate-y-full",
    bottom: "-translate-x-1/2",
    left:   "-translate-x-full -translate-y-1/2",
    right:  "-translate-y-1/2",
  }[position];

  const tooltip = visible && ReactDOM.createPortal(
    <span
      style={{ left: coords.x, top: coords.y, pointerEvents: "none" }}
      className={`fixed z-[9999] px-2.5 py-1.5 text-xs bg-gray-900 text-white rounded-lg whitespace-nowrap border border-white/10 shadow-xl ${transformClass}`}
    >
      {label}
    </span>,
    document.body
  );

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </div>
      {tooltip}
    </>
  );
}
