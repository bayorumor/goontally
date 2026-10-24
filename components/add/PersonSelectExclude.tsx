"use client";

import Combobox from "@/components/Combobox";
import { titleCase } from "@/lib/format";
import { Person } from "@/lib/types";

interface Props {
  selectedGroup: { id: number | null; name: string } | null;
  // Without a group there's nothing to do with an existing person, so only
  // new names can be entered.
  allowExisting: boolean;
  value: Person | null;
  allPersons: Person[];
  onChange: (p: Person | null) => void;
  onNewPerson: (name: string) => void;
}

// Person picker for adding members: hides persons already in the group.
export default function PersonSelectExclude({
  selectedGroup,
  allowExisting,
  value,
  allPersons,
  onChange,
  onNewPerson,
}: Props) {
  const groupId = selectedGroup?.id;
  const inGroup = (p: Person) =>
    !!groupId && p.groups.some((g) => g.id === groupId);
  const options = allowExisting ? allPersons.filter((p) => !inGroup(p)) : [];

  return (
    <Combobox
      value={value}
      placeholder={
        allowExisting ? "Search or type a new name" : "New person's name"
      }
      sections={[{ items: options }]}
      onChange={onChange}
      onCreate={onNewPerson}
      createNoun="person"
      // Matching against everyone means an existing name is never offered
      // as a new person, even when that person is hidden.
      knownNames={allPersons.map((p) => p.name)}
      notice={(q) => {
        const match = allPersons.find((p) => p.name.toLowerCase() === q);
        if (!match) return null;
        if (inGroup(match))
          return `${titleCase(match.name)} is already in this group`;
        if (!allowExisting)
          return `${titleCase(match.name)} is already in your library`;
        return null;
      }}
      emptyMessage={(q) => {
        if (q) return "No match found";
        if (!allowExisting) return "Type a name";
        if (groupId) return "Everyone's already in this group";
        return "No persons yet";
      }}
    />
  );
}
