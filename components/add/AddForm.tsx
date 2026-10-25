"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import GroupSelect from "@/components/log/GroupSelect";
import PersonSelectExclude from "@/components/add/PersonSelectExclude";
import PhotoCropperModal from "@/components/PhotoCropperModal";
import Avatar from "@/components/ui/Avatar";
import PhotoSlot from "@/components/ui/PhotoSlot";
import { useFeedback } from "@/components/ui/Feedback";
import { PERSON_ASPECT, SQUARE_ASPECT } from "@/lib/image";
import { Group, Person } from "@/lib/types";

interface Row {
  id: string;
  person: Person | null;
  newName: string;
  photo: File | null;
}

let uid = 0;
const makeRow = (): Row => ({
  id: `row${++uid}`,
  person: null,
  newName: "",
  photo: null,
});

interface Props {
  groups: Group[];
  allPersons: Person[];
  initialGroupId?: number;
}

// Adds persons to the library, optionally into a (new or existing) group.
export default function AddForm({ groups, allPersons, initialGroupId }: Props) {
  const router = useRouter();
  const { toast } = useFeedback();

  const [group, setGroup] = useState<Group | null>(
    groups.find((g) => g.id === initialGroupId) ?? null,
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([makeRow()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // rowId null means the photo is for the new group.
  const [cropping, setCropping] = useState<{
    file: File;
    rowId: string | null;
  } | null>(null);

  const hasGroup = !!group || !!newGroupName;
  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    if (savingRef.current) return;
    const filled = rows.filter((r) => r.person || r.newName);
    if (!filled.length) {
      setError("Add at least one person");
      return;
    }
    setError("");
    savingRef.current = true;
    setSaving(true);

    try {
      // One request, saved in one transaction: either everything is added
      // or nothing is.
      const fd = new FormData();
      if (groupPhoto && newGroupName) fd.append("photo:group", groupPhoto);
      const persons = filled.map((row) => {
        if (row.person) return { personId: row.person.id };
        if (row.photo) fd.append(`photo:${row.id}`, row.photo);
        return {
          newPersonName: row.newName,
          ...(row.photo ? { personPhotoKey: row.id } : {}),
        };
      });
      fd.append(
        "data",
        JSON.stringify({
          group: newGroupName
            ? {
                newGroupName,
                ...(groupPhoto ? { groupPhotoKey: "group" } : {}),
              }
            : group
              ? { groupId: group.id }
              : undefined,
          persons,
        }),
      );

      const res = await fetch("/api/persons", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Couldn't save (${res.status})`);
        return;
      }

      toast(
        body.warning ??
          (filled.length === 1
            ? "Person added"
            : `${filled.length} persons added`),
      );
      router.push(body.groupId ? `/groups/${body.groupId}` : "/library");
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const groupForPicker = newGroupName
    ? { id: null, name: newGroupName }
    : group;

  return (
    <>
      {cropping && (
        <PhotoCropperModal
          file={cropping.file}
          aspect={cropping.rowId ? PERSON_ASPECT : SQUARE_ASPECT}
          confirmLabel="Use photo"
          onConfirm={(file) => {
            if (cropping.rowId) updateRow(cropping.rowId, { photo: file });
            else setGroupPhoto(file);
            setCropping(null);
          }}
          onCancel={() => setCropping(null)}
        />
      )}

      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Add to library
          </h1>
          <p className="mt-0.5 text-[14px] text-muted">
            New persons, optionally into a group.
          </p>
        </div>

        <section className="card flex flex-col gap-3 p-4">
          <p className="label !mb-0">Group (optional)</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <GroupSelect
                value={
                  newGroupName
                    ? { id: 0, name: newGroupName, photoUrl: null }
                    : group
                }
                groups={groups}
                onChange={(g) => {
                  setGroup(g);
                  setNewGroupName("");
                  setGroupPhoto(null);
                  setRows([makeRow()]);
                }}
                onNewGroup={(name) => {
                  setGroup(null);
                  setNewGroupName(name);
                  setRows([makeRow()]);
                }}
                placeholder="Pick or create a group"
              />
            </div>
            {newGroupName && (
              <PhotoSlot
                file={groupPhoto}
                onPick={(file) => setCropping({ file, rowId: null })}
                shape="square"
                label={`Add a photo for ${newGroupName}`}
              />
            )}
          </div>
          {newGroupName && (
            <p className="text-[13px] text-muted">
              A new group{" "}
              <span className="font-semibold text-text">{newGroupName}</span>{" "}
              will be created.
            </p>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-4">
          <p className="label !mb-0">Persons</p>
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              {row.newName ? (
                <PhotoSlot
                  file={row.photo}
                  onPick={(file) => setCropping({ file, rowId: row.id })}
                  label={`Add a photo of ${row.newName}`}
                />
              ) : (
                <Avatar
                  src={row.person?.photoUrl}
                  name={row.person?.name ?? "?"}
                  size={44}
                />
              )}
              <div className="min-w-0 flex-1">
                <PersonSelectExclude
                  selectedGroup={groupForPicker}
                  allowExisting={hasGroup}
                  value={
                    row.newName
                      ? { id: 0, name: row.newName, photoUrl: null, groups: [] }
                      : row.person
                  }
                  allPersons={allPersons}
                  onChange={(p) =>
                    updateRow(row.id, { person: p, newName: "", photo: null })
                  }
                  onNewPerson={(name) =>
                    updateRow(row.id, {
                      person: null,
                      newName: name,
                      photo: null,
                    })
                  }
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="icon-btn shrink-0"
                  aria-label="Remove row"
                  onClick={() =>
                    setRows((prev) => prev.filter((r) => r.id !== row.id))
                  }
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost self-start"
            onClick={() => setRows((prev) => [...prev, makeRow()])}
          >
            <Plus size={16} /> Another person
          </button>
        </section>

        {error && <p className="text-[14px] text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={() => router.back()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

