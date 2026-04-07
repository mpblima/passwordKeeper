import { useState } from "react";
import { Search, Upload, Link, Smile, Loader2, AlertCircle } from "lucide-react";
import { pickLocalImage, fetchUrlImage, resizeImage } from "../services/imageUtils";
import { IconDisplay } from "./IconDisplay";

const ICON_CATEGORIES: Record<string, string[]> = {
  "Tecnologia": ["💻","🖥️","📱","⌨️","💾","🔌","📡","🔧","⚙️","🤖","🎮","🖨️","📷","🎧","🖱️"],
  "Finanças":   ["🏦","💰","💳","💵","📈","📊","🪙","💎","🏧","💹","🤑","🏪"],
  "Social":     ["👤","👥","💬","📧","📬","🔗","📲","🌐","🐦","📘","📷","🎵","▶️"],
  "Segurança":  ["🔐","🔑","🛡️","🔒","🗝️","🔓","🚨","🛂","👁️","🔎"],
  "Trabalho":   ["💼","🗂️","📋","📝","✏️","📌","🗓️","📎","🖊️","📊","🏢","☎️","📞"],
  "Entretenim":["🎬","🎮","🎲","🎯","🎵","🎸","🎤","📺","📻","🎪","🎭","📽️"],
  "Compras":    ["🛒","🛍️","📦","🏬","🏷️","🎁","🛏️","🏠","🚗","✈️"],
  "Saúde":      ["❤️","🏥","💊","🩺","🏋️","🧘","🥗","🫀","💪","🩻"],
  "Geral":      ["⭐","🌟","💡","🔥","⚡","🌈","🎯","🏆","🎖️","🌍","🌙","☀️","❄️","🍀"],
};

type Tab = "emoji" | "url" | "upload";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [tab, setTab] = useState<Tab>("emoji");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tecnologia");
  const [urlInput, setUrlInput] = useState("");
  const [urlPreview, setUrlPreview] = useState("");
  const [urlError, setUrlError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Emoji tab ──────────────────────────────────────────────────────────────
  const allIcons = Object.values(ICON_CATEGORIES).flat();
  const filteredIcons = search
    ? allIcons.filter((i) => i.includes(search))
    : ICON_CATEGORIES[activeCategory] ?? [];

  // ── URL tab ────────────────────────────────────────────────────────────────
  async function handleUrlPreview() {
    const url = urlInput.trim();
    if (!url) return;
    setUrlError("");
    setLoading(true);
    try {
      const resolved = await fetchUrlImage(url);
      // Try to resize if it ends with a known extension or is data:
      let final = resolved;
      try { final = await resizeImage(resolved, 56); } catch { final = resolved; }
      setUrlPreview(final);
    } catch (err) {
      setUrlError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleUrlApply() {
    if (urlPreview) { onChange(urlPreview); setUrlPreview(""); setUrlInput(""); }
  }

  // ── Upload tab ─────────────────────────────────────────────────────────────
  async function handleUpload() {
    setLoading(true);
    try {
      const img = await pickLocalImage();
      if (img) onChange(img);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-vault-sidebar border border-vault-border rounded-xl p-3 w-80 shadow-xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-vault-card rounded-lg p-1">
        {([
          ["emoji",  <Smile size={14} />,  "Emoji"],
          ["url",    <Link size={14} />,   "URL"],
          ["upload", <Upload size={14} />, "Arquivo"],
        ] as [Tab, React.ReactNode, string][]).map(([t, icon, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t
                ? "bg-vault-primary text-white"
                : "text-vault-textMuted hover:text-vault-text"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Emoji tab ── */}
      {tab === "emoji" && (
        <>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-vault-textMuted" />
            <input
              type="text"
              placeholder="Buscar emoji..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-vault-input border border-vault-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-vault-text placeholder-vault-textMuted focus:outline-none focus:border-vault-primary"
            />
          </div>
          {!search && (
            <div className="flex flex-wrap gap-1 mb-2">
              {Object.keys(ICON_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? "bg-vault-primary text-white"
                      : "bg-vault-card text-vault-textMuted hover:text-vault-text"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto scrollbar-thin">
            {filteredIcons.map((icon) => (
              <button
                key={icon}
                onClick={() => onChange(icon)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all hover:scale-110 ${
                  value === icon ? "bg-vault-primary/30 ring-2 ring-vault-primary" : "hover:bg-vault-card"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── URL tab ── */}
      {tab === "url" && (
        <div className="space-y-3">
          <p className="text-xs text-vault-textMuted">Cole a URL de uma imagem PNG ou JPG</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlPreview(""); setUrlError(""); }}
              placeholder="https://exemplo.com/logo.png"
              className="flex-1 bg-vault-input border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text placeholder-vault-textMuted focus:outline-none focus:border-vault-primary"
            />
            <button
              onClick={handleUrlPreview}
              disabled={!urlInput.trim() || loading}
              className="px-3 py-2 bg-vault-primary/20 hover:bg-vault-primary/30 border border-vault-primary/40 rounded-lg text-vault-primary text-xs font-medium disabled:opacity-40 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Ver"}
            </button>
          </div>

          {urlError && (
            <div className="flex items-center gap-1.5 text-xs text-vault-danger">
              <AlertCircle size={13} /> {urlError}
            </div>
          )}

          {urlPreview && (
            <div className="flex items-center gap-3">
              <IconDisplay icon={urlPreview} size="w-12 h-12" className="border border-vault-border" />
              <button
                onClick={handleUrlApply}
                className="flex-1 py-2 bg-vault-primary hover:bg-vault-primaryHover rounded-lg text-white text-sm font-medium transition-colors"
              >
                Usar esta imagem
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Upload tab ── */}
      {tab === "upload" && (
        <div className="space-y-3">
          <p className="text-xs text-vault-textMuted">Selecione um arquivo PNG ou JPG do seu computador</p>

          {/* Current preview */}
          <div className="flex items-center gap-3 p-3 bg-vault-card border border-vault-border rounded-xl">
            <IconDisplay icon={value} size="w-12 h-12" className="border border-vault-border flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-vault-textMuted">Ícone atual</p>
              <p className="text-xs text-vault-text truncate">{value.startsWith("data:") ? "Imagem local" : value}</p>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full py-3 bg-vault-primary/20 hover:bg-vault-primary/30 border border-vault-primary/40 rounded-xl text-vault-primary font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Carregando...</>
            ) : (
              <><Upload size={16} /> Escolher arquivo (PNG / JPG)</>
            )}
          </button>

          <p className="text-xs text-vault-textMuted text-center">
            A imagem será redimensionada para 56×56 px e armazenada no cofre
          </p>
        </div>
      )}
    </div>
  );
}
