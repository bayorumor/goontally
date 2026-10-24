// Shapes returned by the API routes, shared by pages and components.

export interface GroupRef {
  id: number;
  name: string;
}

export interface Group extends GroupRef {
  photoUrl: string | null;
}

export interface GroupWithMembers extends Group {
  persons: PersonSummary[];
}

export interface PersonSummary {
  id: number;
  name: string;
  photoUrl: string | null;
}

export interface Person extends PersonSummary {
  groups: GroupRef[];
}

export interface PersonWithCount extends Person {
  entryCount: number;
}

// A thought being composed in the log form, aimed at picked persons by
// their picker keys. With several persons at least one must be chosen.
export interface DraftThought {
  tag: string;
  keys: string[];
}

export interface EntryThought {
  id: number;
  tag: string;
  personIds: number[];
}

export interface Entry {
  id: number;
  loggedAt: string;
  mediumTags: string[];
  notes: string | null;
  persons: Person[];
  thoughts: EntryThought[];
}
