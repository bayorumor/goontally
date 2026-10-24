"use client";

import Combobox from "@/components/Combobox";
import { Group } from "@/lib/types";

interface Props {
  value: Group | null;
  groups: Group[];
  onChange: (g: Group | null) => void;
  onNewGroup: (name: string) => void;
  placeholder?: string;
}

export default function GroupSelect({
  value,
  groups,
  onChange,
  onNewGroup,
  placeholder = "Group",
}: Props) {
  return (
    <Combobox
      value={value}
      placeholder={placeholder}
      sections={[{ items: groups }]}
      onChange={onChange}
      onCreate={onNewGroup}
      createNoun="group"
      emptyMessage={() => "No groups yet"}
      showValueThumb
    />
  );
}
