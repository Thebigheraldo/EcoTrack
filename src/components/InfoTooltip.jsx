import React, { useEffect, useRef, useState } from "react";

export default function InfoTooltip({ children, label = "?" }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close on outside click (for mobile / click)
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const supportsHover =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const handleMouseEnter = () => {
    if (supportsHover) setOpen(true);
  };

  const handleMouseLeave = () => {
    if (supportsHover) setOpen(false);
  };

  const handleIconClick = (e) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  return (
    <span
      ref={wrapperRef}
      className="info-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="info-icon"
        onClick={handleIconClick}
        aria-label="Show explanation"
      >
        {label}
      </button>

      {open && <div className="info-popup">{children}</div>}
    </span>
  );
}
