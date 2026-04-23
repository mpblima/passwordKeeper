import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Star, LayoutGrid, List, Search, ChevronRight, ArrowLeft, FolderOpen, Plus } from "lucide-react";
import { useVaultStore } from "../store/vaultStore";
import { PasswordEntry, PasswordGroup } from "../types/vault";
import { IconDisplay } from "./IconDisplay";
import { PasswordDetail } from "./PasswordDetail";

interface PasswordGridProps {
  onAddEntry: (groupId?: string) => void;
}

export function PasswordGrid({ onAddEntry }: PasswordGridProps) {
  const {
    vault, sharedSources, activeView, selectedGroupId, selectedEntryId, searchQuery, viewMode,
    getFilteredEntries, selectEntry, toggleFavorite, setViewMode,
    setActiveView, selectGroup, currentUserRole,
  } = useVaultStore();
  const receivedSharedSources = sharedSources.filter((source) => source.role !== "owner");

  const canAdd = currentUserRole() !== "reader";

  // ── Entry detail view: replaces the grid when a password is selected ─────────
  if (selectedEntryId) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-vault-border flex items-center gap-3">
          <button
            onClick={() => selectEntry(null)}
            className="flex items-center gap-1.5 text-vault-textMuted hover:text-vault-text transition-colors text-sm"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <PasswordDetail />
        </div>
      </div>
    );
  }

  // ── When inside a group, show only that group's entries ──────────────────────
  if (activeView === "group" && selectedGroupId) {
    const sharedSource = receivedSharedSources.find((source) =>
      source.groups.some((g) => g.id === selectedGroupId) || selectedGroupId === `shared:${source.id}:ungrouped`
    );
    const group = sharedSource
      ? sharedSource.groups.find((g) => g.id === selectedGroupId)
      : vault?.groups.find((g) => g.id === selectedGroupId);
    const entries = sharedSource
      ? sharedSource.entries.filter((e) => selectedGroupId.endsWith(":ungrouped") ? !e.groupId : e.groupId === selectedGroupId)
      : vault?.entries.filter((e) => e.groupId === selectedGroupId) ?? [];
    const filtered = searchQuery
      ? entries.filter((e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : entries;

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-vault-border flex items-center gap-4">
          <button
            onClick={() => selectGroup(null)}
            className="flex items-center gap-1.5 text-vault-textMuted hover:text-vault-text transition-colors text-sm"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {group && <IconDisplay icon={group.icon} size="w-6 h-6" />}
            <h2 className="text-vault-text font-semibold text-lg truncate">{group?.name ?? sharedSource?.name ?? "Grupo"}</h2>
            <span className="text-vault-textMuted text-sm">· {filtered.length}</span>
            {sharedSource && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-vault-primary/15 text-vault-primary">
                {sharedSource.owner}
              </span>
            )}
          </div>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {filtered.length === 0 ? (
            <EmptyState
              message={searchQuery ? "Nenhum resultado" : "Nenhuma senha neste grupo"}
              hint={searchQuery ? "Tente outros termos" : undefined}
              onAdd={canAdd ? () => onAddEntry(selectedGroupId) : undefined}
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((entry) => (
                <EntryCard key={entry.id} entry={entry} selected={selectedEntryId === entry.id}
                  onSelect={() => selectEntry(entry.id === selectedEntryId ? null : entry.id)}
                  onToggleFavorite={() => toggleFavorite(entry.id)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <EntryListItem key={entry.id} entry={entry} selected={selectedEntryId === entry.id}
                  onSelect={() => selectEntry(entry.id === selectedEntryId ? null : entry.id)}
                  onToggleFavorite={() => toggleFavorite(entry.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Favorites view ───────────────────────────────────────────────────────────
  if (activeView === "favorites") {
    const entries = getFilteredEntries();
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-vault-border flex items-center gap-4">
          <div className="flex-1">
            <h2 className="text-vault-text font-semibold text-lg">Favoritas</h2>
            <p className="text-vault-textMuted text-sm">{entries.length} senha{entries.length !== 1 ? "s" : ""}</p>
          </div>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {entries.length === 0 ? (
            <EmptyState message="Nenhum favorito" hint="Marque senhas com ⭐" />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} selected={selectedEntryId === entry.id}
                  onSelect={() => selectEntry(entry.id === selectedEntryId ? null : entry.id)}
                  onToggleFavorite={() => toggleFavorite(entry.id)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <EntryListItem key={entry.id} entry={entry} selected={selectedEntryId === entry.id}
                  onSelect={() => selectEntry(entry.id === selectedEntryId ? null : entry.id)}
                  onToggleFavorite={() => toggleFavorite(entry.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Root view: groups + ungrouped entries ────────────────────────────────────
  const groups = vault?.groups ?? [];
  const sharedGroups = receivedSharedSources.flatMap((source) => {
    const mapped = source.groups.map((group) => ({ group, source }));
    const ungroupedCount = source.entries.filter((entry) => !entry.groupId).length;
    if (ungroupedCount === 0) return mapped;
    return [
      ...mapped,
      {
        source,
        group: {
          id: `shared:${source.id}:ungrouped`,
          name: source.name,
          description: "Senhas compartilhadas",
          icon: "🔗",
          createdAt: source.updatedAt ?? source.lastSyncAt ?? new Date(0).toISOString(),
          updatedAt: source.updatedAt ?? source.lastSyncAt ?? new Date(0).toISOString(),
        },
      },
    ];
  });
  const ungrouped = vault?.entries.filter((e) => !e.groupId) ?? [];
  const filteredUngrouped = searchQuery
    ? ungrouped.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ungrouped;
  const filteredGroups = searchQuery
    ? groups.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : groups;

  const filteredSharedGroups = searchQuery
    ? sharedGroups.filter(({ group, source }) =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.owner.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sharedGroups;
  const totalVisible = filteredGroups.length + filteredUngrouped.length + filteredSharedGroups.length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-vault-border flex items-center gap-4">
        <div className="flex-1">
          <h2 className="text-vault-text font-semibold text-lg">Cofre</h2>
          <p className="text-vault-textMuted text-sm">
            {groups.length + sharedGroups.length} grupo{groups.length + sharedGroups.length !== 1 ? "s" : ""} · {((vault?.entries.length ?? 0) + receivedSharedSources.flatMap((source) => source.entries).length)} senha{((vault?.entries.length ?? 0) + receivedSharedSources.flatMap((source) => source.entries).length) !== 1 ? "s" : ""}
          </p>
        </div>
        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-8">
        {totalVisible === 0 && searchQuery ? (
          <EmptyState message="Nenhum resultado" hint="Tente outros termos" />
        ) : (
          <>
            {/* Groups */}
            {filteredGroups.length > 0 && (
              <section>
                <p className="text-vault-textMuted text-xs font-semibold uppercase tracking-wider mb-3">Grupos</p>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        entryCount={vault?.entries.filter((e) => e.groupId === group.id).length ?? 0}
                        onOpen={() => selectGroup(group.id)}
                        onAddEntry={canAdd ? () => onAddEntry(group.id) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGroups.map((group) => (
                      <GroupListItem
                        key={group.id}
                        group={group}
                        entryCount={vault?.entries.filter((e) => e.groupId === group.id).length ?? 0}
                        onOpen={() => selectGroup(group.id)}
                        onAddEntry={canAdd ? () => onAddEntry(group.id) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Ungrouped entries */}
            {filteredUngrouped.length > 0 && (
              <section>
                <p className="text-vault-textMuted text-xs font-semibold uppercase tracking-wider mb-3">Sem grupo</p>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                    {filteredUngrouped.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} selected={selectedEntryId === entry.id}
                        onSelect={() => selectEntry(entry.id === selectedEntryId ? null : entry.id)}
                        onToggleFavorite={() => toggleFavorite(entry.id)} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredUngrouped.map((entry) => (
                      <EntryListItem key={entry.id} entry={entry} selected={selectedEntryId === entry.id}
                        onSelect={() => selectEntry(entry.id === selectedEntryId ? null : entry.id)}
                        onToggleFavorite={() => toggleFavorite(entry.id)} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {filteredSharedGroups.length > 0 && (
              <section>
                <p className="text-vault-textMuted text-xs font-semibold uppercase tracking-wider mb-3">Compartilhados</p>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                    {filteredSharedGroups.map(({ group, source }) => (
                      <GroupCard
                        key={group.id}
                        group={{ ...group, description: `${source.owner} · ${source.role}` }}
                        entryCount={group.id.endsWith(":ungrouped")
                          ? source.entries.filter((e) => !e.groupId).length
                          : source.entries.filter((e) => e.groupId === group.id).length}
                        onOpen={() => selectGroup(group.id)}
                        onAddEntry={source.role !== "reader" && !group.id.endsWith(":ungrouped") ? () => onAddEntry(group.id) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSharedGroups.map(({ group, source }) => (
                      <GroupListItem
                        key={group.id}
                        group={{ ...group, description: `${source.owner} · ${source.role}` }}
                        entryCount={group.id.endsWith(":ungrouped")
                          ? source.entries.filter((e) => !e.groupId).length
                          : source.entries.filter((e) => e.groupId === group.id).length}
                        onOpen={() => selectGroup(group.id)}
                        onAddEntry={source.role !== "reader" && !group.id.endsWith(":ungrouped") ? () => onAddEntry(group.id) : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Totally empty vault */}
            {totalVisible === 0 && !searchQuery && (
              <EmptyState
                message="Cofre vazio"
                hint="Crie um grupo ou adicione uma senha para começar"
                onAdd={canAdd ? () => onAddEntry() : undefined}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: PasswordGroup;
  entryCount: number;
  onOpen: () => void;
  onAddEntry?: () => void;
}

function GroupCard({ group, entryCount, onOpen, onAddEntry }: GroupCardProps) {
  const [draggingOver, setDraggingOver] = useState(false);
  const { updateEntry } = useVaultStore();

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    const entryId = e.dataTransfer.getData("entryId");
    if (entryId) updateEntry(entryId, { groupId: group.id });
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={handleDrop}
      onClick={onOpen}
      className={`relative bg-vault-card border rounded-2xl p-5 cursor-pointer transition-all group hover:scale-[1.01] hover:shadow-lg hover:shadow-black/20 ${
        draggingOver
          ? "border-vault-primary/60 bg-vault-primary/5 scale-[1.02]"
          : "border-vault-border hover:border-vault-border/60"
      }`}
    >
      {draggingOver && (
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-vault-primary/10 pointer-events-none">
          <span className="text-vault-primary text-xs font-medium">Soltar aqui</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-vault-sidebar border border-vault-border flex items-center justify-center overflow-hidden">
          <IconDisplay icon={group.icon} size="w-12 h-12" />
        </div>
        <ChevronRight size={16} className="text-vault-textMuted group-hover:text-vault-primary transition-colors mt-1" />
      </div>

      <p className="text-vault-text font-semibold text-sm mb-1 truncate">{group.name}</p>
      <p className="text-vault-textMuted text-xs">{entryCount} senha{entryCount !== 1 ? "s" : ""}</p>

      {group.description && (
        <p className="text-vault-textMuted text-xs mt-1.5 line-clamp-1">{group.description}</p>
      )}

      {onAddEntry && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddEntry(); }}
          className="absolute bottom-3 right-3 p-1.5 rounded-lg text-vault-textMuted hover:text-vault-primary hover:bg-vault-primary/10 transition-all opacity-0 group-hover:opacity-100"
          title="Adicionar senha neste grupo"
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Group List Item ──────────────────────────────────────────────────────────

function GroupListItem({ group, entryCount, onOpen, onAddEntry }: GroupCardProps) {
  const [draggingOver, setDraggingOver] = useState(false);
  const { updateEntry } = useVaultStore();

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    const entryId = e.dataTransfer.getData("entryId");
    if (entryId) updateEntry(entryId, { groupId: group.id });
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={handleDrop}
      onClick={onOpen}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all border group ${
        draggingOver
          ? "border-vault-primary/50 bg-vault-primary/5"
          : "bg-vault-card border-vault-border hover:border-vault-border/60 hover:bg-vault-cardHover"
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-vault-sidebar border border-vault-border flex items-center justify-center overflow-hidden flex-shrink-0">
        <IconDisplay icon={group.icon} size="w-10 h-10" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-vault-text font-medium text-sm truncate">{group.name}</p>
        <p className="text-vault-textMuted text-xs">{entryCount} senha{entryCount !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onAddEntry && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddEntry(); }}
            className="p-2 rounded-lg text-vault-textMuted hover:text-vault-primary hover:bg-vault-primary/10 transition-all opacity-0 group-hover:opacity-100"
            title="Adicionar senha"
          >
            <Plus size={14} />
          </button>
        )}
        <ChevronRight size={16} className="text-vault-textMuted group-hover:text-vault-primary transition-colors" />
      </div>
    </div>
  );
}

// ─── Entry Card (sem ícone) ────────────────────────────────────────────────────

interface EntryProps {
  entry: PasswordEntry;
  selected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function EntryCard({ entry, selected, onSelect, onToggleFavorite }: EntryProps) {
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [dragging, setDragging] = useState(false);

  function copyUser(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.username);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
  }

  function copyPwd(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.password);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  }

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("entryId", entry.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onClick={onSelect}
      className={`relative bg-vault-card border rounded-2xl p-4 cursor-pointer transition-all select-none ${
        dragging ? "opacity-40 scale-95" : "hover:scale-[1.01]"
      } ${
        selected
          ? "border-vault-primary/60 shadow-lg shadow-vault-primary/10"
          : "border-vault-border hover:border-vault-border/60 hover:shadow-lg hover:shadow-black/20"
      }`}
    >
      {/* Favorite */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${
          entry.favorite ? "text-vault-warning" : "text-vault-border hover:text-vault-textMuted"
        }`}
      >
        <Star size={14} fill={entry.favorite ? "currentColor" : "none"} />
      </button>

      {/* Name */}
      <p className="text-vault-text font-semibold text-sm truncate pr-7 mb-3">{entry.name}</p>

      {/* Username */}
      <div className="flex items-center gap-2 mb-2">
        <p className="text-vault-textSecondary text-xs truncate flex-1">{entry.username}</p>
        <button onClick={copyUser} className="p-1 rounded text-vault-textMuted hover:text-vault-primary transition-colors flex-shrink-0">
          {copiedUser ? <Check size={13} className="text-vault-success" /> : <Copy size={13} />}
        </button>
      </div>

      {/* Password */}
      <div className="flex items-center gap-2">
        <p className="text-vault-textMuted text-xs font-mono truncate flex-1">
          {showPwd ? entry.password : "•".repeat(Math.min(entry.password.length, 16))}
        </p>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setShowPwd(!showPwd); }} className="p-1 rounded text-vault-textMuted hover:text-vault-text transition-colors">
            {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button onClick={copyPwd} className="p-1 rounded text-vault-textMuted hover:text-vault-primary transition-colors">
            {copiedPwd ? <Check size={13} className="text-vault-success" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {selected && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-vault-primary to-vault-secondary rounded-b-2xl" />
      )}
    </div>
  );
}

// ─── Entry List Item (sem ícone) ──────────────────────────────────────────────

function EntryListItem({ entry, selected, onSelect, onToggleFavorite }: EntryProps) {
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [dragging, setDragging] = useState(false);

  function copyUser(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.username);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
  }

  function copyPwd(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.password);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  }

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("entryId", entry.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onClick={onSelect}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all border select-none ${
        dragging ? "opacity-40" : ""
      } ${
        selected
          ? "bg-vault-primary/10 border-vault-primary/30"
          : "bg-vault-card border-vault-border hover:border-vault-border/60 hover:bg-vault-cardHover"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-vault-text font-medium text-sm truncate">{entry.name}</p>
          {entry.favorite && <Star size={12} className="text-vault-warning flex-shrink-0" fill="currentColor" />}
        </div>
        <p className="text-vault-textMuted text-xs truncate">{entry.username}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={copyUser} className="p-2 rounded-lg text-vault-textMuted hover:text-vault-primary hover:bg-vault-primary/10 transition-all" title="Copiar usuário">
          {copiedUser ? <Check size={15} className="text-vault-success" /> : <Copy size={15} />}
        </button>
        <button onClick={copyPwd} className="p-2 rounded-lg text-vault-textMuted hover:text-vault-primary hover:bg-vault-primary/10 transition-all" title="Copiar senha">
          {copiedPwd ? <Check size={15} className="text-vault-success" /> : <Copy size={15} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={`p-2 rounded-lg transition-colors ${entry.favorite ? "text-vault-warning" : "text-vault-border hover:text-vault-textMuted"}`}
        >
          <Star size={15} fill={entry.favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ViewToggle({ viewMode, setViewMode }: { viewMode: string; setViewMode: (m: "grid" | "list") => void }) {
  return (
    <div className="flex items-center gap-1 bg-vault-card border border-vault-border rounded-xl p-1">
      <button
        onClick={() => setViewMode("grid")}
        className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-vault-primary/20 text-vault-primary" : "text-vault-textMuted hover:text-vault-text"}`}
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => setViewMode("list")}
        className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-vault-primary/20 text-vault-primary" : "text-vault-textMuted hover:text-vault-text"}`}
      >
        <List size={16} />
      </button>
    </div>
  );
}

function EmptyState({ message, hint, onAdd }: { message: string; hint?: string; onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 rounded-full bg-vault-card border border-vault-border flex items-center justify-center mb-4">
        <FolderOpen size={24} className="text-vault-textMuted" />
      </div>
      <p className="text-vault-textSecondary font-medium">{message}</p>
      {hint && <p className="text-vault-textMuted text-sm mt-1">{hint}</p>}
      {onAdd && (
        <button
          onClick={onAdd}
          className="mt-3 px-4 py-2 bg-vault-primary/20 hover:bg-vault-primary/30 border border-vault-primary/30 rounded-xl text-vault-primary text-sm font-medium transition-colors"
        >
          + Adicionar senha
        </button>
      )}
    </div>
  );
}
