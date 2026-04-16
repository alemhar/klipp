import { useState } from "react";

const EMOJI_CATEGORIES = {
  "Smileys": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤩", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😬", "😮", "😯", "😲", "😳", "🥺", "😢", "😭", "😤", "😡", "🤬", "😈"],
  "Hands": ["👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤝", "🙏", "✌️", "🤞", "🤟", "🤘", "👌", "🤌", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "💪"],
  "Symbols": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️", "💕", "✅", "❌", "⭐", "🌟", "💯", "🔥", "💥", "💫", "⚡", "🎯", "💡", "📌", "📍", "🚀", "🎉", "🎊", "🏆"],
  "Arrows": ["⬆️", "⬇️", "⬅️", "➡️", "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "🔄", "🔃", "▶️", "◀️", "🔼", "🔽"],
  "Objects": ["📱", "💻", "🖥️", "⌨️", "🖱️", "📷", "📸", "📹", "🎥", "📺", "📻", "🔊", "🔔", "📢", "📣", "💾", "📁", "📂", "🗂️", "📊", "📈", "📉", "📝", "✏️", "🔍", "🔎"],
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("Smileys");

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: 12,
          padding: 12,
          width: 320,
          maxHeight: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Category tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto" }}>
          {Object.keys(EMOJI_CATEGORIES).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                backgroundColor: activeCategory === cat ? "var(--accent-color)" : "transparent",
                color: activeCategory === cat ? "#fff" : "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 2,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => onSelect(emoji)}
              style={{
                width: 34,
                height: 34,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 20,
                backgroundColor: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
